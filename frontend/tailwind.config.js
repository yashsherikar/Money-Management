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
          400: '#4C8CFF',
          500: '#226DFF',
          600: '#1B57CC',
          700: '#16419E',
        },
        navy: '#0D1117',
        navbar: '#0A0E14',
        card: '#161D2B',
        field: '#1F293A',
        muted: '#8A99AD',
        dim: '#5C6E82',
        teal: '#00F5D4',
        pink: '#FF5376',
      },
      borderRadius: {
        pill: '26px',
      },
    },
  },
  plugins: [],
}
