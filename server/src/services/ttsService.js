import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { concatenateAudioFiles } from "./ffmpegService.js";

dotenv.config();

/**
 * Language to Microsoft Edge Neural Voice mapping for Narration
 */
const LANGUAGE_VOICE_MAP = {
    English: "en-US-AriaNeural", // Very natural, expressive female voice
    Hindi: "hi-IN-SwaraNeural",        // Natural, expressive Hindi female
    Marathi: "mr-IN-AarohiNeural",     // Natural Marathi female
};

/**
 * Distinct character voices pool for Dialogues separated by gender
 */
const CHARACTER_VOICES = {
    English: {
        male: ["en-US-GuyNeural", "en-US-DavisNeural", "en-US-JasonNeural", "en-US-TonyNeural"],
        female: ["en-US-JennyNeural", "en-US-JaneNeural", "en-US-NancyNeural", "en-US-SaraNeural"]
    },
    Hindi: {
        male: ["hi-IN-MadhurNeural"],
        female: ["hi-IN-KavyaNeural", "hi-IN-SwaraNeural"]
    },
    Marathi: {
        male: ["mr-IN-ManoharNeural"],
        female: ["mr-IN-AarohiNeural"]
    }
};

/**
 * Get a narrator voice dynamically based on scene mood
 */
const getNarratorVoice = (mood = "", language = "English") => {
    const m = mood.toLowerCase();
    if (language === "Hindi") {
        // ALWAYS use female voice for Hindi Narrator. 
        // We only have one male voice (Madhur), so if the narrator is male, 
        // he will collide with male characters in the story.
        return "hi-IN-SwaraNeural";
    } else {
        if (m.includes("action") || m.includes("thriller")) return "en-US-DavisNeural";
        if (m.includes("horror") || m.includes("mystery")) return "en-US-JasonNeural";
        if (m.includes("comedy")) return "en-US-JennyNeural";
        if (m.includes("emotional") || m.includes("drama")) return "en-US-AriaNeural";
        return "en-US-AriaNeural";
    }
};

