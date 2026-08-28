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
import {
  Sparkles,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  Loader2,
  Clock,
  AlertCircle,
  Mic,
  ImageIcon,
  Video,
  Layers,
  Zap,
  Youtube,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────


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
    duration: 60,
    language: "Hindi",
    format: "9:16",
    autoUploadToYouTube: true,
  });
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [story, setStory] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const pollRef = useRef(null);
  const videoRef = useRef(null);

  // ── Form handlers ───────────────────────────────────────────

  // ── Generate Story ─────────────────────────────────────────

  const handleGenerateStory = async () => {
    if (!formData.prompt.trim() || formData.prompt.trim().length < 10) {
      toast.error("Please enter a story idea (at least 10 characters).");
      return;
    }
    setIsGeneratingStory(true);
    try {
      const res = await generateStory(formData);
      if (res.data.success) {
        const generatedStory = res.data.data.story;
        const newProjectId = res.data.data.projectId;
        setStory(generatedStory);
        setProjectId(newProjectId);
        toast.success("Story generated! Starting video pipeline...");
        
        // Auto-start video generation immediately
        const videoRes = await startVideoGeneration(newProjectId, JSON.stringify(generatedStory), formData.autoUploadToYouTube);
        if (videoRes.data.success) {
          setStage("progress");
          setStatusData({ status: "GENERATING_STORY", progress: 5, progressLabel: "Starting pipeline..." });
          startPolling(newProjectId);
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to generate story.";
      toast.error(msg);
    } finally {
      setIsGeneratingStory(false);
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
          
          const isYoutubeWorking = data.youtubeStatus === "PROCESSING" || data.youtubeStatus === "UPLOADING";
          
          setStatusData(data);

          if (data.status === "COMPLETED") {
            setVideoUrl(getMediaUrl(data.videoPath));
            if (isYoutubeWorking || data.youtubeStatus === "COMPLETED") {
                setStage("youtube");
            }
          }

          if (data.status === "COMPLETED" && !isYoutubeWorking) {
            clearInterval(pollRef.current);
            if (data.youtubeStatus === "COMPLETED") {
              toast.success("🎬 Your video is ready and uploaded to YouTube!");
            } else {
              toast.success("🎬 Your cinematic video is ready!");
            }
          } else if (data.status === "FAILED" || data.youtubeStatus === "FAILED") {
            clearInterval(pollRef.current);
            toast.error(`Failed: ${data.errorMessage || "Unknown error"}`);
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



  const handleRegenerate = () => {
    setStory(null);
    setProjectId(null);
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

          {/* Stage indicator */}
          <div className="flex flex-wrap items-center gap-3 mt-10">
            {["Story Idea", "Generation", "YouTube Upload"].map((s, i) => {
              let isActive = false;
              let isDone = false;
              
              if (i === 0) { // Story Idea
                isActive = stage === "form";
                isDone = stage !== "form";
              } else if (i === 1) { // Generation
                isActive = stage === "progress";
                isDone = stage === "youtube";
              } else if (i === 2) { // YouTube Upload
                isActive = stage === "youtube" && statusData?.youtubeStatus !== "COMPLETED";
                isDone = stage === "youtube" && statusData?.youtubeStatus === "COMPLETED";
              }

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
                {/* Auto Upload Toggle */}
                <div className="glass-card p-5 hover:border-[#06b6d4]/30 transition-colors duration-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <SectionLabel>Auto-Upload to YouTube</SectionLabel>
                      <p className="text-xs text-slate-400 -mt-2">Requires connected account.</p>
                    </div>
                    <button
                      onClick={() => setFormData({ ...formData, autoUploadToYouTube: !formData.autoUploadToYouTube })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 flex-shrink-0 ${
                        formData.autoUploadToYouTube ? 'bg-[#06b6d4]' : 'bg-[#333]'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                          formData.autoUploadToYouTube ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
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
                      <h4 className="text-white font-bold">
                        {statusData?.youtubeStatus === "COMPLETED" ? "Video Uploaded Successfully!" : "Your Video is Ready!"}
                      </h4>
                    </div>

                    {(statusData?.youtubeStatus === "PROCESSING" || statusData?.youtubeStatus === "UPLOADING") && (
                      <div className="p-3 bg-[#06b6d4]/10 border border-[#06b6d4]/30 rounded-lg text-sm text-[#06b6d4] flex items-center justify-between transition-colors">
                        <span className="font-medium flex items-center gap-2">
                          <Loader2 size={16} className="animate-spin" /> Auto-uploading to YouTube...
                        </span>
                      </div>
                    )}

                    {statusData?.youtubeStatus === "COMPLETED" && statusData?.youtubeUrl && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-center justify-between transition-colors hover:bg-red-500/20">
                        <span className="font-medium text-red-300">Available on YouTube</span>
                        <a href={statusData.youtubeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 font-bold hover:underline">
                           Watch Now
                        </a>
                      </div>
                    )}

                    <video
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      className="w-full rounded-xl max-h-[400px] bg-black"
                    />
                  </div>
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

        {/* ═══════════════════════════════════════════════
            STAGE 4 — YOUTUBE UPLOAD
        ════════════════════════════════════════════════ */}
        {stage === "youtube" && (
          <div className="fade-up max-w-2xl mx-auto mt-3">
            <div className="glass-card p-6 flex flex-col sm:flex-row items-center gap-8">
              
              {/* Video Preview - Compact 9:16 constraint */}
              {videoUrl && (
                <div className="w-[160px] flex-shrink-0">
                  <video
                    src={videoUrl}
                    controls
                    className="w-full aspect-[9/16] rounded-xl bg-black border border-[#2a2a2a] shadow-lg object-cover"
                  />
                </div>
              )}

              {/* Status and Actions */}
              <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left">
                <div className="flex items-center gap-3 mb-3">
                  {statusData?.youtubeStatus === "COMPLETED" ? (
                    <CheckCircle2 size={24} className="text-emerald-400" />
                  ) : (
                    <Loader2 size={24} className="text-red-500 animate-spin" />
                  )}
                  <h2 className="text-xl font-bold text-white">
                    {statusData?.youtubeStatus === "COMPLETED" ? "Published on YouTube!" : "Uploading to YouTube..."}
                  </h2>
                </div>

                <p className="text-sm text-slate-400 mb-8">
                  {statusData?.youtubeStatus === "COMPLETED" 
                    ? "Your AI video is now live on your channel. You can check it out below or start a new project." 
                    : "Please wait while we securely transfer your generated video to your YouTube channel."}
                </p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 w-full">
                  {statusData?.youtubeStatus === "COMPLETED" && statusData?.youtubeUrl && (
                    <a 
                      href={statusData.youtubeUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-all shadow-[0_0_15px_rgba(220,38,38,0.3)] hover:scale-105"
                    >
                      <Youtube size={18} />
                      Watch on YouTube
                    </a>
                  )}
                  
                  <OutlineButton onClick={handleRegenerate} className="px-5 py-2.5 text-sm flex-1 sm:flex-none">
                    <RefreshCw size={14} /> Create Another
                  </OutlineButton>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
