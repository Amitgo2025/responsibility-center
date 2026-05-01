/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Inter Tight"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f7f5f2',
          100: '#ebe7e0',
          200: '#d4ccc0',
          300: '#a89e91',
          400: '#7a7165',
          500: '#544c43',
          600: '#3a342e',
          700: '#2a2520',
          800: '#1c1815',
          900: '#0f0d0b',
        },
        accent: {
          DEFAULT: '#c46a3a',
          light: '#e08a5a',
          dark: '#a8501f',
        },
      },
    },
  },
  plugins: [],
}
