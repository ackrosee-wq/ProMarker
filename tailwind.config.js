/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#1e1e1e',
        fg: '#d8d8d8',
        accent: '#5b9fd6',
        surface: '#252525',
        border: 'rgba(255,255,255,0.08)',
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
  plugins: [],
};
