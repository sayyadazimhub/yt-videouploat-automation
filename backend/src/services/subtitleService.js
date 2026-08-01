import fs from "fs";

/**
 * Format seconds to SRT timestamp format: HH:MM:SS,mmm
 */
const toSrtTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const ms = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);

    return [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(seconds).padStart(2, "0"),
    ].join(":") + `,${String(ms).padStart(3, "0")}`;
};

/**
 * Break long narration text into subtitle chunks (max ~10 words per line)
 */
const chunkText = (text, wordsPerChunk = 8) => {
    const words = text.split(" ").filter(Boolean);
    const chunks = [];
    for (let i = 0; i < words.length; i += wordsPerChunk) {
        chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
    }
    return chunks.length > 0 ? chunks : [text];
};

/**
 * Generate SRT subtitle content from scenes
 * @param {Array} scenes - Scene objects with narration and duration
 * @returns {string} SRT file content
 */
export const generateSrtContent = (scenes) => {
    let srtContent = "";
    let subtitleIndex = 1;
    let currentTime = 0;

    for (const scene of scenes) {
        const sceneDuration = scene.duration || 10;
        const narration = scene.narration || "";

        if (!narration.trim()) {
            currentTime += sceneDuration;
            continue;
        }

        const chunks = chunkText(narration, 8);
        const chunkDuration = sceneDuration / chunks.length;

        for (let i = 0; i < chunks.length; i++) {
            const startTime = currentTime + i * chunkDuration;
            const endTime = startTime + chunkDuration - 0.1; // slight gap

            srtContent += `${subtitleIndex}\n`;
            srtContent += `${toSrtTime(startTime)} --> ${toSrtTime(endTime)}\n`;
            srtContent += `${chunks[i]}\n\n`;

            subtitleIndex++;
        }

        currentTime += sceneDuration;
    }

    return srtContent;
};

/**
 * Save SRT content to file
 * @param {string} srtContent
 * @param {string} outputPath
 */
export const saveSrt = (srtContent, outputPath) => {
    fs.writeFileSync(outputPath, srtContent, "utf-8");
    console.log(`📝 Subtitles saved: ${outputPath}`);
    return outputPath;
};

/**
 * Generate and save subtitles in one step
 * @param {Array} scenes
 * @param {string} outputPath
 */
export const generateSubtitles = (scenes, outputPath) => {
    const content = generateSrtContent(scenes);
    return saveSrt(content, outputPath);
};
