import AiVideoProject from "../models/aiVideoProject.model.js";
import { generateStory } from "../services/geminiService.js";
import { saveStoryFiles, normalizeDurations } from "../services/storyService.js";
import { runVideoPipeline } from "../services/videoService.js";
import { generateProjectId, deleteProjectFiles, getFinalVideoUrl, fileExists, getFinalVideoPath } from "../services/fileService.js";

// ─────────────────────────────────────────────
// POST /api/ai-video/story
// ─────────────────────────────────────────────
export const generateStoryController = async (req, res) => {
    try {
        const { prompt, style, mood, language, duration } = req.body;

        // Input validation
        if (!prompt || prompt.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: "Story prompt must be at least 10 characters long.",
            });
        }

        const validLanguages = ["English", "Hindi", "Marathi"];
        const validDurations = [30, 60, 120, 180];

        const storyStyle = "Storytelling";
        const storyLanguage = validLanguages.includes(language) ? language : "English";
        const storyDuration = validDurations.includes(Number(duration)) ? Number(duration) : 60;
        const storyMood = Array.isArray(mood) ? mood : [mood || "Drama"];

        console.log(`\n🎬 Story generation request: "${prompt.substring(0, 50)}..."`);

        // Generate story via Gemini
        const storyData = await generateStory(
            prompt.trim(),
            storyStyle,
            storyMood,
            storyLanguage,
            storyDuration
        );

        // Create project in DB (no video generation yet)
        const projectId = generateProjectId();
        await AiVideoProject.create({
            _id: projectId,
            user_id: req.user?.id || null,
            prompt: prompt.trim(),
            style: storyStyle,
            mood: storyMood.join(","),
            language: storyLanguage,
            duration: storyDuration,
            format: req.body.format || "9:16",
            story_json: JSON.stringify(storyData),
            status: "PENDING",
            progress: 0,
            progress_label: "Story generated. Ready for video generation.",
        });

        // Save story.json and scene JSONs to disk
        saveStoryFiles(projectId, storyData);

        return res.status(200).json({
            success: true,
            message: "Story generated successfully!",
            data: {
                projectId,
                story: storyData,
            },
        });
    } catch (error) {
        console.error(`❌ generateStory error: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to generate story.",
        });
    }
};

// ─────────────────────────────────────────────
// POST /api/ai-video/generate
// ─────────────────────────────────────────────
export const startGenerationController = async (req, res) => {
    try {
        const { projectId, storyJson, autoUploadToYouTube } = req.body;

        if (!projectId) {
            return res.status(400).json({ success: false, message: "projectId is required." });
        }

        const project = await AiVideoProject.findById(projectId);
        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found." });
        }

        if (project.status === "GENERATING_VIDEO" || project.status === "GENERATING_IMAGES" || project.status === "GENERATING_AUDIO") {
            return res.status(409).json({
                success: false,
                message: "Video generation is already in progress.",
            });
        }

        // Allow using updated story JSON if user edited it
        let storyData;
        try {
            storyData = storyJson ? JSON.parse(storyJson) : JSON.parse(project.story_json);
        } catch (_) {
            return res.status(400).json({ success: false, message: "Invalid story JSON provided." });
        }

        // Update status to generating
        await AiVideoProject.updateOne(
            { _id: projectId },
            {
                status: "GENERATING_STORY",
                progress: 5,
                progress_label: "Starting video generation pipeline...",
                error_message: null,
                video_path: null,
                story_json: JSON.stringify(storyData),
                auto_upload_youtube: autoUploadToYouTube === true
            }
        );

        // Save updated story files
        saveStoryFiles(projectId, storyData);

        // Start background pipeline — DO NOT await (returns immediately)
        runVideoPipeline(projectId, storyData).catch((err) => {
            console.error(`❌ Unhandled pipeline error for ${projectId}: ${err.message}`);
        });

        return res.status(200).json({
            success: true,
            message: "Video generation started! Poll /status for updates.",
            data: { projectId },
        });
    } catch (error) {
        console.error(`❌ startGeneration error: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to start generation.",
        });
    }
};

