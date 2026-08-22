import YoutubeAccount from "../models/youtubeAccount.model.js";
import AiVideoProject from "../models/aiVideoProject.model.js";
import { getAuthUrl, getTokens, getChannelInfo, uploadVideo, generateMetadata, getVideoStatus } from "../services/youtubeService.js";
import fs from "fs";
import path from "path";

// In a real multi-user app, this would come from req.user.id
const HARDCODED_USER_ID = 1;

export const authController = (req, res) => {
    try {
        const url = getAuthUrl();
        res.redirect(url);
    } catch (error) {
        console.error("❌ YouTube Auth error:", error);
        res.status(500).json({ success: false, message: "Failed to generate auth URL." });
    }
};

export const callbackController = async (req, res) => {
    try {
        const code = req.query.code;
        if (!code) {
            return res.status(400).send("No authorization code provided.");
        }

        const tokens = await getTokens(code);
        if (!tokens.refresh_token) {
            // Already authorized, perhaps? Need refresh token.
            return res.redirect("http://localhost:3000/gallery?youtubeError=NoRefreshToken");
        }

        const channelInfo = await getChannelInfo(tokens.refresh_token);
        if (!channelInfo) {
            return res.redirect("http://localhost:3000/gallery?youtubeError=NoChannel");
        }

        // Save to DB
        let account = await YoutubeAccount.findOne({ user_id: HARDCODED_USER_ID });
        if (account) {
            await YoutubeAccount.updateOne({ _id: account._id }, {
                channel_id: channelInfo.id,
                channel_title: channelInfo.title,
                refresh_token: tokens.refresh_token
            });
        } else {
            await YoutubeAccount.create({
                user_id: HARDCODED_USER_ID,
                channel_id: channelInfo.id,
                channel_title: channelInfo.title,
                refresh_token: tokens.refresh_token
            });
        }

        // Close window or redirect
        res.send(`
            <script>
                if (window.opener) {
                    window.opener.postMessage("youtube_connected", "*");
                    window.close();
                } else {
                    window.location.href = "http://localhost:3000";
                }
            </script>
        `);
    } catch (error) {
        console.error("❌ YouTube Callback error:", error);
        res.status(500).send("Failed to complete YouTube authentication.");
    }
};

export const getStatusController = async (req, res) => {
    try {
        const account = await YoutubeAccount.findOne({ user_id: HARDCODED_USER_ID });
        if (!account) {
            return res.json({ connected: false });
        }

        // Try getting channel info to verify token
        try {
            const channelInfo = await getChannelInfo(account.refresh_token);
            if (channelInfo) {
                return res.json({
                    connected: true,
                    channel: channelInfo
                });
            }
        } catch (e) {
            // Token might be revoked or expired
            return res.json({ connected: false });
        }
        
        return res.json({ connected: false });
    } catch (error) {
        console.error("❌ YouTube Status error:", error);
        res.status(500).json({ success: false, message: "Failed to check YouTube status." });
    }
};

export const disconnectController = async (req, res) => {
    try {
        await YoutubeAccount.deleteOne({ user_id: HARDCODED_USER_ID });
        res.json({ success: true });
    } catch (error) {
        console.error("❌ YouTube Disconnect error:", error);
        res.status(500).json({ success: false, message: "Failed to disconnect YouTube." });
    }
};

export const generateMetadataController = async (req, res) => {
    try {
        const { projectId } = req.body;
        
        const project = await AiVideoProject.findById(projectId);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        const metadata = await generateMetadata(project.prompt);
        res.json({ success: true, metadata });
    } catch (error) {
        console.error("❌ Generate Metadata error:", error);
        res.status(500).json({ success: false, message: "Failed to generate metadata." });
    }
};

export const uploadController = async (req, res) => {
    try {
        const { projectId, title, description, tags, privacyStatus } = req.body;
        
        const project = await AiVideoProject.findById(projectId);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });
        const videoFilePath = path.join(process.cwd(), project.video_path.startsWith('/') ? project.video_path.slice(1) : project.video_path);

        if (!project.video_path || !fs.existsSync(videoFilePath)) {
            return res.status(400).json({ success: false, message: "Video file not found: " + videoFilePath });
        }

        const account = await YoutubeAccount.findOne({ user_id: HARDCODED_USER_ID });
        if (!account) {
            return res.status(400).json({ success: false, message: "YouTube account is not connected." });
        }

        // Start upload process (we'll await it, though for huge files we might want to do it in background)
        // Since we need to update the status and progress, we can do it asynchronously and return immediately.
        
        // Update project status to UPLOADING
        await AiVideoProject.updateOne({ _id: project._id }, {
            youtube_status: "UPLOADING",
            youtube_title: title,
            youtube_description: description,
            youtube_privacy_status: privacyStatus
        });

        // Background task
        uploadVideo(account.refresh_token, videoFilePath, { title, description, tags, privacyStatus })
            .then(async (result) => {
                await AiVideoProject.updateOne({ _id: project._id }, {
                    youtube_video_id: result.id,
                    youtube_url: `https://www.youtube.com/watch?v=${result.id}`,
                    youtube_status: "COMPLETED",
                    youtube_uploaded_at: new Date()
                });
            })
            .catch(async (error) => {
                console.error("❌ Background Upload error:", error);
                await AiVideoProject.updateOne({ _id: project._id }, {
                    youtube_status: "FAILED",
                    error_message: "YouTube upload failed: " + error.message
                });
            });

        res.json({
            success: true,
            message: "Upload started successfully",
            status: "UPLOADING"
        });
    } catch (error) {
        console.error("❌ YouTube Upload error:", error);
        res.status(500).json({ success: false, message: "Failed to start upload." });
    }
};

export const getUploadStatusController = async (req, res) => {
    try {
        const { projectId } = req.params;
        const project = await AiVideoProject.findById(projectId);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        res.json({
            success: true,
            status: project.youtube_status,
            videoId: project.youtube_video_id,
            url: project.youtube_url,
            errorMessage: project.youtube_status === "FAILED" ? project.error_message : null
        });
    } catch (error) {
        console.error("❌ Upload Status error:", error);
        res.status(500).json({ success: false, message: "Failed to get upload status." });
    }
};
