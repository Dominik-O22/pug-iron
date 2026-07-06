/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.js", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#0C1210",
        panel: "#131C1A",
        "panel-2": "#1A2622",
        line: "#24332E",
        text: "#D7E4E0",
        "text-dim": "#7E938D",
        mint: "#6FD3C0",
        petrol: "#0E5A54",
        amber: "#E8B04B",
        danger: "#C96A5B"
      },
      fontFamily: {
        barlow: ["BarlowSemiCondensed-Regular"],
        "barlow-semibold": ["BarlowSemiCondensed-SemiBold"],
        "barlow-bold": ["BarlowSemiCondensed-Bold"],
        mono: ["IBMPlexMono-Regular"],
        "mono-medium": ["IBMPlexMono-Medium"]
      }
    }
  },
  plugins: []
};
