/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF2FF',
          100: '#E8F2FC',
          400: '#3B5EF5',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E3A8A',
        },
      },
    },
  },
  plugins: [],
}
