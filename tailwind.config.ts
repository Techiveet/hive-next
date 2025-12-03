// tailwind.config.ts

import type { Config } from "tailwindcss";

const config: Config = {
  // ✅ FIX: Use string "class", not an array ["class"]
  darkMode: "class", 
  content: [
    "./app/**/*.{ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}",
    "./lib/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;