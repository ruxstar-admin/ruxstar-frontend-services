import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#050505",
        panel: "#0c0c0e",
      },
      boxShadow: {
        glow: "0 0 40px -12px rgba(99, 102, 241, 0.35)",
        "glow-sm": "0 0 24px -8px rgba(99, 102, 241, 0.25)",
      },
      animation: {
        "fade-in": "fadeIn 0.45s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
