import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { Youtube, UploadCloud, CheckCircle, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { 
  getYouTubeStatus, 
  disconnectYouTube, 
  generateYouTubeMetadata, 
  uploadToYouTube, 
  getYouTubeUploadStatus,
  getProject
} from "../../utils/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function YouTubeSection({ projectId, initialYouTubeStatus }) {
  const [status, setStatus] = useState("loading"); // loading, disconnected, connected, uploading, processing, completed, error
  const [channelInfo, setChannelInfo] = useState(null);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    tags: "",
    privacyStatus: "private"
  });
  const [uploadState, setUploadState] = useState(null); 
  const [isGeneratingMeta, setIsGeneratingMeta] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const pollRef = useRef(null);

  useEffect(() => {
    checkConnection();
    
    // Listen for oauth popup message
    const handleMessage = (e) => {
      if (e.data === "youtube_connected") {
        checkConnection();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (initialYouTubeStatus && initialYouTubeStatus !== "NOT_STARTED" && initialYouTubeStatus !== "AUTH_REQUIRED") {
       // if there's already an upload in progress or completed
       setStatus(initialYouTubeStatus.toLowerCase());
       if (initialYouTubeStatus !== "COMPLETED" && initialYouTubeStatus !== "FAILED") {
           startPolling();
       } else if (initialYouTubeStatus === "COMPLETED") {
           // fetch the url
           getYouTubeUploadStatus(projectId).then(res => setUploadState(res.data));
       }
    }
  }, [initialYouTubeStatus, projectId]);

  useEffect(() => {
    getProject(projectId).then(res => {
      if (res.data && res.data.success && res.data.data) {
        const proj = res.data.data;
        if (proj.story) {
          const story = proj.story;
          setFormData(prev => ({
            ...prev,
            title: prev.title || story.title || "",
            description: prev.description || story.description || "",
            tags: prev.tags || [proj.style, ...(proj.mood ? proj.mood.split(',') : [])].filter(Boolean).map(t => t.trim()).join(', ')
          }));
        }
      }
    }).catch(() => {});
  }, [projectId]);

  const checkConnection = async () => {
    try {
      const res = await getYouTubeStatus();
      if (res.data.connected) {
        setChannelInfo(res.data.channel);
        if (status === "loading" || status === "disconnected") {
            setStatus("connected");
        }
      } else {
        setStatus("disconnected");
      }
    } catch (e) {
      console.error(e);
      setStatus("disconnected");
    }
  };

  const handleConnect = () => {
    // Open OAuth window
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(
      `${API_URL}/api/youtube/auth`,
      "YouTube Auth",
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  const handleDisconnect = async () => {
    try {
      await disconnectYouTube();
      setChannelInfo(null);
      setStatus("disconnected");
      toast.success("Disconnected from YouTube");
    } catch (e) {
      toast.error("Failed to disconnect");
    }
  };

  const handleGenerateMetadata = async () => {
    setIsGeneratingMeta(true);
    try {
      const res = await generateYouTubeMetadata(projectId);
      if (res.data.success) {
        setFormData({
          ...formData,
          title: res.data.metadata.title,
          description: res.data.metadata.description,
          tags: res.data.metadata.tags.join(", ")
        });
        toast.success("Metadata generated!");
      }
    } catch (e) {
      toast.error("Failed to generate metadata");
    } finally {
      setIsGeneratingMeta(false);
    }
  };

  const handleUpload = async () => {
    if (!formData.title) return toast.error("Title is required");
    
    setIsUploading(true);
    try {
      const data = {
        projectId,
        title: formData.title,
        description: formData.description,
        tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean),
        privacyStatus: formData.privacyStatus
      };
      const res = await uploadToYouTube(data);
      if (res.data.success) {
        setStatus("uploading");
        toast.success("Upload started!");
        startPolling();
      }
    } catch (e) {
      const msg = e.response?.data?.message || "Failed to start upload";
      toast.error(msg);
      setIsUploading(false);
    }
  };

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await getYouTubeUploadStatus(projectId);
        if (res.data.success) {
          setUploadState(res.data);
          if (res.data.status === "COMPLETED") {
            setStatus("completed");
            clearInterval(pollRef.current);
            toast.success("YouTube Upload Complete!");
          } else if (res.data.status === "FAILED") {
            setStatus("error");
            clearInterval(pollRef.current);
          } else {
            setStatus(res.data.status.toLowerCase()); // uploading, processing
          }
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 5000); // Poll every 5s for Youtube
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="glass-card p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="animate-spin text-[#D4AF37]" size={24} />
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden mt-6">
      <div className="p-4 border-b border-[#2a2a2a] bg-[#141414] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Youtube className="text-red-500" size={20} />
          <h3 className="text-white font-bold">YouTube Integration</h3>
        </div>
        
        {channelInfo && status !== "uploading" && status !== "processing" && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-[#1a1a1a] rounded-full border border-[#2a2a2a]">
              {channelInfo.thumbnail && (
                <img src={channelInfo.thumbnail} alt="Channel" className="w-5 h-5 rounded-full" />
              )}
              <span className="text-xs text-slate-300 font-semibold">{channelInfo.title}</span>
            </div>
            <button onClick={handleDisconnect} className="text-xs text-slate-500 hover:text-red-400">
              Disconnect
            </button>
          </div>
        )}
      </div>

      <div className="p-6">
        {status === "disconnected" && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Youtube className="text-red-500" size={32} />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Connect to YouTube</h4>
            <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
              Authorize your YouTube channel to upload generated videos directly from this app.
            </p>
            <button 
              onClick={handleConnect}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all"
            >
              <Youtube size={18} />
              Connect YouTube
            </button>
          </div>
        )}

        {(status === "connected" || status === "error") && (
          <div className="space-y-5">
            {status === "error" && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-3">
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-bold">Upload Failed</p>
                  <p className="opacity-80">{uploadState?.errorMessage || "An unknown error occurred"}</p>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <h4 className="text-white font-semibold">Video Details</h4>
              <button 
                onClick={handleGenerateMetadata}
                disabled={isGeneratingMeta}
                className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-all disabled:opacity-50"
              >
                {isGeneratingMeta ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Generate with AI
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Title *</label>
                <input 
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  maxLength={100}
                  placeholder="Cinematic Masterpiece..."
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-white focus:border-[#D4AF37]/50 focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Description</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  rows={4}
                  placeholder="In this short film, we explore..."
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-white focus:border-[#D4AF37]/50 focus:outline-none text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Tags (comma separated)</label>
                <input 
                  type="text"
                  value={formData.tags}
                  onChange={e => setFormData({...formData, tags: e.target.value})}
                  placeholder="cinematic, short, ai video"
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-white focus:border-[#D4AF37]/50 focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Privacy</label>
                <select
                  value={formData.privacyStatus}
                  onChange={e => setFormData({...formData, privacyStatus: e.target.value})}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-white focus:border-[#D4AF37]/50 focus:outline-none text-sm"
                >
                  <option value="private">Private (Only you)</option>
                  <option value="unlisted">Unlisted (Anyone with link)</option>
                  <option value="public">Public (Everyone)</option>
                </select>
              </div>
            </div>

            <button 
              onClick={handleUpload}
              disabled={isUploading || !formData.title}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[#D4AF37] text-black font-bold rounded-xl transition-all hover:bg-[#e8c84e] disabled:opacity-50 mt-4"
            >
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
              Upload to YouTube
            </button>
          </div>
        )}

        {(status === "uploading" || status === "processing") && (
          <div className="text-center py-8">
            <Loader2 size={40} className="text-[#D4AF37] animate-spin mx-auto mb-4" />
            <h4 className="text-lg font-bold text-white mb-2">
              {status === "uploading" ? "Uploading to YouTube..." : "Processing on YouTube..."}
            </h4>
            <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
              Please don't close this page. The video is being transferred securely.
            </p>
          </div>
        )}

        {status === "completed" && uploadState?.url && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-emerald-500" size={32} />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Upload Complete!</h4>
            <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
              Your cinematic video has been successfully published to YouTube.
            </p>
            
            <a 
              href={uploadState.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all"
            >
              <Youtube size={18} />
              Watch on YouTube
            </a>
            
            <div className="mt-6 flex justify-center">
              <button onClick={() => setStatus("connected")} className="text-xs text-slate-500 hover:text-white transition-colors">
                Upload Another Video
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
