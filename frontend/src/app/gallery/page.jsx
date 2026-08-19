"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getProjects, getMediaUrl, deleteProject } from "../../utils/api";
import { Film, Trash2, ArrowLeft, Loader2, Play, Youtube, X } from "lucide-react";
import toast from "react-hot-toast";
import YouTubeSection from "../../components/youtube/YouTubeSection";

export default function GalleryPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingProject, setUploadingProject] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await getProjects();
      if (res.data.success) {
        setProjects(res.data.data);
      }
    } catch (err) {
      toast.error("Failed to fetch gallery videos");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this video?")) return;
    try {
      await deleteProject(id);
      toast.success("Video deleted");
      setProjects(projects.filter(p => p.id !== id));
    } catch (err) {
      toast.error("Failed to delete video");
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-20">
      {/* Header */}
      <div className="border-b border-[#1a1a1a] bg-[#141414] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Film className="text-[#D4AF37]" size={24} />
              My Cinematic Videos
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Your generated AI short films
            </p>
          </div>
          <Link
            href="/ai-video"
            className="flex items-center gap-2 px-5 py-2.5 bg-[#D4AF37]/10 text-[#D4AF37] font-semibold rounded-lg hover:bg-[#D4AF37]/20 transition-colors"
          >
            <ArrowLeft size={16} />
            Create New Video
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 size={40} className="animate-spin mb-4 text-[#D4AF37]" />
            <p>Loading your videos...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-[#2a2a2a] rounded-2xl bg-[#141414]">
            <Film size={48} className="text-slate-600 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">No videos yet</h3>
            <p className="text-slate-400 mb-6 text-center max-w-md">
              You haven't generated any cinematic videos yet. Start creating your first story!
            </p>
            <Link
              href="/ai-video"
              className="px-6 py-3 bg-[#D4AF37] text-black font-bold rounded-xl hover:bg-[#e8c84e] transition-colors"
            >
              Generate a Video
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div key={project.id} className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden hover:border-[#D4AF37]/50 transition-colors group flex flex-col">
                <div className="relative aspect-[9/16] bg-black">
                  <video 
                    src={getMediaUrl(project.video_path)}
                    className="w-full h-full object-cover"
                    controls
                    preload="metadata"
                  />
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur px-2.5 py-1 rounded text-xs font-semibold text-white border border-white/10">
                    {project.duration}s
                  </div>
                </div>
                
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-white font-bold text-lg line-clamp-1 flex-1" title={project.title}>
                      {project.title}
                    </h3>
                  </div>
                  
                  <p className="text-slate-400 text-sm line-clamp-2 mb-4 flex-1">
                    {project.description}
                  </p>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#2a2a2a]">
                    <span className="text-xs font-semibold px-2 py-1 bg-[#1a1a1a] rounded text-slate-400">
                      {project.style}
                    </span>
                    
                    <div className="flex items-center gap-2">
                      {project.youtube_status === "COMPLETED" && project.youtube_url ? (
                        <a 
                          href={project.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded text-xs font-bold transition-colors"
                          title="Watch on YouTube"
                        >
                          <Youtube size={14} />
                          YouTube
                        </a>
                      ) : (
                        <button
                          onClick={() => setUploadingProject(project)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20 rounded text-xs font-bold transition-colors"
                          title="Upload to YouTube"
                        >
                          <Youtube size={14} />
                          Upload
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                        title="Delete Video"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* YouTube Upload Modal */}
      {uploadingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#141414] sticky top-0 z-10">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Youtube className="text-red-500" />
                Upload "{uploadingProject.title}" to YouTube
              </h2>
              <button 
                onClick={() => setUploadingProject(null)}
                className="p-2 text-slate-400 hover:text-white bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              <YouTubeSection 
                projectId={uploadingProject.id} 
                initialYouTubeStatus={uploadingProject.youtube_status || "NOT_STARTED"} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
