/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080b11",
        surface: "#0d1321",
        surfaceBorder: "#1e2d45",
        brand: {
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
        },
        accent: {
          emerald: "#10b981",
          rose:    "#f43f5e",
          amber:   "#f59e0b",
          violet:  "#8b5cf6",
          cyan:    "#06b6d4",
        },
      },
      boxShadow: {
        glow:          "0 0 20px -4px rgba(6,182,212,0.45)",
        "glow-sm":     "0 0 12px -3px rgba(6,182,212,0.30)",
        "glow-lg":     "0 0 36px -4px rgba(6,182,212,0.55)",
        "glow-emerald":"0 0 20px -4px rgba(16,185,129,0.40)",
        "glow-rose":   "0 0 20px -4px rgba(244,63,94,0.40)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in":    "fadeIn 0.25s ease-out both",
        "slide-up":   "slideUp 0.30s ease-out both",
        "spin-slow":  "spin 3s linear infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
      backgroundImage: {
        "grid-pattern": `linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px), linear-gradient(to right, rgba(6,182,212,0.04) 1px, transparent 1px)`,
      },
    },
  },
  plugins: [],
};
