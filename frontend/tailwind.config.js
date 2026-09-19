/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#d9edff',
          500: '#2f6fed',
          600: '#2557c7',
          700: '#1d449e',
        },
      },
    },
  },
  plugins: [],
}
