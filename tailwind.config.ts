import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Placeholder premium palette — replace with real design tokens.
        brand: {
          DEFAULT: "#0B0B0C",
          gold: "#B08D57",
          ivory: "#F5F2ED",
        },
      },
    },
  },
  plugins: [],
};

export default config;
