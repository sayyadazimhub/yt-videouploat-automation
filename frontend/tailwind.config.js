/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: "#D4AF37",
        "gold-light": "#e8c84e",
        dark: "#0f0f0f",
        "dark-card": "#1a1a1a",
        "dark-border": "#2a2a2a",
        "dark-surface": "#141414",
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "Inter", "Arial", "Helvetica", "sans-serif"],
      },
      animation: {
        "pulse-bar": "pulse-bar 1.5s ease-in-out infinite",
        shimmer: "shimmer 1.5s infinite",
        "fade-up": "fadeUp 0.5s ease forwards",
      },
      keyframes: {
        "pulse-bar": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
