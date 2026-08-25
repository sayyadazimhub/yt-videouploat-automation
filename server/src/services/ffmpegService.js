import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

dotenv.config();

// Configure FFmpeg path
if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
    console.log(`🎬 FFmpeg: Using custom path → ${process.env.FFMPEG_PATH}`);
} else if (ffmpegInstaller?.path) {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    console.log(`🎬 FFmpeg: Using auto-installer path → ${ffmpegInstaller.path}`);
}

if (ffprobeInstaller?.path) {
    ffmpeg.setFfprobePath(ffprobeInstaller.path);
    console.log(`🎬 FFprobe: Using auto-installer path → ${ffprobeInstaller.path}`);
}

const NARRATION_VOLUME = parseFloat(process.env.NARRATION_VOLUME) || 1.0;
const MUSIC_VOLUME = parseFloat(process.env.MUSIC_VOLUME) || 0.2;

/**
 * Run FFmpeg with a promise wrapper
 */
const runFfmpeg = (command) => {
    return new Promise((resolve, reject) => {
        command
            .on("start", (cmd) => console.log(`▶️  FFmpeg: ${cmd.substring(0, 100)}...`))
            .on("progress", (p) => {
                if (p.percent) process.stdout.write(`\r   Progress: ${Math.round(p.percent)}%`);
            })
            .on("end", () => {
                process.stdout.write("\n");
                resolve();
            })
            .on("error", (err) => {
                process.stdout.write("\n");
                reject(new Error(`FFmpeg error: ${err.message}`));
            })
            .run();
    });
};

/**
 * Build FFmpeg video filter for cinematic image animation
 */
const buildVideoFilter = (effect, duration, width, height) => {
    const d = duration;
    const w = width;
    const h = height;

    const filters = {
        zoom_in: `scale=${w * 2}:${h * 2},zoompan=z='min(zoom+0.0015,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d * 25}:s=${w}x${h}:fps=25`,
        zoom_out: `scale=${w * 2}:${h * 2},zoompan=z='if(lte(zoom,1.0),1.5,max(1.001,zoom-0.0015))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d * 25}:s=${w}x${h}:fps=25`,
        pan_right: `scale=${w * 2}:${h * 2},zoompan=z=1.2:x='(iw-iw/zoom)*on/${d * 25}':y='ih/2-(ih/zoom/2)':d=${d * 25}:s=${w}x${h}:fps=25`,
        pan_left: `scale=${w * 2}:${h * 2},zoompan=z=1.2:x='(iw-iw/zoom)*(1-on/${d * 25})':y='ih/2-(ih/zoom/2)':d=${d * 25}:s=${w}x${h}:fps=25`,
        ken_burns: `scale=${w * 2}:${h * 2},zoompan=z='min(zoom+0.001,1.3)':x='if(lte(on,1),0,(iw-iw/zoom)/2)':y='if(lte(on,1),0,(ih-ih/zoom)/2)':d=${d * 25}:s=${w}x${h}:fps=25`,
    };

    const effectLower = (effect || "").toLowerCase();
    
    if (effectLower.includes("zoom in") || effectLower.includes("crash zoom")) return filters.zoom_in;
    if (effectLower.includes("zoom out") || effectLower.includes("pull back")) return filters.zoom_out;
    if (effectLower.includes("pan right") || effectLower.includes("tracking")) return filters.pan_right;
    if (effectLower.includes("pan left")) return filters.pan_left;
    if (effectLower.includes("pan")) return filters.pan_right; // generic pan

    return filters[effect] || filters.ken_burns;
};

/**
 * Create a silent sub-scene video chunk from a single image
 */
export const createSilentVideoChunk = async (imagePath, duration, outputPath, effect = "zoom_in", width = 1080, height = 1920) => {
    const videoFilter = buildVideoFilter(effect, duration, width, height);

    const command = ffmpeg()
        .input(imagePath)
        .inputOptions(["-loop 1", `-t ${duration}`])
        .complexFilter([
            // Apply cinematic motion to image
            `[0:v]${videoFilter},fade=t=in:st=0:d=0.5,fade=t=out:st=${Math.max(0, duration - 0.5)}:d=0.5[v]`
        ])
        .outputOptions([
            "-map [v]",
            "-c:v libx264",
            "-preset fast",
            "-crf 23",
            "-r 25",
            "-pix_fmt yuv420p",
            `-t ${duration}`,
            "-y",
        ])
        .output(outputPath);

    await runFfmpeg(command);
    console.log(`✅ Silent video chunk created: ${path.basename(outputPath)}`);
    return outputPath;
};

/**
 * Mux audio onto a silent video
 */
export const muxAudio = async (videoPath, audioPath, outputPath, duration) => {
    const command = ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .complexFilter([
            // Ensure audio matches video duration
            `[1:a]apad,atrim=0:${duration}[a]`
        ])
        .outputOptions([
            "-map 0:v",
            "-map [a]",
            "-c:v copy", // Copy video without re-encoding
            "-c:a aac",
            "-b:a 128k",
            "-y"
        ])
        .output(outputPath);

    await runFfmpeg(command);
    console.log(`✅ Audio muxed into video: ${path.basename(outputPath)}`);
    return outputPath;
};

/**
 * Legacy: Create a single scene video from image + audio with cinematic effects
 */
