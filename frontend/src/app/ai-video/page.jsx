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
  { label: "30 sec", value: 30 },
  { label: "1 min", value: 60 },
  { label: "2 min", value: 120 },
  { label: "3 min", value: 180 },
];
const LANGUAGES = ["English", "Hindi", "Marathi"];
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

function GoldButton({ onClick, disabled, loading, children, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center justify-center gap-2 px-6 py-3 bg-[#D4AF37] text-black font-bold rounded-xl transition-all duration-200 hover:bg-[#e8c84e] hover:shadow-lg hover:shadow-[#D4AF37]/25 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${className}`}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

function OutlineButton({ onClick, disabled, children, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 px-6 py-3 bg-transparent border border-[#2a2a2a] text-slate-300 font-semibold rounded-xl transition-all duration-200 hover:border-[#D4AF37]/50 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

function SceneCard({ scene, index }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#1a1a1a] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] text-sm font-bold flex-shrink-0">
            {scene.sceneNumber || index + 1}
          </span>
          <div>
            <p className="text-white font-semibold text-sm line-clamp-1">
              {scene.narration?.substring(0, 60) || "Scene narration"}...
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock size={11} /> {scene.duration}s
              </span>
              <span className="text-xs text-[#D4AF37] font-medium">{scene.mood}</span>
              <span className="text-xs text-slate-600">{scene.cameraMovement}</span>
            </div>
          </div>
        </div>
        <ChevronRight
          size={16}
          className={`text-slate-500 transition-transform flex-shrink-0 ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-[#2a2a2a] pt-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Narration</p>
            <p className="text-slate-300 text-sm leading-relaxed">{scene.narration}</p>
          </div>
          {scene.dialogue?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Dialogue</p>
              {scene.dialogue.map((d, i) => (
                <p key={i} className="text-sm text-slate-300">
                  <span className="text-[#D4AF37] font-semibold">{d.character}:</span> "{d.text}"
                </p>
              ))}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Visual Prompt</p>
            <p className="text-slate-400 text-sm italic leading-relaxed">{scene.visualPrompt}</p>
          </div>
          {scene.soundEffects?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {scene.soundEffects.map((sfx, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] text-xs text-slate-400">
                  🔊 {sfx}
                </span>
              ))}
            </div>
          )}
          {scene.musicMood && (
            <div className="flex items-center gap-2">
              <Music size={13} className="text-[#D4AF37]" />
              <span className="text-xs text-slate-500">Music: <span className="text-slate-300">{scene.musicMood}</span></span>
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
    <div className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
      isActive ? "bg-[#D4AF37]/10 border border-[#D4AF37]/30" :
      isDone ? "opacity-60" : "opacity-30"
    }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isDone ? "bg-emerald-500/20 border border-emerald-500/40" :
        isActive ? "bg-[#D4AF37]/20 border border-[#D4AF37]/40" :
        "bg-[#1a1a1a] border border-[#2a2a2a]"
      }`}>
        {isDone ? (
          <CheckCircle2 size={15} className="text-emerald-400" />
        ) : isActive ? (
          <Loader2 size={15} className="text-[#D4AF37] animate-spin" />
        ) : (
          <Circle size={12} className="text-slate-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${
          isDone ? "text-emerald-400" : isActive ? "text-[#D4AF37]" : "text-slate-600"
        }`}>
          {step.label}
        </p>
      </div>
      {isDone && <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />}
      {isActive && <Loader2 size={14} className="text-[#D4AF37] animate-spin flex-shrink-0" />}
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
    language: "English",
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
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Hero Banner */}
      <div className="relative overflow-hidden border-b border-[#1a1a1a]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#D4AF37]/3 rounded-full blur-[150px] pointer-events-none -translate-y-1/2 translate-x-1/3" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-[#D4AF37] animate-ping absolute" />
              <span className="flex h-2 w-2 rounded-full bg-[#D4AF37] relative" />
              <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest ml-2">
                AI-Powered • Gemini + FFmpeg
              </span>
            </div>
            <a href="/gallery" className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-slate-300 rounded-full text-xs font-bold hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50 hover:text-[#D4AF37] transition-all">
              <Film size={14} />
              My Gallery
            </a>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight">
            Story to{" "}
            <span className="text-gold-gradient">Cinematic Video</span>
          </h1>
          <p className="text-slate-400 mt-3 text-lg max-w-2xl">
            Type your story idea and watch AI transform it into a fully narrated, scored, cinematic short video — automatically.
          </p>

          {/* Stage indicator */}
          <div className="flex items-center gap-2 mt-6">
            {["Form", "Story Preview", "Video Generation"].map((s, i) => {
              const stageKeys = ["form", "preview", "progress"];
              const isActive = stageKeys[i] === stage;
              const isDone = stageKeys.indexOf(stage) > i;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isActive ? "bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40" :
                    isDone ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                    "bg-[#1a1a1a] text-slate-600 border border-[#2a2a2a]"
                  }`}>
                    {isDone ? <CheckCircle2 size={11} /> : <span>{i + 1}</span>}
                    {s}
                  </div>
                  {i < 2 && <ChevronRight size={14} className="text-slate-700" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">

        {/* ═══════════════════════════════════════════════
            STAGE 1 — FORM
        ════════════════════════════════════════════════ */}
        {stage === "form" && (
          <div className="space-y-8 fade-up">

            {/* Story Idea */}
            <div className="glass-card p-6">
              <SectionLabel>Story Idea *</SectionLabel>
              <textarea
                id="story-prompt"
                rows={4}
                value={formData.prompt}
                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                placeholder='e.g. "A story about criminality in a cinematic way. Add suspense, drama, fun, and unexpected twists."'
                className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/30 transition-all resize-none text-sm leading-relaxed"
              />
              <p className="text-slate-600 text-xs mt-2">{formData.prompt.length} characters (minimum 10)</p>
            </div>

            {/* Language */}
            <div className="glass-card p-6">
              <SectionLabel>Language</SectionLabel>
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
                {LANGUAGES.map((l) => (
                  <button
                    key={l}
                    id={`lang-${l.toLowerCase()}`}
                    onClick={() => setFormData({ ...formData, language: l })}
                    className={`px-4 py-3 rounded-xl text-sm font-semibold border transition-all text-center ${
                      formData.language === l
                        ? "bg-[#D4AF37]/20 border-[#D4AF37]/60 text-[#D4AF37]"
                        : "bg-[#141414] border-[#2a2a2a] text-slate-400 hover:border-[#3a3a3a] hover:text-white"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div className="glass-card p-6">
              <SectionLabel>Mood (select multiple)</SectionLabel>
              <div className="flex flex-wrap gap-2.5">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    id={`mood-${m.toLowerCase()}`}
                    onClick={() => toggleMood(m)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                      formData.mood.includes(m)
                        ? "bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]"
                        : "bg-[#141414] border-[#2a2a2a] text-slate-400 hover:border-[#3a3a3a] hover:text-white"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration + Format */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="glass-card p-6">
                <SectionLabel>Duration</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      id={`duration-${d.value}`}
                      onClick={() => setFormData({ ...formData, duration: d.value })}
                      className={`px-3 py-3 rounded-xl text-sm font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        formData.duration === d.value
                          ? "bg-[#D4AF37]/20 border-[#D4AF37]/60 text-[#D4AF37]"
                          : "bg-[#141414] border-[#2a2a2a] text-slate-400 hover:border-[#3a3a3a] hover:text-white"
                      }`}
                    >
                      <Clock size={13} />
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass-card p-6">
                <SectionLabel>Video Format</SectionLabel>
                <div className="flex flex-col gap-2">
                  {FORMATS.map((f) => (
                    <button
                      key={f.value}
                      id={`format-${f.value.replace(":", "-")}`}
                      onClick={() => setFormData({ ...formData, format: f.value })}
                      className={`px-4 py-3 rounded-xl text-sm border transition-all text-left ${
                        formData.format === f.value
                          ? "bg-[#D4AF37]/20 border-[#D4AF37]/60"
                          : "bg-[#141414] border-[#2a2a2a] hover:border-[#3a3a3a]"
                      }`}
                    >
                      <p className={`font-bold ${formData.format === f.value ? "text-[#D4AF37]" : "text-white"}`}>
                        {f.label}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">{f.sub}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <GoldButton
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
            </GoldButton>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            STAGE 2 — STORY PREVIEW
        ════════════════════════════════════════════════ */}
        {stage === "preview" && story && (
          <div className="space-y-6 fade-up">

            {/* Story Header */}
            <div className="glass-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Clapperboard size={16} className="text-[#D4AF37]" />
                    <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-widest">Generated Story</span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-white mb-2">{story.title}</h2>
                  <p className="text-slate-400 text-sm leading-relaxed">{story.description}</p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="px-3 py-1.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-xs text-slate-400 flex items-center gap-1.5">
                    <Clock size={11} />
                    {story.duration}s total
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-xs text-slate-400">
                    {story.scenes?.length || 0} scenes
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-xs text-slate-400">
                    {story.language}
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Mode Toggle */}
            {editMode ? (
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-3">
                  <SectionLabel>Edit Story JSON</SectionLabel>
                  <button
                    onClick={() => { setEditMode(false); setEditJsonError(""); }}
                    className="text-slate-500 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <textarea
                  value={editJson}
                  onChange={(e) => { setEditJson(e.target.value); setEditJsonError(""); }}
                  rows={20}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-emerald-400 font-mono text-xs focus:outline-none focus:border-[#D4AF37]/50 resize-none"
                  spellCheck={false}
                />
                {editJsonError && (
                  <p className="text-red-400 text-xs mt-2 flex items-center gap-1.5">
                    <AlertCircle size={12} /> {editJsonError}
                  </p>
                )}
                <GoldButton onClick={handleToggleEdit} className="mt-3 w-full">
                  Save Changes
                </GoldButton>
              </div>
            ) : (
              /* Scene Cards */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <SectionLabel>Scene Breakdown</SectionLabel>
                  <span className="text-xs text-slate-600">{story.scenes?.length} scenes • click to expand</span>
                </div>
                {story.scenes?.map((scene, i) => (
                  <SceneCard key={i} scene={scene} index={i} />
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <OutlineButton onClick={handleRegenerate} className="flex-1">
                <RefreshCw size={15} />
                Regenerate Story
              </OutlineButton>
              <OutlineButton
                onClick={handleToggleEdit}
                className="flex-1"
              >
                <Edit3 size={15} />
                {editMode ? "Cancel Edit" : "Edit Story JSON"}
              </OutlineButton>
              <GoldButton
                id="generate-video-btn"
                onClick={handleStartGeneration}
                loading={isStartingGeneration}
                className="flex-1"
              >
                {!isStartingGeneration && <Film size={15} />}
                Generate Video
              </GoldButton>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            STAGE 3 — PROGRESS + RESULT
        ════════════════════════════════════════════════ */}
        {stage === "progress" && (
          <div className="space-y-6 fade-up">
            <div className="grid md:grid-cols-2 gap-6">

              {/* Progress Tracker */}
              <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-5">
                  {statusData?.status === "COMPLETED" ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : statusData?.status === "FAILED" ? (
                    <AlertCircle size={16} className="text-red-400" />
                  ) : (
                    <Loader2 size={16} className="text-[#D4AF37] animate-spin" />
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
                        className="h-full bg-gradient-to-r from-[#D4AF37] to-[#f0d060] rounded-full transition-all duration-700"
                        style={{ width: `${statusData.progress || 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Story Summary & Video Result */}
              <div className="space-y-4">
                {story && (
                  <div className="glass-card p-5">
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
                      <GoldButton onClick={handleDownload} className="flex-1">
                        <Download size={15} />
                        Download MP4
                      </GoldButton>
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
                    <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center mx-auto mb-4">
                      <Video size={28} className="text-[#D4AF37]" />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">Video is being rendered...</p>
                    <p className="text-slate-600 text-xs mt-1">This may take 2–10 minutes depending on scene count.</p>
                    <div className="flex items-center justify-center gap-1.5 mt-4">
                      <div className="w-2 h-2 bg-[#D4AF37] rounded-full animate-bounce [animation-delay:0ms]" />
                      <div className="w-2 h-2 bg-[#D4AF37] rounded-full animate-bounce [animation-delay:150ms]" />
                      <div className="w-2 h-2 bg-[#D4AF37] rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Info card */}
            <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 flex items-start gap-3">
              <AlertCircle size={15} className="text-[#D4AF37] flex-shrink-0 mt-0.5" />
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
