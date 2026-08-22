"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import {
  generateStory,
  startVideoGeneration,
  getProjectStatus,
  getMediaUrl,
  deleteProject,
} from "../../utils/api";
import YouTubeSection from "../../components/youtube/YouTubeSection";
import {
  Film,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Play,
  Download,
  Edit3,
  CheckCircle2,
  Loader2,
  Circle,
  Clock,
  Eye,
  Trash2,
  AlertCircle,
  Clapperboard,
  Music,
  Mic,
  ImageIcon,
  Video,
  Layers,
  Zap,
  X,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────

const STYLES = ["Cinematic", "Documentary", "Short Film", "Anime", "Storytelling", "Thriller"];
const MOODS = ["Suspense", "Drama", "Action", "Comedy", "Mystery", "Emotional", "Horror", "Romantic"];
const DURATIONS = [
  { label: "1 min", value: 60 },
  { label: "2 min", value: 120 },
  { label: "3 min", value: 180 },
];
const LANGUAGES = ["Hindi", "English", "Marathi"];
const FORMATS = [
  { label: "9:16 Shorts", sub: "1080×1920 • Reels / Shorts", value: "9:16" },
  { label: "16:9 Landscape", sub: "1920×1080 • YouTube", value: "16:9" },
];

const PIPELINE_STEPS = [
  { key: "PENDING", label: "Preparing", icon: Zap },
  { key: "GENERATING_STORY", label: "Writing Story", icon: Sparkles },
  { key: "GENERATING_SCENES", label: "Building Scenes", icon: Layers },
  { key: "GENERATING_IMAGES", label: "Generating Images", icon: ImageIcon },
  { key: "GENERATING_AUDIO", label: "Creating Narration", icon: Mic },
  { key: "GENERATING_VIDEO", label: "Rendering Video", icon: Video },
  { key: "COMPLETED", label: "Video Ready!", icon: CheckCircle2 },
];

const STATUS_ORDER = {
  PENDING: 0,
  GENERATING_STORY: 1,
  GENERATING_SCENES: 2,
  GENERATING_IMAGES: 3,
  GENERATING_AUDIO: 4,
  GENERATING_VIDEO: 5,
  COMPLETED: 6,
  FAILED: -1,
};

// ── Sub-components ────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <label className="block text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">
      {children}
    </label>
  );
}

