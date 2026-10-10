/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f5fa',
          100: '#e1ecf5',
          200: '#c3d9eb',
          300: '#94bedd',
          400: '#5e9ecb',
          500: '#3880b5',
          600: '#276698',
          700: '#20517b',
          800: '#1d4567',
          900: '#1c3b55',
          950: '#0e2334',
        },
      },
    },
  },
  plugins: [],
}
