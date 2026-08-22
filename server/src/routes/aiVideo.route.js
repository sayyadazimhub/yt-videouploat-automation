import { Router } from "express";
import {
    generateStoryController,
    startGenerationController,
    getProjectsController,
    getProjectController,
    getStatusController,
    getVideoController,
    deleteProjectController,
} from "../controller/aiVideo.controller.js";

const router = Router();

// Generate story from prompt (returns story JSON, no video yet)
router.post("/ai-video/story", generateStoryController);

// Start full video generation pipeline in background
router.post("/ai-video/generate", startGenerationController);

// Get list of all completed projects
router.get("/ai-video/projects", getProjectsController);

// Get full project details + story
router.get("/ai-video/:projectId", getProjectController);

// Get current generation status + progress (poll this)
router.get("/ai-video/:projectId/status", getStatusController);

// Get final video URL (only works when status === COMPLETED)
router.get("/ai-video/:projectId/video", getVideoController);

// Delete project files and DB record
router.delete("/ai-video/:projectId", deleteProjectController);

export default router;
