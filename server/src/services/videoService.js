import AiVideoProject from "../models/aiVideoProject.model.js";
import { generateImage } from "./imageService.js";
import { generateSceneAudio } from "./ttsService.js";
import { buildScenes, getCinematicEffect } from "./sceneService.js";
import {
    createSceneVideo,
    concatenateSceneVideos,
    addMusic,
    getMediaDuration,
    createSilentVideoChunk,
    muxAudio,
} from "./ffmpegService.js";
import {
    createProjectStructure,
    getScenePaths,
    getSubScenePaths,
    getFinalVideoPath,
    getMusicPath,
    fileExists,
    deleteProjectFiles,
} from "./fileService.js";
import { uploadToCloudinary } from "./cloudinaryService.js";
import { unlinkSync } from "fs";

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
    let sceneVideoPaths = [];

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
            if ((!scene.narration || scene.narration.length === 0) && (!scene.dialogue || scene.dialogue.length === 0)) {
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

        // ── STEP 2: Generate images for each scene sequentially — prevents HTTP 429 errors
        await updateStatus(projectId, "GENERATING_IMAGES", 10, "Generating scene images...");
        let completedImages = 0;
        const totalExpectedImages = scenes.reduce((acc, s) => acc + (s.visualBeats?.length || 1), 0);

        for (const scene of scenes) {
            const numBeats = scene.visualBeats?.length || 1;
            for (let i = 0; i < numBeats; i++) {
                const subPaths = getSubScenePaths(projectId, scene.sceneNumber, i);
                const beatText = scene.visualBeats ? scene.visualBeats[i] : "";
                const finalPrompt = beatText ? `${scene.visualPrompt}, focusing on: ${beatText}` : scene.visualPrompt;

                if (fileExists(subPaths.image)) {
                    console.log(`⏭️  Skipping image for scene ${scene.sceneNumber} beat ${i} (already exists)`);
                } else {
                    try {
                        await generateImage(finalPrompt, subPaths.image, videoWidth, videoHeight);
                        // Add a small 2-second delay between sequential requests to respect free tier limits
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (imgErr) {
                        console.error(`❌ Image gen failed for scene ${scene.sceneNumber} beat ${i}: ${imgErr.message}`);
                        throw new Error(`Failed to generate image for scene ${scene.sceneNumber} beat ${i}`);
                    }
                }
                
                completedImages++;
                const imageProgress = 10 + Math.round((completedImages / totalExpectedImages) * 20); // 10 to 30
                await updateStatus(projectId, "GENERATING_IMAGES", imageProgress, `Generating images: ${completedImages}/${totalExpectedImages}`);
            }
        }

        // ── STEP 3: Generate TTS audio for each scene concurrently
        await updateStatus(projectId, "GENERATING_AUDIO", 30, "Generating voice narration...");
        let completedAudio = 0;

        const audioPromises = scenes.map(async (scene, i) => {
            const paths = getScenePaths(projectId, scene.sceneNumber);
            if (fileExists(paths.audio)) {
                console.log(`⏭️  Skipping audio for scene ${scene.sceneNumber} (already exists)`);
            } else {
                try {
                    await generateSceneAudio(scene, paths.audio, language, storyData);
                } catch (audioErr) {
                    console.error(`❌ Audio gen failed for scene ${scene.sceneNumber}: ${audioErr.message}`);
                    throw new Error(`Failed to generate audio for scene ${scene.sceneNumber}`);
                }
            }
            
            completedAudio++;
            const audioProgress = 30 + Math.round((completedAudio / scenes.length) * 20); // 30 to 50
            await updateStatus(projectId, "GENERATING_AUDIO", audioProgress, `Generating audio: ${completedAudio}/${scenes.length}`);
        });

        await Promise.all(audioPromises);

        // ── STEP 4: Create per-scene video clips concurrently
        await updateStatus(projectId, "GENERATING_VIDEO", 50, "Creating scene videos...");
        let completedVideos = 0;

        const videoPromises = scenes.map(async (scene, i) => {
            const paths = getScenePaths(projectId, scene.sceneNumber);
            const numBeats = scene.visualBeats?.length || 1;
            let duration = scene.duration || 15;

            // Verify audio exists
            if (!fileExists(paths.audio)) {
                throw new Error(`Audio missing for scene ${scene.sceneNumber}`);
            }

            // Dynamically adjust total duration to strictly match audio length
            try {
                const audioLen = await getMediaDuration(paths.audio);
                if (audioLen > 0) {
                    duration = Math.max(3, Math.ceil(audioLen * 10) / 10 + 0.5);
                }
            } catch (err) {
                console.error(`❌ Could not probe audio duration for scene ${scene.sceneNumber}: ${err.message}`);
            }

            const beatDuration = duration / numBeats;
            const chunkPaths = [];

            if (fileExists(paths.video)) {
                console.log(`⏭️  Skipping video for scene ${scene.sceneNumber} (already exists)`);
            } else {
                try {
                    // Create sub-scene silent chunks
                    for (let j = 0; j < numBeats; j++) {
                        const subPaths = getSubScenePaths(projectId, scene.sceneNumber, j);
                        if (!fileExists(subPaths.image)) {
                            throw new Error(`Image missing for scene ${scene.sceneNumber} beat ${j}`);
                        }
                        // Alternate cinematic effects randomly for sub-beats
                        const effects = ["zoom_in", "zoom_out", "pan_right", "pan_left", "ken_burns"];
                        const beatEffect = effects[Math.floor(Math.random() * effects.length)];
                        
                        await createSilentVideoChunk(subPaths.image, beatDuration, subPaths.video, beatEffect, videoWidth, videoHeight);
                        chunkPaths.push(subPaths.video);
                    }

                    // Concatenate all silent chunks into one video_only file
                    await concatenateSceneVideos(chunkPaths, paths.videoOnly);

                    // Mux the full scene audio onto the concatenated video
                    await muxAudio(paths.videoOnly, paths.audio, paths.video, duration);

                    // Cleanup chunks and videoOnly
                    chunkPaths.push(paths.videoOnly);
                    chunkPaths.forEach(p => {
                        try {
                            if (fileExists(p)) unlinkSync(p);
                        } catch (e) {
                            console.warn(`⚠️ Could not delete temp file ${p}: ${e.message}`);
                        }
                    });

                } catch (videoErr) {
                    console.error(`❌ Scene video failed for scene ${scene.sceneNumber}: ${videoErr.message}`);
                    throw new Error(`Failed to create video for scene ${scene.sceneNumber}`);
                }
            }
            
            completedVideos++;
            const videoProgress = 50 + Math.round((completedVideos / scenes.length) * 25); // 50 to 75
            await updateStatus(projectId, "GENERATING_VIDEO", videoProgress, `Creating scene videos: ${completedVideos}/${scenes.length}`);
            
            return paths.video; // Return path so we can maintain order
        });

        // Resolve all video creations concurrently and keep the paths ordered
        sceneVideoPaths = await Promise.all(videoPromises);

        if (sceneVideoPaths.length === 0) {
            throw new Error("No scene videos were created. Check FFmpeg installation and source files.");
        }

        // ── STEP 5: Concatenate all scenes
        await updateStatus(projectId, "GENERATING_VIDEO", 75, "Concatenating scenes...");
        const concatPath = getFinalVideoPath(projectId).replace("final-video.mp4", "concat-temp.mp4");
        await concatenateSceneVideos(sceneVideoPaths, concatPath);

        // ── STEP 6: Add music
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
                unlinkSync(concatPath);
            }
        } catch (_) {}

        // ── STEP 7: Upload to Cloudinary and mark as completed
        await updateStatus(projectId, "GENERATING_VIDEO", 95, "Uploading to Cloudinary...");
        let videoUrl;
        try {
            const folderName = `projects/${projectId}`;
            videoUrl = await uploadToCloudinary(finalVideoPath, folderName);
        } catch (uploadErr) {
            console.error(`❌ Cloudinary Upload failed for ${projectId}: ${uploadErr.message}`);
            throw new Error(`Upload to cloud storage failed: ${uploadErr.message}`);
        }

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

        // Clean up local files now that it's in Cloudinary
        try {
            deleteProjectFiles(projectId);
            console.log(`🧹 Cleaned up local files for ${projectId}`);
        } catch (_) {}

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
