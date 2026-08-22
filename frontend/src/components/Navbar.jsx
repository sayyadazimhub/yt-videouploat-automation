"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, Clapperboard, Sparkles } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0a0a0a]/80 backdrop-blur-2xl border-b border-blue-500/20 shadow-[0_4px_30px_rgba(59,130,246,0.1)] transition-all duration-500">
      <div className="max-w-7xl mx-auto flex h-[72px] items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Logo */}
        <Link href="/ai-video" className="flex items-center gap-3 group relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-400 blur-xl opacity-20 group-hover:opacity-50 transition-opacity duration-500 rounded-full"></div>
          <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-[#0a192f] to-[#020c1b] border border-blue-500/40 flex items-center justify-center group-hover:scale-105 transition-transform duration-500 shadow-inner">
            <Sparkles size={20} className="text-cyan-400 group-hover:text-blue-300 transition-colors duration-500" />
          </div>
          <div className="flex flex-col leading-none ml-1">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 font-extrabold text-lg tracking-tight">AI Cinema</span>
            <span className="text-blue-400 text-[9px] font-black tracking-[0.25em] uppercase mt-1">Studio</span>
          </div>
        </Link>

        {/* Nav Links */}
        <nav className="flex items-center gap-8 h-full">
          <Link
            href="/ai-video"
            className={`relative flex items-center h-full px-2 text-sm font-bold transition-colors duration-300 ${
              pathname === "/ai-video" 
                ? "text-cyan-400" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <Film size={16} className={pathname === "/ai-video" ? "text-cyan-400" : "text-slate-500"} />
              Generate Video
            </div>
            {pathname === "/ai-video" && (
              <span className="absolute left-0 bottom-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] rounded-t-full" />
            )}
          </Link>
          <Link
            href="/gallery"
            className={`relative flex items-center h-full px-2 text-sm font-bold transition-colors duration-300 ${
              pathname === "/gallery" 
                ? "text-cyan-400" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <Clapperboard size={16} className={pathname === "/gallery" ? "text-cyan-400" : "text-slate-500"} />
              My Gallery
            </div>
            {pathname === "/gallery" && (
              <span className="absolute left-0 bottom-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] rounded-t-full" />
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
