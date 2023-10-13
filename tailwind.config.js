/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    colors: {
      accent: "#4E9590",
      invalid: "#BF0E0E",
      brackets: "#F2CAB8",
      "gray-50": "#F7F7F7",
      "gray-100": "#E4E4E4",
      "gray-200": "#BFBFBF",
      black: "#000000",
      white: "#FFFFFF",
    },
    extend: {
      fontFamily: {
        sans: ['"Inter", sans-serif'],
      },
    },
  },
  plugins: [],
};
