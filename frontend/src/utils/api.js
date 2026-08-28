import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 120000, // 2 min — Gemini + image gen can be slow
});

// ── AI Video APIs ──────────────────────────────────────────

/** Generate story JSON from user prompt (Step 1) */
export const generateStory = (data) =>
  api.post("/ai-video/story", data);

/** Start full video generation pipeline (Step 2) */
export const startVideoGeneration = (projectId, storyJson, autoUploadToYouTube = false) =>
  api.post("/ai-video/generate", { projectId, storyJson, autoUploadToYouTube });

/** Get list of all completed projects */
export const getProjects = () =>
  api.get("/ai-video/projects");

/** Get full project details including story JSON */
export const getProject = (projectId) =>
  api.get(`/ai-video/${projectId}`);

/** Get live generation status + progress (poll this every 3s) */
export const getProjectStatus = (projectId) =>
  api.get(`/ai-video/${projectId}/status`);

/** Get the final video URL (only when COMPLETED) */
export const getVideoUrl = (projectId) =>
  api.get(`/ai-video/${projectId}/video`);

/** Delete a project and all its files */
export const deleteProject = (projectId) =>
  api.delete(`/ai-video/${projectId}`);

// ── Helper ────────────────────────────────────────────────

/** Build full URL for a video or image file served from backend */
export const getMediaUrl = (relativePath) => {
  if (!relativePath) return "";
  if (relativePath.startsWith('http')) return relativePath;
  return `${API_URL}${relativePath}`;
};

// ── YouTube APIs ──────────────────────────────────────────

export const getYouTubeStatus = () =>
  api.get("/youtube/status");

export const disconnectYouTube = () =>
  api.post("/youtube/disconnect");

export const generateYouTubeMetadata = (projectId) =>
  api.post("/youtube/metadata", { projectId });

export const uploadToYouTube = (data) =>
  api.post("/youtube/upload", data);

export const getYouTubeUploadStatus = (projectId) =>
  api.get(`/youtube/upload-status/${projectId}`);

export default api;
