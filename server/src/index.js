import express, { urlencoded } from "express";
import dotenv from "dotenv";
import cors from "cors";
import { dbconnected } from "./config/db.js";
import aiVideoRoute from "./routes/aiVideo.route.js";
import youtubeRoute from "./routes/youtube.route.js";
import AiVideoProject from "./models/aiVideoProject.model.js";
import YoutubeAccount from "./models/youtubeAccount.model.js";
import { runVideoPipeline } from "./services/videoService.js";
import { initCronJobs } from "./services/cronService.js";

dotenv.config();

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(urlencoded({ extended: true }));

app.use(
    cors({
        origin: [process.env.FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"],
        credentials: true,
    })
);

// Serve uploaded files statically
app.use("/uploads", express.static("uploads"));

// Health check
app.get("/", (req, res) => {
    res.json({ message: "AI Video Generator API is running 🎬" });
});

// Routes
app.use("/api", aiVideoRoute);
app.use("/api", youtubeRoute);

// Global error handler
app.use((err, req, res, next) => {
    console.error("❌ Unhandled error:", err.stack);
    res.status(500).json({ success: false, message: "Internal server error" });
});

dbconnected().then(async () => {
    try {
        const stuckProjects = await AiVideoProject.find({
            status: {
                $in: ["GENERATING_STORY", "GENERATING_SCENES", "GENERATING_IMAGES", "GENERATING_AUDIO", "GENERATING_VIDEO"]
            }
        });
        
        if (stuckProjects.length > 0) {
            console.log(`🧹 Cleaning up ${stuckProjects.length} stuck projects...`);
            for (const project of stuckProjects) {
                await AiVideoProject.updateOne({ _id: project._id }, {
                    status: "FAILED",
                    error_message: "Generation was interrupted due to server restart.",
                    progress_label: "Failed (Server Restart)"
                });
            }
        }
    } catch (err) {
        console.error("❌ Failed to clean up stuck projects:", err);
    }
    
    // Initialize scheduled tasks
    initCronJobs();
});

if (process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1") {
    const port = process.env.PORT || 5000;
    app.listen(port, () => {
        console.log(`🚀 Server is running on port ${port}`);
        console.log(`   Health check: http://localhost:${port}/`);
        console.log(`   API base:     http://localhost:${port}/api/ai-video`);
    });
}

export default app;
