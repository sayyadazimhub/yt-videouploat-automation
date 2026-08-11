import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

/**
 * Language to Microsoft Edge Neural Voice mapping
 * Using the most expressive, cinematic narrator voices available.
 */
const LANGUAGE_VOICE_MAP = {
    English: "en-US-ChristopherNeural", // Deep, cinematic male narrator
    Hindi: "hi-IN-MadhurNeural",        // Professional Hindi male
    Marathi: "mr-IN-ManoharNeural",     // Professional Marathi male
};

/**
 * Generate audio narration for a scene using google-tts-api
 * @param {string} narration - Text to speak
 * @param {string} outputPath - Absolute .mp3 file path
 * @param {string} language - Language name
 * @returns {Promise<string>} outputPath on success
 */
export const generateAudio = async (narration, outputPath, language = "English") => {
    if (!narration || narration.trim().length === 0) {
        console.warn("⚠️  TTS: Empty narration, creating silent audio");
        return createSilentAudio(outputPath);
    }

    return new Promise(async (resolve, reject) => {
        const voiceName = LANGUAGE_VOICE_MAP[language] || "en-US-ChristopherNeural";
        
        console.log(`🎙️  TTS (Edge Neural): Generating expressive audio for "${narration.substring(0, 40)}..." in ${language} (${voiceName})`);

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

            // Generate directly to file via stream to allow exact file naming
            const { audioStream } = tts.toStream(narration);
            const writeStream = fs.createWriteStream(outputPath);
            
            audioStream.pipe(writeStream);

            writeStream.on("finish", () => {
                if (handled) return;
                handled = true;
                clearTimeout(timer);
                console.log(`✅ TTS: Cinematic audio saved → ${path.basename(outputPath)}`);
                resolve(outputPath);
            });

            writeStream.on("error", (err) => {
                if (handled) return;
                handled = true;
                clearTimeout(timer);
                console.error(`❌ TTS file write error: ${err.message}`);
                console.warn("⚠️  Falling back to silent audio");
                createSilentAudio(outputPath).then(resolve).catch(reject);
            });

            audioStream.on("error", (err) => {
                if (handled) return;
                handled = true;
                clearTimeout(timer);
                console.error(`❌ TTS stream error: ${err.message}`);
                console.warn("⚠️  Falling back to silent audio");
                createSilentAudio(outputPath).then(resolve).catch(reject);
            });
        } catch (err) {
            if (handled) return;
            handled = true;
            clearTimeout(timer);
            console.error(`❌ TTS Edge Neural error: ${err.message}`);
            console.warn("⚠️  Falling back to silent audio");
            createSilentAudio(outputPath).then(resolve).catch(reject);
        }
    });
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
