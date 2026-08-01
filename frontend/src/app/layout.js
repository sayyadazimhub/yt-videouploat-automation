import "./globals.css";
import { Outfit } from "next/font/google";
import Navbar from "../components/Navbar";
import { Toaster } from "react-hot-toast";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata = {
  title: "AI Cinematic Video Generator",
  description: "Transform your story ideas into cinematic short videos using AI — powered by Gemini, FFmpeg, and advanced image generation.",
  keywords: "AI video generator, cinematic video, story to video, Gemini AI",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="min-h-screen bg-[#0f0f0f] text-white">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1a1a1a",
              color: "#f1f1f1",
              border: "1px solid #2a2a2a",
            },
            success: { iconTheme: { primary: "#D4AF37", secondary: "#0f0f0f" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#0f0f0f" } },
          }}
        />
        <Navbar />
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
