const { colors } = require("./tokens");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.js", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors,
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
