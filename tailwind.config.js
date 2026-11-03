/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2853AF",
          end: "#1E4292",
          sky: "#40B4F8",
          ice: "#E8F2FF",
        },
        charcoal: {
          DEFAULT: "#171725",
          elevated: "#1B2234",
        },
        emerald: {
          DEFAULT: "#34977D",
        },
        gold: {
          DEFAULT: "#EDB900",
        },
        danger: {
          DEFAULT: "#F41F52",
        },
        slateDark: "#171725",
        subtext: "#66707A",
        muted: "#9CA4AB",
        surfaceIce: "#F5F8FD",
        cardBorder: "#E9EBED",
      },
      borderRadius: {
        "card-lg": "20px",
        "card-md": "16px",
        pill: "32px",
      },
    },
  },
  plugins: [],
};
