import AiVideoProject from "../models/aiVideoProject.model.js";
import { generateImage } from "./imageService.js";
import { generateSceneAudio } from "./ttsService.js";
import { buildScenes, getCinematicEffect } from "./sceneService.js";
import {
    createSceneVideo,
    concatenateSceneVideos,
    addMusic,
    getMediaDuration,
} from "./ffmpegService.js";
import {
    createProjectStructure,
    getScenePaths,
    getFinalVideoPath,
    getFinalVideoUrl,
    getMusicPath,
    fileExists,
} from "./fileService.js";

/**
 * Update project status and progress in DB
 */
const updateStatus = async (projectId, status, progress, progressLabel, errorMessage = null) => {
    try {
        const update = { status, progress, progress_label: progressLabel };
        if (errorMessage) update.error_message = errorMessage;
        await AiVideoProject.updateOne({ _id: projectId }, update);
        console.log(`📊 [${projectId.slice(0, 8)}] ${status} (${progress}%) — ${progressLabel}`);
    } catch (err) {
        console.error(`❌ Failed to update project status: ${err.message}`);
    }
};

/**
 * Main video generation pipeline — runs in background (no HTTP blocking)
 * @param {string} projectId
 * @param {Object} storyData - Full story JSON
 */
export const runVideoPipeline = async (projectId, storyData) => {
    const scenes = buildScenes(storyData.scenes, storyData.style, storyData.mood);
    const language = storyData.language || "English";
    const sceneVideoPaths = [];

    // Fetch project to get format
    const project = await AiVideoProject.findById(projectId);
    const format = project?.format || "9:16";
    let videoWidth = 1080;
    let videoHeight = 1920; // Default 9:16 (Shorts/Reels)
    if (format === "16:9") {
        videoWidth = 1920;
        videoHeight = 1080;
    } else if (format === "1:1") {
        videoWidth = 1080;
        videoHeight = 1080;
    }

    try {
        // ── STEP 0: Strict Pre-flight Validation
        await updateStatus(projectId, "VALIDATING", 5, "Validating story JSON strict adherence...");
        
        const totalDuration = scenes.reduce((sum, s) => sum + (s.duration || 15), 0);
        console.log(`🔍 Validation: Expected ~${storyData.duration}s, Actual Scenes Sum = ${totalDuration}s`);
        
        scenes.forEach((scene, i) => {
            if (!scene.narration && (!scene.dialogue || scene.dialogue.length === 0)) {
                throw new Error(`Scene ${i+1} validation failed: Missing both narration and dialogue.`);
            }
            if (!scene.captions || scene.captions.length === 0) {
                console.warn(`⚠️ Scene ${i+1} validation warning: Missing captions.`);
            }
            if (!scene.cameraMovement) {
                console.warn(`⚠️ Scene ${i+1} validation warning: Missing cameraMovement.`);
            }
        });

        // ── STEP 1: Ensure project folder structure exists
        createProjectStructure(projectId);

        // ── STEP 2: Generate images for each scene
        await updateStatus(projectId, "GENERATING_IMAGES", 10, "Generating scene images...");

        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const paths = getScenePaths(projectId, scene.sceneNumber);
            const sceneLabel = `Image ${i + 1}/${scenes.length}`;

            if (fileExists(paths.image)) {
                console.log(`⏭️  Skipping image for scene ${scene.sceneNumber} (already exists)`);
            } else {
                try {
                    await generateImage(scene.visualPrompt, paths.image, videoWidth, videoHeight);
                } catch (imgErr) {
                    console.error(`❌ Image gen failed for scene ${scene.sceneNumber}: ${imgErr.message}`);
                    // Continue — placeholder will be used
                }
            }

            const imageProgress = 10 + Math.round((i + 1) / scenes.length * 20);
            await updateStatus(projectId, "GENERATING_IMAGES", imageProgress, `Generating images: ${sceneLabel}`);
        }

        // ── STEP 3: Generate TTS audio for each scene
        await updateStatus(projectId, "GENERATING_AUDIO", 30, "Generating voice narration...");

        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const paths = getScenePaths(projectId, scene.sceneNumber);
            const sceneLabel = `Audio ${i + 1}/${scenes.length}`;

            if (fileExists(paths.audio)) {
                console.log(`⏭️  Skipping audio for scene ${scene.sceneNumber} (already exists)`);
            } else {
                try {
                    await generateSceneAudio(scene, paths.audio, language, storyData);
                } catch (audioErr) {
                    console.error(`❌ Audio gen failed for scene ${scene.sceneNumber}: ${audioErr.message}`);
                }
            }

            const audioProgress = 30 + Math.round((i + 1) / scenes.length * 20);
            await updateStatus(projectId, "GENERATING_AUDIO", audioProgress, `Generating audio: ${sceneLabel}`);
        }

        // ── STEP 5: Create per-scene video clips
        await updateStatus(projectId, "GENERATING_VIDEO", 55, "Creating scene videos...");

        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const paths = getScenePaths(projectId, scene.sceneNumber);
            // Use requested camera movement, fallback to generic effect if missing
            const effect = scene.cameraMovement || scene.cinematicEffect || getCinematicEffect(i);
            let duration = scene.duration || 15;

            // Verify source files exist
            if (!fileExists(paths.image)) {
                console.warn(`⚠️  Scene ${scene.sceneNumber}: image missing, skipping`);
                continue;
            }
            if (!fileExists(paths.audio)) {
                console.warn(`⚠️  Scene ${scene.sceneNumber}: audio missing, skipping`);
                continue;
            }

            // Dynamically adjust duration to strictly match audio length
            try {
                const audioLen = await getMediaDuration(paths.audio);
                if (audioLen > 0) {
                    // Make scene exactly as long as audio + 0.5s padding (min 3s)
                    duration = Math.max(3, Math.ceil(audioLen * 10) / 10 + 0.5);
                }
            } catch (err) {
                console.warn(`⚠️  Could not probe audio duration for scene ${scene.sceneNumber}`);
            }

            if (fileExists(paths.video)) {
                console.log(`⏭️  Skipping video for scene ${scene.sceneNumber} (already exists)`);
                sceneVideoPaths.push(paths.video);
            } else {
                try {
                    await createSceneVideo(paths.image, paths.audio, duration, paths.video, effect, videoWidth, videoHeight);
                    sceneVideoPaths.push(paths.video);
                } catch (videoErr) {
                    console.error(`❌ Scene video failed for scene ${scene.sceneNumber}: ${videoErr.message}`);
                }
            }

            const videoProgress = 55 + Math.round((i + 1) / scenes.length * 20);
            await updateStatus(
                projectId, "GENERATING_VIDEO", videoProgress,
                `Creating scene videos: ${i + 1}/${scenes.length}`
            );
        }

        if (sceneVideoPaths.length === 0) {
            throw new Error("No scene videos were created. Check FFmpeg installation and source files.");
        }

        // ── STEP 6: Concatenate all scenes
        await updateStatus(projectId, "GENERATING_VIDEO", 76, "Concatenating scenes...");
        const concatPath = getFinalVideoPath(projectId).replace("final-video.mp4", "concat-temp.mp4");
        await concatenateSceneVideos(sceneVideoPaths, concatPath);

        // ── STEP 7: Add music
        await updateStatus(projectId, "GENERATING_VIDEO", 85, "Adding music...");

        const musicMood = scenes[0]?.musicMood || "dramatic";
        const musicPath = getMusicPath(musicMood);
        const finalVideoPath = getFinalVideoPath(projectId);

        if (!musicPath) {
            console.warn("⚠️  No music file found. Proceeding without background music.");
        }

        await addMusic(
            concatPath,
            musicPath,
            finalVideoPath
        );

        // Cleanup temp concat file
        try {
            if (fileExists(concatPath)) {
                const { unlinkSync } = await import("fs");
                unlinkSync(concatPath);
            }
        } catch (_) {}

        // ── STEP 8: Mark as completed
        const videoUrl = getFinalVideoUrl(projectId);
        await AiVideoProject.updateOne(
            { _id: projectId },
            {
                status: "COMPLETED",
                progress: 100,
                progress_label: "Video generation complete!",
                video_path: videoUrl,
            }
        );

        console.log(`🎉 Project ${projectId.slice(0, 8)} completed! → ${videoUrl}`);

    } catch (err) {
        console.error(`❌ Pipeline FAILED for ${projectId}: ${err.message}`);
        await updateStatus(
            projectId,
            "FAILED",
            0,
            "Generation failed",
            err.message
        );
    }
};
