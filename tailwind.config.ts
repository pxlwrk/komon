import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          200: '#bcddff',
          300: '#8ec8ff',
          400: '#59a9ff',
          500: '#3286fb',
          600: '#1c66f0',
          700: '#1750dc',
          800: '#1942b2',
          900: '#1a3b8c',
          950: '#152555',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