function PrimaryButton({ onClick, disabled, loading, children, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] text-white font-extrabold rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none ${className}`}
    >
      {loading && <Loader2 size={18} className="animate-spin" />}
      {children}
    </button>
  );
}

function OutlineButton({ onClick, disabled, children, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2.5 px-6 py-3.5 bg-transparent border border-[#333] text-slate-300 font-bold rounded-xl transition-all duration-300 hover:border-[#06b6d4]/60 hover:text-white hover:bg-[#06b6d4]/5 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

function SceneCard({ scene, index }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#141414]/80 backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-[#06b6d4]/30 hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#1a1a1a]/90 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#06b6d4]/20 to-transparent border border-[#06b6d4]/30 flex items-center justify-center text-[#06b6d4] text-sm font-black flex-shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
            {scene.sceneNumber || index + 1}
          </div>
          <div>
            <p className="text-white font-bold text-sm line-clamp-1 tracking-wide">
              {scene.narration?.substring(0, 60) || "Scene narration"}...
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs text-slate-400 flex items-center gap-1 bg-[#0a0a0a] px-2 py-0.5 rounded-md border border-[#333]">
                <Clock size={10} /> {scene.duration}s
              </span>
              <span className="text-xs text-[#06b6d4] font-semibold bg-[#06b6d4]/10 px-2 py-0.5 rounded-md border border-[#06b6d4]/20">{scene.mood}</span>
              <span className="text-xs text-slate-400 bg-[#0a0a0a] px-2 py-0.5 rounded-md border border-[#333]">{scene.cameraMovement}</span>
            </div>
          </div>
        </div>
        <div className={`w-8 h-8 flex items-center justify-center rounded-full bg-[#0a0a0a] border border-[#333] transition-all duration-300 ${expanded ? "rotate-90 bg-[#06b6d4]/10 border-[#06b6d4]/30" : ""}`}>
          <ChevronRight
            size={16}
            className={expanded ? "text-[#06b6d4]" : "text-slate-500"}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-[#2a2a2a]/50 pt-5 bg-[#0a0a0a]/30">
          <div>
            <p className="text-[10px] font-black text-[#06b6d4] uppercase tracking-widest mb-2 flex items-center gap-1.5"><Mic size={12}/> Narration</p>
            <p className="text-slate-200 text-sm leading-relaxed border-l-2 border-[#06b6d4]/30 pl-3">{scene.narration}</p>
          </div>
          {scene.dialogue?.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-[#06b6d4] uppercase tracking-widest mb-2 flex items-center gap-1.5"><Mic size={12}/> Dialogue</p>
              <div className="space-y-1.5 border-l-2 border-[#06b6d4]/30 pl-3">
                {scene.dialogue.map((d, i) => (
                  <p key={i} className="text-sm text-slate-300">
                    <span className="text-[#06b6d4] font-bold">{d.character}:</span> "{d.text}"
                  </p>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><ImageIcon size={12}/> Visual Prompt</p>
            <p className="text-slate-400 text-sm italic leading-relaxed bg-[#111] p-3 rounded-lg border border-[#222]">{scene.visualPrompt}</p>
          </div>
          {scene.soundEffects?.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {scene.soundEffects.map((sfx, i) => (
                <span key={i} className="px-3 py-1 rounded-full bg-[#111] border border-[#333] text-xs text-slate-300 font-medium flex items-center gap-1.5 shadow-sm">
                  <span className="text-[#06b6d4]">🔊</span> {sfx}
                </span>
              ))}
            </div>
          )}
          {scene.musicMood && (
            <div className="flex items-center gap-2 pt-1">
              <div className="w-6 h-6 rounded-full bg-[#06b6d4]/10 flex items-center justify-center">
                <Music size={12} className="text-[#06b6d4]" />
              </div>
              <span className="text-xs text-slate-500 font-medium">Music Track: <span className="text-slate-300">{scene.musicMood}</span></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProgressStep({ step, status, isCurrent }) {
  const Icon = step.icon;
  const stepIndex = STATUS_ORDER[step.key] ?? 0;
  const currentIndex = STATUS_ORDER[status] ?? 0;
  const isDone = stepIndex < currentIndex || (step.key === "COMPLETED" && status === "COMPLETED");
  const isActive = step.key === status && status !== "COMPLETED";
  const isPending = stepIndex > currentIndex;

  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-500 ${
      isActive ? "bg-gradient-to-r from-[#06b6d4]/10 to-transparent border border-[#06b6d4]/30 shadow-[0_0_20px_rgba(6,182,212,0.1)] scale-[1.02]" :
      isDone ? "bg-emerald-500/5 border border-emerald-500/20" : "bg-transparent border border-transparent opacity-50"
    }`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-500 ${
        isDone ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]" :
        isActive ? "bg-[#06b6d4] text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]" :
        "bg-[#1a1a1a] border border-[#333] text-slate-500"
      }`}>
        {isDone ? (
          <CheckCircle2 size={18} />
        ) : isActive ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Icon size={16} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold tracking-wide ${
          isDone ? "text-emerald-400" : isActive ? "text-[#06b6d4]" : "text-slate-400"
        }`}>
          {step.label}
        </p>
      </div>
      {isDone && <CheckCircle2 size={16} className="text-emerald-500/50 flex-shrink-0" />}
      {isActive && <Loader2 size={16} className="text-[#06b6d4]/50 animate-spin flex-shrink-0" />}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function AiVideoPage() {
  const [stage, setStage] = useState("form"); // form | preview | progress
  const [formData, setFormData] = useState({
    prompt: "",
    style: "Cinematic",
    mood: ["Drama"],
    duration: 60,
    language: "Hindi",
    format: "9:16",
  });
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [story, setStory] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [isStartingGeneration, setIsStartingGeneration] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editJson, setEditJson] = useState("");
  const [editJsonError, setEditJsonError] = useState("");
  const [statusData, setStatusData] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const pollRef = useRef(null);
  const videoRef = useRef(null);

  // ── Form handlers ───────────────────────────────────────────

  const toggleMood = (mood) => {
    setFormData((prev) => ({
      ...prev,
      mood: prev.mood.includes(mood)
        ? prev.mood.filter((m) => m !== mood)
        : [...prev.mood, mood],
    }));
  };

  // ── Generate Story ─────────────────────────────────────────

  const handleGenerateStory = async () => {
    if (!formData.prompt.trim() || formData.prompt.trim().length < 10) {
      toast.error("Please enter a story idea (at least 10 characters).");
      return;
    }
    if (formData.mood.length === 0) {
      toast.error("Please select at least one mood.");
      return;
    }

    setIsGeneratingStory(true);
    try {
      const res = await generateStory(formData);
      if (res.data.success) {
        setStory(res.data.data.story);
        setProjectId(res.data.data.projectId);
        setStage("preview");
        toast.success("Story generated successfully!");
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to generate story.";
      toast.error(msg);
    } finally {
      setIsGeneratingStory(false);
    }
  };

  // ── Start Video Generation ─────────────────────────────────

  const handleStartGeneration = async () => {
    setIsStartingGeneration(true);
    try {
      let storyToUse = story;
      if (editMode && editJson) {
        try {
          storyToUse = JSON.parse(editJson);
        } catch {
          toast.error("Story JSON is invalid. Please fix it before generating.");
          setIsStartingGeneration(false);
          return;
        }
      }

      const res = await startVideoGeneration(projectId, JSON.stringify(storyToUse));
      if (res.data.success) {
        setStage("progress");
        setStatusData({ status: "GENERATING_STORY", progress: 5, progressLabel: "Starting..." });
        toast.success("Video generation started! This may take a few minutes.");
        startPolling(projectId);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to start generation.";
      toast.error(msg);
    } finally {
      setIsStartingGeneration(false);
    }
  };

  // ── Status Polling ─────────────────────────────────────────

  const startPolling = useCallback((pid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await getProjectStatus(pid);
        if (res.data.success) {
          const data = res.data.data;
          setStatusData(data);

          if (data.status === "COMPLETED") {
            clearInterval(pollRef.current);
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
            setVideoUrl(`${backendUrl}${data.videoPath}`);
            toast.success("🎬 Your cinematic video is ready!");
          } else if (data.status === "FAILED") {
            clearInterval(pollRef.current);
            toast.error(`Generation failed: ${data.errorMessage || "Unknown error"}`);
          }
        }
      } catch (_) {}
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Edit mode ──────────────────────────────────────────────

  const handleToggleEdit = () => {
    if (!editMode) {
      setEditJson(JSON.stringify(story, null, 2));
      setEditJsonError("");
    } else {
      try {
        const parsed = JSON.parse(editJson);
        setStory(parsed);
        setEditJsonError("");
        toast.success("Story updated!");
      } catch {
        setEditJsonError("Invalid JSON. Fix it before saving.");
        return;
      }
    }
    setEditMode(!editMode);
  };

  const handleRegenerate = () => {
    setStory(null);
    setProjectId(null);
    setEditMode(false);
    setStage("form");
  };

  const handleDeleteProject = async () => {
    if (!projectId) return;
    try {
      await deleteProject(projectId);
    } catch (_) {}
    setStory(null);
    setProjectId(null);
    setVideoUrl(null);
    setStatusData(null);
    setStage("form");
    toast.success("Project deleted.");
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `cinematic-${story?.title || "video"}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0a] selection:bg-cyan-500/30">
      {/* Hero Banner */}
      <div className="relative overflow-hidden border-b border-[#2a2a2a]/50 bg-[#0f0f0f]">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/3" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3 bg-[#1a1a1a]/80 backdrop-blur-md border border-[#2a2a2a] px-4 py-2 rounded-full shadow-lg">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
              </span>
              <span className="text-[10px] font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 uppercase tracking-[0.2em]">
                AI-Powered • Gemini + FFmpeg
              </span>
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-white leading-[1.1] tracking-tight mb-3">
            AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500">Cinematic Studio</span>
          </h1>
          {/* <p className="text-slate-400 text-lg md:text-xl max-w-xl font-light">
            Instantly turn your ideas into fully narrated, cinematic short videos.
          </p> */}

          {/* Stage indicator */}
          <div className="flex flex-wrap items-center gap-3 mt-10">
            {["Story Idea", "Review & Edit", "Generation"].map((s, i) => {
              const stageKeys = ["form", "preview", "progress"];
              const isActive = stageKeys[i] === stage;
              const isDone = stageKeys.indexOf(stage) > i;
              return (
                <div key={s} className="flex items-center gap-3">
                  <div className={`flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-bold transition-all duration-500 ${
                    isActive ? "bg-gradient-to-r from-blue-600/20 to-cyan-500/10 text-cyan-400 border border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.15)] scale-[1.02]" :
                    isDone ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" :
                    "bg-[#141414] text-slate-500 border border-[#2a2a2a]"
                  }`}>
                    {isDone ? <CheckCircle2 size={14} className="text-emerald-400" /> : <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] ${isActive ? "bg-cyan-500 text-black" : "bg-[#2a2a2a] text-slate-400"}`}>{i + 1}</span>}
                    {s}
                  </div>
                  {i < 2 && <ChevronRight size={16} className="text-[#333]" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

        {/* ═══════════════════════════════════════════════
            STAGE 1 — FORM
        ════════════════════════════════════════════════ */}
        {stage === "form" && (
          <div className="space-y-8 fade-up">

            {/* Form Split Layout */}
            <div className="grid lg:grid-cols-12 gap-6">
              
              {/* Left Column: Story Idea */}
              <div className="lg:col-span-8 flex flex-col">
                <div className="glass-card p-8 hover:border-[#06b6d4]/30 transition-colors duration-500 group flex flex-col h-full">
                  <SectionLabel>Story Idea <span className="text-[#06b6d4]">*</span></SectionLabel>
                  <textarea
                    id="story-prompt"
                    value={formData.prompt}
                    onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                    placeholder='e.g. "A story about criminality in a cinematic way. Add suspense, drama, fun, and unexpected twists."'
                    className="w-full flex-1 min-h-[250px] bg-[#0a0a0a]/50 border border-[#333] rounded-2xl px-5 py-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#06b6d4]/60 focus:ring-4 focus:ring-[#06b6d4]/10 transition-all duration-300 resize-none text-lg leading-relaxed group-hover:bg-[#0a0a0a]/80 shadow-inner"
                  />
                  <div className="flex justify-between items-center mt-4">
                    <p className="text-slate-500 text-xs font-medium">{formData.prompt.length} characters (minimum 10)</p>
                    {formData.prompt.length >= 10 && <CheckCircle2 size={16} className="text-emerald-500" />}
                  </div>
                </div>
              </div>

              {/* Right Column: Configuration Column */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                
                {/* Language */}
                <div className="glass-card p-5 hover:border-[#06b6d4]/30 transition-colors duration-500">
                  <SectionLabel>Language</SectionLabel>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l}
                        id={`lang-${l.toLowerCase()}`}
                        onClick={() => setFormData({ ...formData, language: l })}
                        className={`px-2 py-2.5 rounded-xl text-xs font-bold border transition-all duration-300 text-center relative overflow-hidden ${
                          formData.language === l
                            ? "bg-[#06b6d4]/10 border-[#06b6d4] text-[#06b6d4] shadow-[0_0_15px_rgba(6,182,212,0.15)] scale-[1.02]"
                            : "bg-[#111] border-[#333] text-slate-400 hover:border-[#555] hover:text-slate-200 hover:bg-[#1a1a1a]"
                        }`}
                      >
                        {formData.language === l && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#06b6d4]/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />}
                        <span className="relative z-10">{l}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mood */}
                <div className="glass-card p-5 hover:border-[#06b6d4]/30 transition-colors duration-500">
                  <SectionLabel>Mood</SectionLabel>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {MOODS.map((m) => (
                      <button
                        key={m}
                        id={`mood-${m.toLowerCase()}`}
                        onClick={() => toggleMood(m)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all duration-300 ${
                          formData.mood.includes(m)
                            ? "bg-[#06b6d4]/10 border-[#06b6d4] text-[#06b6d4] shadow-[0_0_15px_rgba(6,182,212,0.15)] scale-[1.05]"
                            : "bg-[#111] border-[#333] text-slate-400 hover:border-[#555] hover:text-slate-200 hover:bg-[#1a1a1a]"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div className="glass-card p-5 hover:border-[#06b6d4]/30 transition-colors duration-500">
                  <SectionLabel>Duration</SectionLabel>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.value}
                        id={`duration-${d.value}`}
                        onClick={() => setFormData({ ...formData, duration: d.value })}
                        className={`px-1 py-2.5 rounded-xl text-[11px] font-bold border transition-all duration-300 flex flex-row items-center justify-center gap-1 ${
                          formData.duration === d.value
                            ? "bg-[#06b6d4]/10 border-[#06b6d4] text-[#06b6d4] shadow-[0_0_15px_rgba(6,182,212,0.15)] scale-[1.05]"
                            : "bg-[#111] border-[#333] text-slate-400 hover:border-[#555] hover:text-slate-200 hover:bg-[#1a1a1a]"
                        }`}
                      >
                        <Clock size={12} className={formData.duration === d.value ? "text-[#06b6d4]" : "text-slate-500"} />
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video Format */}
                <div className="glass-card p-5 hover:border-[#06b6d4]/30 transition-colors duration-500">
                  <SectionLabel>Format</SectionLabel>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {FORMATS.map((f) => (
                      <button
                        key={f.value}
                        id={`format-${f.value.replace(":", "-")}`}
                        onClick={() => setFormData({ ...formData, format: f.value })}
                        className={`px-3 py-2.5 rounded-xl text-xs border transition-all duration-300 flex items-center gap-3 ${
                          formData.format === f.value
                            ? "bg-[#06b6d4]/10 border-[#06b6d4] shadow-[0_0_15px_rgba(6,182,212,0.15)] scale-[1.02]"
                            : "bg-[#111] border-[#333] hover:border-[#555] hover:bg-[#1a1a1a]"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${formData.format === f.value ? "bg-[#06b6d4]/20 text-[#06b6d4]" : "bg-[#222] text-slate-500"}`}>
                          {f.value === "9:16" ? <div className="w-1.5 h-3 border-2 border-current rounded-sm" /> : <div className="w-3 h-1.5 border-2 border-current rounded-sm" />}
                        </div>
                        <p className={`font-bold leading-tight ${formData.format === f.value ? "text-[#06b6d4]" : "text-slate-300"}`}>
                          {f.label}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Generate Button */}
            <PrimaryButton
              id="generate-story-btn"
              onClick={handleGenerateStory}
              loading={isGeneratingStory}
              className="w-full py-4 text-base"
            >
              {isGeneratingStory ? (
                "Gemini is writing your story..."
              ) : (
                <>
                  <Sparkles size={18} />
                  Generate Story with AI
                </>
              )}
            </PrimaryButton>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            STAGE 2 — STORY PREVIEW
        ════════════════════════════════════════════════ */}
        {stage === "preview" && story && (
          <div className="grid lg:grid-cols-12 gap-6 fade-up">
            
            {/* Left Column: Details & Actions */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              
              {/* Story Header */}
              <div className="glass-card p-6 flex-1 flex flex-col hover:border-[#06b6d4]/30 transition-colors duration-500">
                <div className="flex items-center gap-2 mb-3">
                  <Clapperboard size={16} className="text-[#06b6d4]" />
                  <span className="text-xs font-bold text-[#06b6d4] uppercase tracking-widest">Story Details</span>
                </div>
                <h2 className="text-xl font-extrabold text-white mb-2">{story.title}</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6 flex-1">{story.description}</p>
                
                {/* Stats */}
                <div className="space-y-2 mt-auto">
                  <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                    <span className="text-xs text-slate-500">Duration</span>
                    <span className="text-xs text-slate-200 font-medium flex items-center gap-1.5"><Clock size={12}/> {story.duration}s</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                    <span className="text-xs text-slate-500">Scenes</span>
                    <span className="text-xs text-slate-200 font-medium">{story.scenes?.length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                    <span className="text-xs text-slate-500">Language</span>
                    <span className="text-xs text-slate-200 font-medium">{story.language}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <OutlineButton onClick={handleRegenerate} className="w-full text-[11px] px-2 py-3">
                    <RefreshCw size={14} />
                    Regenerate
                  </OutlineButton>
                  <OutlineButton onClick={handleToggleEdit} className="w-full text-[11px] px-2 py-3">
                    <Edit3 size={14} />
                    {editMode ? "Cancel" : "Edit JSON"}
                  </OutlineButton>
                </div>
                <PrimaryButton
                  id="generate-video-btn"
                  onClick={handleStartGeneration}
                  loading={isStartingGeneration}
                  className="w-full py-3.5"
                >
                  {!isStartingGeneration && <Film size={15} />}
                  Generate Video
                </PrimaryButton>
              </div>
            </div>

            {/* Right Column: Scenes / Editor */}
            <div className="lg:col-span-8 flex flex-col">
              {editMode ? (
                <div className="glass-card p-6 h-full flex flex-col hover:border-[#06b6d4]/30 transition-colors duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <SectionLabel>Edit Story JSON</SectionLabel>
                    <button
                      onClick={() => { setEditMode(false); setEditJsonError(""); }}
                      className="text-slate-500 hover:text-white transition-colors p-1 bg-[#1a1a1a] rounded-md border border-[#333]"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <textarea
                    value={editJson}
                    onChange={(e) => { setEditJson(e.target.value); setEditJsonError(""); }}
                    className="w-full flex-1 bg-[#0a0a0a]/80 border border-[#2a2a2a] rounded-xl px-4 py-4 text-emerald-400 font-mono text-xs sm:text-sm focus:outline-none focus:border-[#06b6d4]/50 resize-none shadow-inner min-h-[400px]"
                    spellCheck={false}
                  />
                  {editJsonError && (
                    <p className="text-red-400 text-xs mt-3 flex items-center gap-1.5 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                      <AlertCircle size={14} /> {editJsonError}
                    </p>
                  )}
                  <div className="flex justify-end mt-4">
                    <PrimaryButton onClick={handleToggleEdit}>
                      Save Changes
                    </PrimaryButton>
                  </div>
                </div>
              ) : (
                <div className="glass-card p-6 h-full flex flex-col hover:border-[#06b6d4]/30 transition-colors duration-500">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                    <SectionLabel>Scene Breakdown</SectionLabel>
                    <span className="text-[10px] sm:text-xs text-slate-500 px-2 py-1.5 bg-[#1a1a1a] rounded-md border border-[#333] font-medium tracking-wide">
                      {story.scenes?.length} scenes • click to expand
                    </span>
                  </div>
                  <div className="space-y-3 pr-2 custom-scrollbar flex-1 h-[500px] overflow-y-auto">
                    {story.scenes?.map((scene, i) => (
                      <SceneCard key={i} scene={scene} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            STAGE 3 — PROGRESS + RESULT
        ════════════════════════════════════════════════ */}
        {stage === "progress" && (
          <div className="space-y-6 fade-up">
            <div className="grid lg:grid-cols-12 gap-6">

              {/* Progress Tracker (Left Column) */}
              <div className="lg:col-span-4 glass-card p-6 hover:border-[#06b6d4]/30 transition-colors duration-500 h-fit">
                <div className="flex items-center gap-2 mb-5">
                  {statusData?.status === "COMPLETED" ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : statusData?.status === "FAILED" ? (
                    <AlertCircle size={16} className="text-red-400" />
                  ) : (
                    <Loader2 size={16} className="text-[#06b6d4] animate-spin" />
                  )}
                  <h3 className="text-white font-bold">Generation Pipeline</h3>
                </div>

                <div className="space-y-2">
                  {PIPELINE_STEPS.map((step) => (
                    <ProgressStep
                      key={step.key}
                      step={step}
                      status={statusData?.status || "PENDING"}
                    />
                  ))}

                  {statusData?.status === "FAILED" && (
                    <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                      <p className="text-red-400 text-sm font-semibold flex items-center gap-2">
                        <AlertCircle size={14} /> Generation Failed
                      </p>
                      <p className="text-red-400/70 text-xs mt-1">{statusData.errorMessage}</p>
                      <OutlineButton onClick={handleRegenerate} className="mt-3 w-full text-sm">
                        Start Over
                      </OutlineButton>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                {statusData && statusData.status !== "FAILED" && (
                  <div className="mt-5">
                    <div className="flex justify-between text-xs text-slate-500 mb-2">
                      <span>{statusData.progressLabel || "Processing..."}</span>
                      <span>{statusData.progress || 0}%</span>
                    </div>
                    <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#06b6d4] to-[#67e8f9] rounded-full transition-all duration-700"
                        style={{ width: `${statusData.progress || 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Story Summary & Video Result (Right Column) */}
              <div className="lg:col-span-8 space-y-4 flex flex-col">
                {story && (
                  <div className="glass-card p-5 hover:border-[#06b6d4]/30 transition-colors duration-500">
                    <h4 className="text-white font-bold mb-1">{story.title}</h4>
                    <p className="text-slate-500 text-xs mb-3">{story.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-[#141414] rounded-full text-xs text-slate-400 border border-[#2a2a2a]">
                        {story.style}
                      </span>
                      <span className="px-2 py-1 bg-[#141414] rounded-full text-xs text-slate-400 border border-[#2a2a2a]">
                        {story.scenes?.length} scenes
                      </span>
                      <span className="px-2 py-1 bg-[#141414] rounded-full text-xs text-slate-400 border border-[#2a2a2a]">
                        {story.duration}s
                      </span>
                    </div>
                  </div>
                )}

                {/* Video Player — shows when COMPLETED */}
                {videoUrl && statusData?.status === "COMPLETED" && (
                  <div className="glass-card p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-400" />
                      <h4 className="text-white font-bold">Your Video is Ready!</h4>
                    </div>
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      className="w-full rounded-xl max-h-[400px] bg-black"
                    />
                    <div className="flex gap-3">
                      <PrimaryButton onClick={handleDownload} className="flex-1">
                        <Download size={15} />
                        Download MP4
                      </PrimaryButton>
                      <OutlineButton onClick={handleDeleteProject} className="px-4">
                        <Trash2 size={15} />
                      </OutlineButton>
                    </div>
                    <OutlineButton onClick={handleRegenerate} className="w-full">
                      <RefreshCw size={14} />
                      Create Another Video
                    </OutlineButton>
                  </div>
                )}

                {/* YouTube Upload Integration */}
                {videoUrl && statusData?.status === "COMPLETED" && (
                    <YouTubeSection projectId={projectId} />
                )}

                {/* Waiting state */}
                {!videoUrl && statusData?.status !== "FAILED" && (
                  <div className="glass-card p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-[#06b6d4]/10 border border-[#06b6d4]/20 flex items-center justify-center mx-auto mb-4">
                      <Video size={28} className="text-[#06b6d4]" />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">Video is being rendered...</p>
                    <p className="text-slate-600 text-xs mt-1">This may take 2–10 minutes depending on scene count.</p>
                    <div className="flex items-center justify-center gap-1.5 mt-4">
                      <div className="w-2 h-2 bg-[#06b6d4] rounded-full animate-bounce [animation-delay:0ms]" />
                      <div className="w-2 h-2 bg-[#06b6d4] rounded-full animate-bounce [animation-delay:150ms]" />
                      <div className="w-2 h-2 bg-[#06b6d4] rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Info card */}
            <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 flex items-start gap-3">
              <AlertCircle size={15} className="text-[#06b6d4] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  <span className="text-white font-semibold">Generation runs in the background.</span>{" "}
                  You can keep this tab open. Status updates automatically every 3 seconds.
                  Pipeline: Image generation → Voice narration → FFmpeg scene rendering → Music mix → Final video.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
