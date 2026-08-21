import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const BASE_UPLOADS = path.join(process.cwd(), "uploads", "projects");

/** Generate a new unique project ID */
export const generateProjectId = () => uuidv4();

/** Create full folder structure for a project */
export const createProjectStructure = (projectId) => {
    const projectDir = getProjectDir(projectId);
    const dirs = [
        projectDir,
        path.join(projectDir, "scenes"),
        path.join(projectDir, "images"),
        path.join(projectDir, "audio"),
        path.join(projectDir, "scenes-video"),
    ];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
    return projectDir;
};

/** Absolute path to a project directory */
export const getProjectDir = (projectId) => {
    const safe = sanitizeId(projectId);
    return path.join(BASE_UPLOADS, safe);
};

/** Format scene number as 3-digit string */
export const formatSceneNumber = (num) => String(num).padStart(3, "0");

/** All file paths for a given scene */
export const getScenePaths = (projectId, sceneNumber) => {
    const num = formatSceneNumber(sceneNumber);
    const base = getProjectDir(projectId);
    return {
        json: path.join(base, "scenes", `scene-${num}.json`),
        image: path.join(base, "images", `scene-${num}.png`),
        audio: path.join(base, "audio", `scene-${num}.mp3`),
        video: path.join(base, "scenes-video", `scene-${num}.mp4`),
    };
};

export const getStoryPath = (projectId) =>
    path.join(getProjectDir(projectId), "story.json");

export const getFinalVideoPath = (projectId) =>
    path.join(getProjectDir(projectId), "final-video.mp4");

export const getFinalVideoUrl = (projectId) => {
    const safe = sanitizeId(projectId);
    return `/uploads/projects/${safe}/final-video.mp4`;
};

export const saveJson = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
};

export const readJson = (filePath) => {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
};

export const fileExists = (filePath) => fs.existsSync(filePath);

/** Delete a project and all its files */
export const deleteProjectFiles = (projectId) => {
    const projectDir = getProjectDir(projectId);
    if (fs.existsSync(projectDir)) {
        fs.rmSync(projectDir, { recursive: true, force: true });
    }
};

/** Return path to background music based on mood string */
export const getMusicPath = (musicMood) => {
    const assetsDir = path.join(process.cwd(), "assets", "music");
    const moodMap = {
        suspense: "suspense.mp3",
        dark: "suspense.mp3",
        thriller: "suspense.mp3",
        mystery: "suspense.mp3",
        drama: "dramatic.mp3",
        dramatic: "dramatic.mp3",
        action: "dramatic.mp3",
        horror: "suspense.mp3",
        emotional: "emotional.mp3",
        romantic: "emotional.mp3",
        sad: "emotional.mp3",
        comedy: "comedy.mp3",
        fun: "comedy.mp3",
        happy: "comedy.mp3",
    };
    const key = (musicMood || "").toLowerCase();
    const fileName = moodMap[key] || "dramatic.mp3";
    const fullPath = path.join(assetsDir, fileName);
    return fs.existsSync(fullPath) ? fullPath : null;
};

/** Sanitize project ID to prevent path traversal */
const sanitizeId = (id) => {
    if (!id || typeof id !== "string") throw new Error("Invalid project ID");
    const sanitized = id.replace(/[^a-zA-Z0-9\-]/g, "");
    if (sanitized.length < 8) throw new Error("Invalid project ID format");
    return sanitized;
};