export const createSceneVideo = async (imagePath, audioPath, duration, outputPath, effect = "zoom_in", width = 1080, height = 1920) => {
    const videoFilter = buildVideoFilter(effect, duration, width, height);

    const command = ffmpeg()
        .input(imagePath)
        .inputOptions(["-loop 1", `-t ${duration}`])
        .input(audioPath)
        .complexFilter([
            // Apply cinematic motion to image
            `[0:v]${videoFilter},fade=t=in:st=0:d=0.5,fade=t=out:st=${Math.max(0, duration - 0.5)}:d=0.5[v]`,
            // Ensure audio matches video duration
            `[1:a]apad,atrim=0:${duration}[a]`,
        ])
        .outputOptions([
            "-map [v]",
            "-map [a]",
            "-c:v libx264",
            "-preset fast",
            "-crf 23",
            "-c:a aac",
            "-b:a 128k",
            "-r 25",
            "-pix_fmt yuv420p",
            `-t ${duration}`,
            "-y",
        ])
        .output(outputPath);

    await runFfmpeg(command);
    console.log(`✅ Scene video created: ${path.basename(outputPath)}`);
    return outputPath;
};

/**
 * Concatenate multiple scene MP4 files into one video
 * @param {string[]} sceneVideoPaths - Ordered list of scene video paths
 * @param {string} outputPath - Output concatenated MP4
 */
export const concatenateSceneVideos = async (sceneVideoPaths, outputPath) => {
    if (sceneVideoPaths.length === 0) throw new Error("No scene videos to concatenate");

    if (sceneVideoPaths.length === 1) {
        fs.copyFileSync(sceneVideoPaths[0], outputPath);
        console.log(`✅ Single scene copied as final (no concat needed)`);
        return outputPath;
    }

    // Write concat list file
    const concatListPath = path.join(path.dirname(outputPath), `concat-list-${Date.now()}-${Math.floor(Math.random() * 1000)}.txt`);
    const concatContent = sceneVideoPaths
        .map((p) => `file '${p.replace(/\\/g, "/")}'`)
        .join("\n");
    fs.writeFileSync(concatListPath, concatContent, "utf-8");

    const command = ffmpeg()
        .input(concatListPath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions([
            "-c:v libx264",
            "-preset fast",
            "-crf 23",
            "-c:a aac",
            "-b:a 128k",
            "-pix_fmt yuv420p",
            "-y",
        ])
        .output(outputPath);

    await runFfmpeg(command);

    // Cleanup concat list
    if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);

    console.log(`✅ Scene videos concatenated → ${path.basename(outputPath)}`);
    return outputPath;
};

/**
 * Add background music into final video
 * @param {string} videoPath - Input concatenated video
 * @param {string|null} musicPath - Optional background music MP3
 * @param {string} outputPath - Final output MP4
 */
export const addMusic = async (videoPath, musicPath, outputPath) => {
    const hasMusicFile = musicPath && fs.existsSync(musicPath);

    // If no music, just copy
    if (!hasMusicFile) {
        fs.copyFileSync(videoPath, outputPath);
        console.log(`✅ Final video (no music): ${path.basename(outputPath)}`);
        return outputPath;
    }

    const command = ffmpeg().input(videoPath);

    const outputOptions = ["-c:v libx264", "-preset fast", "-crf 21", "-pix_fmt yuv420p", "-y", "-map 0:v"];
    const complexFilterParts = [];

    // Audio stream handling (mix music + narration, or copy narration)
    command.input(musicPath);
    complexFilterParts.push(
        `[1:a]volume=${MUSIC_VOLUME},aloop=loop=-1:size=2e+09[music]`,
        `[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[audio_out]`
    );
    outputOptions.push("-map [audio_out]", "-c:a aac", "-b:a 192k");

    command.complexFilter(complexFilterParts);
    command.outputOptions(outputOptions).output(outputPath);

    await runFfmpeg(command);
    console.log(`✅ Final video with music: ${path.basename(outputPath)}`);
    return outputPath;
};

/**
 * Concatenate multiple audio files into one
 * @param {string[]} audioPaths - Ordered list of audio file paths
 * @param {string} outputPath - Output concatenated audio path
 */
export const concatenateAudioFiles = async (audioPaths, outputPath) => {
    if (audioPaths.length === 0) throw new Error("No audio files to concatenate");

    if (audioPaths.length === 1) {
        fs.copyFileSync(audioPaths[0], outputPath);
        return outputPath;
    }

    const concatListPath = path.join(path.dirname(outputPath), `concat-audio-${Date.now()}-${Math.floor(Math.random() * 1000)}.txt`);
    const concatContent = audioPaths
        .map((p) => `file '${p.replace(/\\/g, "/")}'`)
        .join("\n");
    fs.writeFileSync(concatListPath, concatContent, "utf-8");

    const command = ffmpeg()
        .input(concatListPath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions([
            "-c:a libmp3lame",
            "-b:a 192k",
            "-y"
        ])
        .output(outputPath);

    await runFfmpeg(command);

    if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);

    console.log(`✅ Audio files concatenated → ${path.basename(outputPath)}`);
    return outputPath;
};

/**
 * Get duration of a media file (video or audio) in seconds
 */
export const getMediaDuration = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) reject(err);
            else resolve(metadata.format.duration || 0);
        });
    });
};
