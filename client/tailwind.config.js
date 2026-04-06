/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lexend', 'sans-serif'],
      },
      colors: {
        papagai: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
        },
      },
      backgroundImage: {
        'gradient-papagai': 'linear-gradient(135deg, #fae8ff 0%, #e0f2fe 50%, #dcfce7 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #fdf4ff 0%, #f0f9ff 50%, #f0fdf4 100%)',
        'gradient-accent': 'linear-gradient(135deg, #d946ef 0%, #6366f1 50%, #06b6d4 100%)',
        'gradient-button': 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
      },
    },
  },
  plugins: [],
}
