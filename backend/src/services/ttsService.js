import say from "say";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const PROVIDER = process.env.TTS_PROVIDER || "say";

/**
 * Language to OS voice mapping
 */
const LANGUAGE_VOICE_MAP = {
    English: null,          // use OS default
    Hindi: null,            // Windows SAPI: may need Hindi TTS pack
    Marathi: null,          // Windows SAPI: may need Marathi TTS pack
};

/**
 * Generate audio narration for a scene
 * @param {string} narration - Text to speak
 * @param {string} outputPath - Absolute .wav file path
 * @param {string} language - Language name
 * @returns {Promise<string>} outputPath on success
 */
export const generateAudio = async (narration, outputPath, language = "English") => {
    if (!narration || narration.trim().length === 0) {
        console.warn("⚠️  TTS: Empty narration, creating silent audio");
        return createSilentAudio(outputPath);
    }

    switch (PROVIDER) {
        case "say":
            return generateWithSay(narration, outputPath, language);
        case "silent":
            return createSilentAudio(outputPath);
        default:
            console.warn(`⚠️  Unknown TTS_PROVIDER "${PROVIDER}". Using OS TTS.`);
            return generateWithSay(narration, outputPath, language);
    }
};

/**
 * OS native TTS via `say` npm package
 * Windows: SAPI | macOS: say | Linux: espeak
 */
const generateWithSay = (narration, outputPath, language) => {
    return new Promise((resolve, reject) => {
        const voice = LANGUAGE_VOICE_MAP[language] || null;
        const speed = 0.9; // Slightly slower for cinematic narration

        console.log(`🎙️  TTS (say): Generating audio for "${narration.substring(0, 40)}..."`);

        let handled = false;
        const timer = setTimeout(() => {
            if (!handled) {
                handled = true;
                console.warn("⚠️  TTS (say) timed out after 10s. Falling back to silent audio.");
                createSilentAudio(outputPath).then(resolve).catch(reject);
            }
        }, 10000);

        say.export(narration, voice, speed, outputPath, (err) => {
            if (handled) return;
            handled = true;
            clearTimeout(timer);

            if (err) {
                console.error(`❌ TTS say error: ${err.message}`);
                console.warn("⚠️  Falling back to silent audio");
                createSilentAudio(outputPath).then(resolve).catch(reject);
            } else {
                console.log(`✅ TTS: Audio saved → ${path.basename(outputPath)}`);
                resolve(outputPath);
            }
        });
    });
};

/**
 * Creates a minimal silent WAV file
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
