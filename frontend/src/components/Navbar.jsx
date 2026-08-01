"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, Clapperboard } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-[#2a2a2a] bg-[#0f0f0f]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/ai-video" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center group-hover:bg-[#D4AF37]/20 transition-colors">
            <Clapperboard size={18} className="text-[#D4AF37]" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-white font-bold text-sm tracking-wide">AI Cinema</span>
            <span className="text-[#D4AF37] text-[10px] font-semibold tracking-widest uppercase">Video Generator</span>
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-6">
          <Link
            href="/ai-video"
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
              pathname === "/ai-video" ? "text-[#D4AF37]" : "text-slate-400 hover:text-white"
            }`}
          >
            <Film size={15} />
            Generate Video
          </Link>
        </nav>
      </div>
    </header>
  );
}
