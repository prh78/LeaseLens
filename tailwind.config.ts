import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        "extraction-aura": {
          "0%, 100%": {
            boxShadow: "0 0 0 0 rgb(125 211 252 / 0)",
          },
          "50%": {
            boxShadow: "0 0 14px 3px rgb(56 189 248 / 0.22)",
          },
        },
        "extraction-dot-glow": {
          "0%, 100%": {
            opacity: "1",
            filter: "drop-shadow(0 0 2px rgb(56 189 248 / 0.45))",
          },
          "50%": {
            opacity: "0.88",
            filter: "drop-shadow(0 0 8px rgb(14 165 233 / 0.75))",
          },
        },
      },
      animation: {
        "extraction-aura": "extraction-aura 2.2s ease-in-out infinite",
        "extraction-dot-glow": "extraction-dot-glow 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
