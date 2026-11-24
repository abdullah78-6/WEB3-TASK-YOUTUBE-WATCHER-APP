/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cinema: {
          950: "#090b10",
          900: "#111520",
          800: "#1a2030",
          700: "#262f45",
        },
      },
    },
  },
  plugins: [],
};