// ─────────────────────────────────────────────
// GET /api/ai-video/projects
// ─────────────────────────────────────────────
export const getProjectsController = async (req, res) => {
    try {
        const projects = await AiVideoProject.find({ status: "COMPLETED" }).sort({ updatedAt: -1 });

        const formattedProjects = projects.map(p => {
            let storyData = null;
            try {
                if (p.story_json) storyData = JSON.parse(p.story_json);
            } catch (_) {}
            
            return {
                id: p.id,
                title: storyData?.title || "Untitled Video",
                description: storyData?.description || "",
                style: storyData?.style || "",
                duration: storyData?.duration || 0,
                video_path: p.video_path,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
            };
        });

        return res.status(200).json({
            success: true,
            data: formattedProjects,
        });
    } catch (error) {
        console.error(`❌ getProjects error: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch projects.",
        });
    }
};

// ─────────────────────────────────────────────
// GET /api/ai-video/:projectId
// ─────────────────────────────────────────────
export const getProjectController = async (req, res) => {
    try {
        const { projectId } = req.params;
        const project = await AiVideoProject.findById(projectId);

        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found." });
        }

        let storyData = null;
        try {
            if (project.story_json) storyData = JSON.parse(project.story_json);
        } catch (_) {}

        return res.status(200).json({
            success: true,
            data: {
                id: project.id,
                prompt: project.prompt,
                style: project.style,
                mood: project.mood,
                language: project.language,
                duration: project.duration,
                format: project.format,
                status: project.status,
                progress: project.progress,
                progressLabel: project.progress_label,
                videoPath: project.video_path,
                errorMessage: project.error_message,
                story: storyData,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
            },
        });
    } catch (error) {
        console.error(`❌ getProject error: ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch project." });
    }
};

// ─────────────────────────────────────────────
// GET /api/ai-video/:projectId/status
// ─────────────────────────────────────────────
export const getStatusController = async (req, res) => {
    try {
        const { projectId } = req.params;
        const project = await AiVideoProject.findById(projectId).select("id status progress progress_label video_path error_message youtube_status youtube_url updatedAt");

        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found." });
        }

        return res.status(200).json({
            success: true,
            data: {
                id: project.id,
                status: project.status,
                progress: project.progress,
                progressLabel: project.progress_label,
                videoPath: project.video_path,
                errorMessage: project.error_message,
                youtubeStatus: project.youtube_status,
                youtubeUrl: project.youtube_url,
                updatedAt: project.updatedAt,
            },
        });
    } catch (error) {
        console.error(`❌ getStatus error: ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch status." });
    }
};

// ─────────────────────────────────────────────
// GET /api/ai-video/:projectId/video
// ─────────────────────────────────────────────
export const getVideoController = async (req, res) => {
    try {
        const { projectId } = req.params;
        const project = await AiVideoProject.findById(projectId).select("id status video_path");

        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found." });
        }

        if (project.status !== "COMPLETED" || !project.video_path) {
            return res.status(400).json({
                success: false,
                message: "Video is not ready yet.",
                status: project.status,
            });
        }

        const isAbsolute = project.video_path.startsWith('http');
        return res.status(200).json({
            success: true,
            data: {
                videoUrl: project.video_path,
                fullUrl: isAbsolute ? project.video_path : `${process.env.BACKEND_URL}${project.video_path}`,
            },
        });
    } catch (error) {
        console.error(`❌ getVideo error: ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to get video." });
    }
};

// ─────────────────────────────────────────────
// DELETE /api/ai-video/:projectId
// ─────────────────────────────────────────────
export const deleteProjectController = async (req, res) => {
    try {
        const { projectId } = req.params;
        const project = await AiVideoProject.findById(projectId);

        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found." });
        }

        // Delete files from disk
        deleteProjectFiles(projectId);

        // Delete from database
        await AiVideoProject.findByIdAndDelete(projectId);

        return res.status(200).json({
            success: true,
            message: "Project deleted successfully.",
        });
    } catch (error) {
        console.error(`❌ deleteProject error: ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to delete project." });
    }
};
