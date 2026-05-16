import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette médicale haut de gamme : bleus & gris
        medical: {
          50: "#f0f6fb",
          100: "#dbe9f4",
          200: "#bcd5ea",
          300: "#8eb8da",
          400: "#5b94c4",
          500: "#3a76ad",
          600: "#2c5d92",
          700: "#264c77",
          800: "#234163",
          900: "#213854",
          950: "#162437",
        },
        slate: {
          850: "#172033",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
