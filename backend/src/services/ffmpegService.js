import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

dotenv.config();

// Configure FFmpeg path
if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
    console.log(`🎬 FFmpeg: Using custom path → ${process.env.FFMPEG_PATH}`);
} else if (ffmpegInstaller?.path) {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    console.log(`🎬 FFmpeg: Using auto-installer path → ${ffmpegInstaller.path}`);
}

const VIDEO_WIDTH = parseInt(process.env.VIDEO_WIDTH) || 1080;
const VIDEO_HEIGHT = parseInt(process.env.VIDEO_HEIGHT) || 1920;
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

    return filters[effect] || filters.zoom_in;
};

/**
 * Create a single scene video from image + audio with cinematic effects
 * @param {string} imagePath - Input image
 * @param {string} audioPath - Input WAV audio
 * @param {number} duration - Scene duration in seconds
 * @param {string} outputPath - Output MP4 path
 * @param {string} effect - Cinematic motion effect name
 */
export const createSceneVideo = async (imagePath, audioPath, duration, outputPath, effect = "zoom_in") => {
    const videoFilter = buildVideoFilter(effect, duration, VIDEO_WIDTH, VIDEO_HEIGHT);

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
    const concatListPath = path.join(path.dirname(outputPath), "concat-list.txt");
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
 * Add background music and burn subtitles into final video
 * @param {string} videoPath - Input concatenated video
 * @param {string|null} musicPath - Optional background music MP3
 * @param {string|null} subtitlePath - Optional SRT subtitle file
 * @param {string} outputPath - Final output MP4
 */
export const addMusicAndSubtitles = async (videoPath, musicPath, subtitlePath, outputPath) => {
    const hasMusicFile = musicPath && fs.existsSync(musicPath);
    const hasSubtitleFile = subtitlePath && fs.existsSync(subtitlePath);

    // If no music and no subtitles, just copy
    if (!hasMusicFile && !hasSubtitleFile) {
        fs.copyFileSync(videoPath, outputPath);
        console.log(`✅ Final video (no music/subtitles): ${path.basename(outputPath)}`);
        return outputPath;
    }

    const command = ffmpeg().input(videoPath);

    const outputOptions = ["-c:v libx264", "-preset fast", "-crf 21", "-pix_fmt yuv420p", "-y"];
    const complexFilterParts = [];

    // Audio stream handling (mix music + narration, or copy narration)
    if (hasMusicFile) {
        command.input(musicPath);
        complexFilterParts.push(
            `[1:a]volume=${MUSIC_VOLUME},aloop=loop=-1:size=2e+09[music]`,
            `[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[audio_out]`
        );
        outputOptions.push("-map [audio_out]", "-c:a aac", "-b:a 192k");
    } else {
        outputOptions.push("-map 0:a", "-c:a aac", "-b:a 192k");
    }

    // Video stream handling (burn subtitles or copy video)
    if (hasSubtitleFile) {
        const escapedSrtPath = subtitlePath
            .replace(/\\/g, "/")
            .replace(/:/g, "\\:");
        const subtitleFilter = `subtitles='${escapedSrtPath}':force_style='FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Shadow=1,MarginV=40,Alignment=2'`;

        complexFilterParts.push(`[0:v]${subtitleFilter}[v_out]`);
        outputOptions.push("-map [v_out]");
    } else {
        outputOptions.push("-map 0:v");
    }

    if (complexFilterParts.length > 0) {
        command.complexFilter(complexFilterParts);
    }

    command.outputOptions(outputOptions).output(outputPath);

    await runFfmpeg(command);
    console.log(`✅ Final video with music/subtitles: ${path.basename(outputPath)}`);
    return outputPath;
};

/**
 * Get duration of a video file in seconds
 */
export const getVideoDuration = (videoPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) reject(err);
            else resolve(metadata.format.duration || 0);
        });
    });
};
