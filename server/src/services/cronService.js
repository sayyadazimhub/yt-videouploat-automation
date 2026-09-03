import cron from "node-cron";
import { generateRandomPrompt, generateStory } from "./geminiService.js";
import { saveStoryFiles } from "./storyService.js";
import { runVideoPipeline } from "./videoService.js";
import { generateProjectId } from "./fileService.js";
import AiVideoProject from "../models/aiVideoProject.model.js";

export const initCronJobs = () => {
    const runGeneration = async (timeLabel) => {
        console.log(`⏰ CRON TRIGGERED: Starting automated video generation (${timeLabel})...`);
        try {
            // 1. Generate a random idea
            const prompt = await generateRandomPrompt();
            console.log(`💡 Auto-generated Prompt: ${prompt}`);

            // 2. Generate the story (using Hindi as requested)
            const language = "Hindi";
            const storyData = await generateStory(prompt, language);
            const storyDuration = storyData.duration || 60;

            // 3. Create project in DB
            const projectId = generateProjectId();
            await AiVideoProject.create({
                _id: projectId,
                user_id: null,
                prompt: prompt,
                language: language,
                duration: storyDuration,
                format: "9:16",
                story_json: JSON.stringify(storyData),
                status: "GENERATING_STORY",
                progress: 5,
                progress_label: "Starting automated video generation pipeline...",
                auto_upload_youtube: true // Automatically upload to YT
            });

            // 4. Save story files to disk
            saveStoryFiles(projectId, storyData);

            // 5. Start pipeline in background
            runVideoPipeline(projectId, storyData).catch((err) => {
                console.error(`❌ Unhandled pipeline error for ${projectId}: ${err.message}`);
            });
            
        } catch (error) {
            console.error(`❌ Cron Job Failed: ${error.message}`);
        }
    };

    // Schedule for 10:30 AM
    cron.schedule("30 10 * * *", () => runGeneration("10:30 AM"), {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    // Schedule for 10:00 PM
    cron.schedule("0 22 * * *", () => runGeneration("10:00 PM"), {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    console.log("⏳ Cron jobs initialized. Scheduled to run at 10:30 AM and 10:00 PM IST.");
};
