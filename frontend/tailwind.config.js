/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#EEF2FF',
          100: '#E8F2FC',
          400: '#5B9BFF',
          500: '#2F7BFF',
          600: '#1F5FCC',
          700: '#1849A0',
        },
        navy: '#0B0F16',
        navbar: '#080B11',
        card: '#141B28',
        field: '#1C2436',
        muted: '#8B98AD',
        dim: '#5E6E84',
        teal: '#2EE6C8',
        pink: '#FF5B7A',
      },
      borderRadius: {
        pill: '26px',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px -18px rgba(0,0,0,0.65)',
        glow: '0 8px 28px -10px rgba(47,123,255,0.45)',
      },
    },
  },
  plugins: [],
}
