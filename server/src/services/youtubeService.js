import { google } from "googleapis";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const getOAuth2Client = () => {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
};

export const getAuthUrl = () => {
    const oauth2Client = getOAuth2Client();
    return oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: [
            "https://www.googleapis.com/auth/youtube.upload",
            "https://www.googleapis.com/auth/youtube.readonly"
        ],
        prompt: "consent" // ensures we get a refresh token
    });
};

export const getTokens = async (code) => {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
};

export const getChannelInfo = async (refreshToken) => {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    
    const response = await youtube.channels.list({
        part: ["snippet"],
        mine: true
    });
    
    if (response.data.items && response.data.items.length > 0) {
        const channel = response.data.items[0];
        return {
            id: channel.id,
            title: channel.snippet.title,
            thumbnail: channel.snippet.thumbnails?.default?.url
        };
    }
    return null;
};

export const uploadVideo = async (refreshToken, videoPath, metadata) => {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    
    const fileSize = fs.statSync(videoPath).size;
    
    const res = await youtube.videos.insert({
        part: "snippet,status,recordingDetails",
        requestBody: {
            snippet: {
                title: metadata.title ? (metadata.title.length > 95 ? metadata.title.substring(0, 95) + "..." : metadata.title) : "AI Generated Short",
                description: metadata.description ? metadata.description.substring(0, 4900) : "",
                tags: metadata.tags ? metadata.tags.slice(0, 15) : [], // Limit number of tags to avoid 500 char limit
            },
            status: {
                privacyStatus: metadata.privacyStatus || "public",
            }
        },
        media: {
            body: fs.createReadStream(videoPath)
        }
    });
    
    return res.data;
};

export const getVideoStatus = async (refreshToken, videoId) => {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    
    const res = await youtube.videos.list({
        part: ["status"],
        id: [videoId]
    });
    
    if (res.data.items && res.data.items.length > 0) {
        return res.data.items[0].status;
    }
    return null;
};

