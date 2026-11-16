/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
        score: ['"Barlow Condensed"', '"Be Vietnam Pro"', 'sans-serif'],
      },
      colors: {
        ink: { 950: '#140C0D', 900: '#1E1416', 800: '#2E2224', 700: '#45373A', 500: '#6E6264', 400: '#9A8F91', 300: '#CFC7C8', 200: '#E7E1E1', 100: '#F3EFEF', 50: '#FAF8F7' },
        brand: { 50: '#FDF2F2', 100: '#FBE0E0', 500: '#D62D2D', 600: '#B91C1C', 700: '#8F1416', 800: '#6B0F12', 900: '#4A0A0D', 950: '#2B0507' },
        gold: { DEFAULT: '#F2B530', 300: '#F8D77A', 600: '#D99A0B', 700: '#9A6A00' },
        live: { DEFAULT: '#E11D48', 50: '#FFE4E8' },
        sideA: { DEFAULT: '#B91C1C', 700: '#8F1416' },
        sideB: { DEFAULT: '#F2B530', 700: '#D99A0B' },
      },
    },
  },
  plugins: [],
}