const getCharacterVoice = (characterName, language, storyData = {}) => {
    const pools = CHARACTER_VOICES[language] || CHARACTER_VOICES["English"];
    
    let isMale = false;

    // Use LLM-generated explicit gender mapping if available
    if (storyData.characterGenders && storyData.characterGenders[characterName]) {
        isMale = storyData.characterGenders[characterName].toLowerCase() === "male";
    } else {
        // Fallback Heuristic
        const characterBible = storyData.characterBible || {};
        const desc = (characterBible[characterName] || characterName).toLowerCase();
        isMale = /\b(man|boy|male|him|his|gentleman|king|father|brother|uncle|grandfather)\b/i.test(desc) || 
                 /\b(man|boy|male)\b/i.test(characterName);
    }
    
    // Default to female pool if not explicitly male
    const pool = isMale ? pools.male : pools.female;
    
    let hash = 0;
    for (let i = 0; i < characterName.length; i++) {
        hash = characterName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return pool[Math.abs(hash) % pool.length];
};

/**
 * Helper to map descriptive pacing/pitch to SSML percentages for Edge TTS
 */
const mapDeliveryToSSML = (delivery) => {
    let rate = "+0%";
    let pitch = "+0%";
    let volume = "+0%";

    if (!delivery) return { rate, pitch, volume };

    // Pace
    if (delivery.pace === "slow") rate = "-15%";
    else if (delivery.pace === "very slow" || delivery.pace === "slowest") rate = "-25%";
    else if (delivery.pace === "fast") rate = "+15%";
    else if (delivery.pace === "very fast" || delivery.pace === "urgent speech") rate = "+25%";
    
    // Pitch
    if (delivery.pitch === "low") pitch = "-10%";
    else if (delivery.pitch === "very low") pitch = "-20%";
    else if (delivery.pitch === "high") pitch = "+10%";
    else if (delivery.pitch === "very high") pitch = "+20%";

    // Volume
    if (delivery.volume === "soft" || delivery.volume === "whisper") volume = "-30%";
    else if (delivery.volume === "loud" || delivery.volume === "raised voice") volume = "+20%";

    return { rate, pitch, volume };
};

/**
 * Generate audio for a single segment of text with emotion delivery
 */
const generateSingleAudio = async (segment, outputPath, voiceName) => {
    // Handle both plain text (old format) and object (new format)
    const text = typeof segment === "string" ? segment : segment.text;
    const delivery = typeof segment === "object" ? segment.delivery : null;

    if (!text || text.trim().length === 0) {
        return createSilentAudio(outputPath, 1);
    }

    return new Promise(async (resolve, reject) => {
        console.log(`🎙️  TTS (Edge Neural): "${text.substring(0, 40)}..." (${voiceName})`);

        let handled = false;
        const timer = setTimeout(() => {
            if (!handled) {
                handled = true;
                console.warn("⚠️  TTS (Edge) timed out after 30s. Falling back to silent audio.");
                createSilentAudio(outputPath).then(resolve).catch(reject);
            }
        }, 30000);

        try {
            const tts = new MsEdgeTTS();
            await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
            
            if (handled) return;

            // Apply SSML approximation for delivery parameters
            const { rate, pitch, volume } = mapDeliveryToSSML(delivery);
            let finalText = text;
            
            const hasVocalCues = delivery?.vocalCues?.length > 0;
            if (hasVocalCues) {
                const cueString = delivery.vocalCues.join(", ").replace(/_/g, " ");
                console.log(`   🎭 Vocal Cues: [${cueString}] (Simulated via pauses)`);
                // Simulate pauses for cues like "nervous_breath" or "sigh"
                finalText = `... ${finalText} ...`;
            }

            // Note: msedge-tts escapes raw SSML tags, causing silent output or reading XML tags.
            // We rely on the natural punctuation and pauses for Edge TTS.
            const { audioStream } = tts.toStream(finalText);
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            
            const writeStream = fs.createWriteStream(outputPath);
            
            audioStream.pipe(writeStream);
            
            audioStream.on('end', () => {
                if (handled) return;
                handled = true;
                clearTimeout(timer);
                resolve();
            });

            audioStream.on('error', (err) => {
                if (handled) return;
                handled = true;
                clearTimeout(timer);
                console.error(`❌ TTS Stream Error:`, err);
                createSilentAudio(outputPath).then(resolve).catch(reject);
            });

        } catch (error) {
            console.error("❌ Edge TTS Connection Error:", error.message);
            if (handled) return;
            handled = true;
            clearTimeout(timer);
            console.warn("⚠️  Falling back to silent audio");
            createSilentAudio(outputPath).then(resolve).catch(reject);
        }
    });
};

/**
 * Generate combined audio (Narration + Dialogues) for a scene
 */
export const generateSceneAudio = async (scene, outputPath, language = "English", storyData = {}) => {
    const tempAudioPaths = [];
    const baseDir = path.dirname(outputPath);

    try {
        // 1. Generate Narration Audio
        const globalMood = storyData.mood || scene.mood || "";
        const narratorVoice = getNarratorVoice(globalMood, language);
        
        if (scene.narration) {
            // Handle both string (old format) and array of segments (new format)
            const narrations = Array.isArray(scene.narration) ? scene.narration : [scene.narration];
            
            for (let i = 0; i < narrations.length; i++) {
                const segment = narrations[i];
                const text = typeof segment === "string" ? segment : segment.text;
                if (text && text.trim().length > 0) {
                    const narPath = path.join(baseDir, `temp_narration_${scene.sceneNumber}_${i}_${Date.now()}.mp3`);
                    await generateSingleAudio(segment, narPath, narratorVoice);
                    tempAudioPaths.push(narPath);
                }
            }
        }

        // 2. Generate Dialogue Audio
        if (scene.dialogue && Array.isArray(scene.dialogue)) {
            for (let i = 0; i < scene.dialogue.length; i++) {
                const segment = scene.dialogue[i];
                if (segment.text && segment.character) {
                    const charVoice = getCharacterVoice(segment.character, language, storyData);
                    const dialPath = path.join(baseDir, `temp_dialogue_${scene.sceneNumber}_${i}_${Date.now()}.mp3`);
                    await generateSingleAudio(segment, dialPath, charVoice);
                    tempAudioPaths.push(dialPath);
                }
            }
        }

        // 3. Combine if we have parts
        if (tempAudioPaths.length > 0) {
            await concatenateAudioFiles(tempAudioPaths, outputPath);
        } else {
            console.warn("⚠️  TTS: Scene has no text, creating silent audio");
            await createSilentAudio(outputPath, 5);
        }
    } catch (err) {
        console.error(`❌ generateSceneAudio failed: ${err.message}`);
        await createSilentAudio(outputPath, 5);
    } finally {
        // Cleanup temp files
        for (const p of tempAudioPaths) {
            if (fs.existsSync(p)) fs.unlinkSync(p);
        }
    }

    return outputPath;
};

/**
 * Creates a minimal silent WAV file (Even though extension might be .mp3, FFmpeg handles the mismatch gracefully)
 * Ensures FFmpeg always has an audio input even if TTS fails
 */
const createSilentAudio = async (outputPath, durationSeconds = 10) => {
    // Minimal valid WAV file header for silence (PCM, 44100Hz, 16-bit, mono)
    const sampleRate = 44100;
    const numChannels = 1;
    const bitsPerSample = 16;
    const numSamples = sampleRate * durationSeconds;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = numSamples * blockAlign;
    const fileSize = 44 + dataSize;

    const buffer = Buffer.alloc(fileSize, 0);
    // RIFF header
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(fileSize - 8, 4);
    buffer.write("WAVE", 8);
    // fmt chunk
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);      // PCM
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    // data chunk
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);
    // Remaining bytes are already 0 (silence)

    fs.writeFileSync(outputPath, buffer);
    console.log(`🔇 Silent audio created: ${path.basename(outputPath)}`);
    return outputPath;
};
