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
    <div className="min-h-screen bg-[#0a0a0a] pb-20 selection:bg-blue-500/30 relative">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />


      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <Loader2 size={48} className="animate-spin mb-6 text-cyan-400" />
            <p className="font-semibold text-lg animate-pulse">Loading your masterpieces...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 border border-dashed border-white/10 rounded-3xl bg-white/[0.02] backdrop-blur-sm">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10">
              <Film size={32} className="text-slate-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">The Gallery is Empty</h3>
            <p className="text-slate-400 mb-8 text-center max-w-md font-medium leading-relaxed">
              You haven't generated any cinematic videos yet. Spark your imagination and start creating your first story!
            </p>
            <Link
              href="/ai-video"
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-extrabold rounded-full hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:scale-105 transition-all duration-300"
            >
              Start Generating
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {projects.map((project) => (
              <div key={project.id} className="bg-[#0f0f0f] border border-white/10 rounded-[24px] overflow-hidden hover:border-cyan-500/50 transition-all duration-500 group flex flex-col relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                
                <div className="relative h-[280px] w-full bg-black rounded-t-[24px] overflow-hidden">
                  <video 
                    src={getMediaUrl(project.video_path)}
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                    controls
                    preload="metadata"
                  />
                  <div className="absolute top-4 left-4 bg-cyan-500/20 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-cyan-300 border border-cyan-500/30 shadow-[0_4px_12px_rgba(0,0,0,0.5)] pointer-events-none">
                    {project.style}
                  </div>
                </div>
                
                <div className="p-6 flex flex-col flex-1 relative z-10 bg-gradient-to-b from-[#111] to-[#0a0a0a]">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-white font-black text-xl line-clamp-1 flex-1 tracking-tight group-hover:text-cyan-400 transition-colors duration-300" title={project.title}>
                      {project.title}
                    </h3>
                  </div>
                  
                  <p className="text-slate-400 text-sm line-clamp-2 mb-6 flex-1 leading-relaxed">
                    {project.description}
                  </p>
                  
                  <div className="mt-auto pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                    {project.youtube_status === "COMPLETED" && project.youtube_url ? (
                      <a 
                        href={project.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 h-10 bg-[#FF0000]/10 text-red-500 hover:bg-[#FF0000] hover:text-white rounded-lg text-sm font-semibold transition-all duration-300 border border-[#FF0000]/20 hover:border-[#FF0000] hover:shadow-[0_0_20px_rgba(255,0,0,0.3)]"
                      >
                        <Youtube size={18} />
                        <span>Watch on YouTube</span>
                      </a>
                    ) : (
                      <button
                        onClick={() => setUploadingProject(project)}
                        className="flex-1 flex items-center justify-center gap-2 h-10 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-lg text-sm font-semibold transition-all duration-300 shadow-[0_4px_15px_rgba(34,211,238,0.3)] hover:shadow-[0_6px_20px_rgba(34,211,238,0.5)] transform hover:-translate-y-0.5"
                      >
                        <Youtube size={18} />
                        <span>Publish to YouTube</span>
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                      title="Delete Video"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* YouTube Upload Modal */}
      {uploadingProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden my-8 transform transition-all scale-100 opacity-100">
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none" />
            <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/[0.02] sticky top-0 z-10 backdrop-blur-md">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Youtube className="text-red-500" size={20} />
                Upload "{uploadingProject.title}" to YouTube
              </h2>
              <button 
                onClick={() => setUploadingProject(null)}
                className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto relative z-10">
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
