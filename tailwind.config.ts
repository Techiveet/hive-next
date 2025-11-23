// tailwind.config.ts

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"], // 👈 enables class-based dark mode
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
