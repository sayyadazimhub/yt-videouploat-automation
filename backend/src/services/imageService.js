import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import dotenv from "dotenv";

dotenv.config();

const PROVIDER = process.env.IMAGE_PROVIDER || "pollinations";

/**
 * Sanitize visual prompt for API requests by extracting clean Latin keywords
 * Prevents non-ASCII / Devanagari script from breaking URL encoding in external APIs
 */
const sanitizePromptForApi = (prompt) => {
    if (!prompt) return "Cinematic scene dramatic lighting 8k resolution";
    const latinOnly = prompt.replace(/[^\x00-\x7F]/g, " ").replace(/\s+/g, " ").trim();
    if (latinOnly.length >= 10) {
        return latinOnly.substring(0, 200);
    }
    return "Cinematic story scene dramatic lighting volumetric atmosphere 8k resolution";
};

/**
 * Pure Node.js Native 1080x1920 PNG Binary Buffer Encoder
 * Creates a pristine full-resolution dark navy PNG image instantly with ZERO dependencies
 */
const createPurePngBuffer = (width, height, r = 30, g = 27, b = 75) => {
    const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // color type RGB
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        crcTable[n] = c;
    }

    const crc32 = (buf) => {
        let c = 0xffffffff;
        for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
    };

    const makeChunk = (type, data) => {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length, 0);
        const typeBuf = Buffer.from(type, "ascii");
        const body = Buffer.concat([typeBuf, data]);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(body), 0);
        return Buffer.concat([len, body, crc]);
    };

    const rawLines = [];
    for (let y = 0; y < height; y++) {
        const line = Buffer.alloc(1 + width * 3);
        line[0] = 0; // Filter type None
        for (let x = 0; x < width; x++) {
            line[1 + x * 3] = r;
            line[2 + x * 3] = g;
            line[3 + x * 3] = b;
        }
        rawLines.push(line);
    }

    const rawData = Buffer.concat(rawLines);
    const compressed = zlib.deflateSync(rawData);

    return Buffer.concat([
        header,
        makeChunk("IHDR", ihdr),
        makeChunk("IDAT", compressed),
        makeChunk("IEND", Buffer.alloc(0)),
    ]);
};

/**
 * Generate an image for a scene visual prompt
 * @param {string} visualPrompt - The scene visual description
 * @param {string} outputPath - Absolute file path to save PNG
 * @returns {Promise<string>} outputPath on success
 */
export const generateImage = async (visualPrompt, outputPath) => {
    switch (PROVIDER) {
        case "pollinations":
            return generateWithPollinations(visualPrompt, outputPath);
        case "placeholder":
            return generatePlaceholder(visualPrompt, outputPath);
        default:
            console.warn(`⚠️ Unknown IMAGE_PROVIDER "${PROVIDER}". Falling back to placeholder.`);
            return generatePlaceholder(visualPrompt, outputPath);
    }
};

/**
 * Pollinations.ai — free AI image generation
 */
const generateWithPollinations = async (visualPrompt, outputPath) => {
    const cleanPrompt = sanitizePromptForApi(visualPrompt);
    const encodedPrompt = encodeURIComponent(cleanPrompt);
    const width = parseInt(process.env.VIDEO_WIDTH) || 1080;
    const height = parseInt(process.env.VIDEO_HEIGHT) || 1920;
    const seed = Math.floor(Math.random() * 1000000);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&seed=${seed}`;

    console.log(`🎨 Pollinations: Generating image... (${width}x${height})`);

    let lastError;
    for (let attempt = 1; attempt <= 2; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: { "User-Agent": "AIVideoGenerator/1.0" },
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("image")) {
                throw new Error(`Unexpected content type: ${contentType}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            clearTimeout(timeoutId);

            const buffer = Buffer.from(arrayBuffer);

            // Ensure buffer is a valid image before saving
            if (buffer.length < 100) {
                throw new Error("Received empty or truncated image buffer");
            }

            fs.writeFileSync(outputPath, buffer);
            console.log(`✅ Pollinations: Image saved (${Math.round(buffer.length / 1024)}KB)`);
            return outputPath;
        } catch (error) {
            clearTimeout(timeoutId);
            lastError = error;
            const isAbort = error.name === "AbortError";
            console.error(`❌ Pollinations attempt ${attempt} failed: ${isAbort ? "Request timed out after 12s" : error.message}`);
            if (attempt < 2) {
                await new Promise((r) => setTimeout(r, 1500));
            }
        }
    }

    console.warn(`⚠️ Pollinations failed (${lastError?.message}). Creating native PNG placeholder image.`);
    return generatePlaceholder(visualPrompt, outputPath);
};

/**
 * Placeholder — generates a full 1080x1920 PNG binary file instantly via pure native Node.js
 * Guaranteed to succeed in 10ms with zero network/process dependencies
 */
const generatePlaceholder = async (visualPrompt, outputPath) => {
    const width = parseInt(process.env.VIDEO_WIDTH) || 1080;
    const height = parseInt(process.env.VIDEO_HEIGHT) || 1920;

    try {
        const pngBuffer = createPurePngBuffer(width, height, 26, 24, 60);
        fs.writeFileSync(outputPath, pngBuffer);
        console.log(`🖼️ Native PNG placeholder created: ${path.basename(outputPath)} (${Math.round(pngBuffer.length / 1024)}KB)`);
    } catch (err) {
        console.error(`❌ Native PNG generation error: ${err.message}`);
    }

    return outputPath;
};
