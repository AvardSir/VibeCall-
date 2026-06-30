/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: '#0f1117', muted: '#1a1d27' },
        accent: { DEFAULT: '#4f7cff' },
      },
    },
  },
  plugins: [],
};
