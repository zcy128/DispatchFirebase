/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F172A',
          dark: '#020617',
        },
        secondary: '#334155',
        accent: {
          DEFAULT: '#0369A1',
          light: '#0284C7',
          pale: '#E0F2FE',
        },
        surface: '#F8FAFC',
        muted: '#475569',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
        'card-hover': '0 10px 25px -5px rgb(15 23 42 / 0.08), 0 4px 6px -4px rgb(15 23 42 / 0.04)',
        nav: '0 4px 24px -4px rgb(15 23 42 / 0.12)',
      },
    },
  },
  plugins: [],
}
