/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F2F5F3',
        ink: '#17211E',
        pine: '#145C38',
        moss: '#E4F2EA',
        line: '#D5DED8',
        mist: '#5E756C',
        sea: '#1F4E79',
        clay: '#6E241F',
        amber: '#8A5608',
        night: '#101614',
        panel: '#1A2420',
        muted: '#3E5248',
      },
      fontFamily: {
        sans: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Literata', 'Georgia', 'serif'],
      },
      boxShadow: {
        slip: '0 1px 0 rgba(23, 33, 30, 0.08)',
      },
    },
  },
  plugins: [],
}
