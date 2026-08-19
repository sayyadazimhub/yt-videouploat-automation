import { google } from "googleapis";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
        part: ["snippet", "status"],
        requestBody: {
            snippet: {
                title: metadata.title,
                description: metadata.description,
                tags: metadata.tags,
            },
            status: {
                privacyStatus: metadata.privacyStatus || "private",
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

export const generateMetadata = async (prompt) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // using latest 1.5 flash
    
    const sysPrompt = `Generate a compelling YouTube title, description, and up to 10 tags for a video based on this prompt: "${prompt}".
    Return ONLY valid JSON format like this:
    {
      "title": "...",
      "description": "...",
      "tags": ["...", "..."]
    }
    Do not output markdown code blocks. Just raw JSON.`;
    
    const result = await model.generateContent(sysPrompt);
    const text = result.response.text();
    
    try {
        let cleanText = text.trim();
        if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/```(json)?/g, '').trim();
        }
        const startIndex = cleanText.indexOf('{');
        const endIndex = cleanText.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1) {
            cleanText = cleanText.substring(startIndex, endIndex + 1);
        }
        return JSON.parse(cleanText);
    } catch (err) {
        console.error("Failed to parse Gemini output:", text);
        throw new Error("Failed to parse Gemini output as JSON.");
    }
};
