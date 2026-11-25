/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: {
          light: '#FAFAFA',
          dark: '#09090B',
        },
        card: {
          light: '#FFFFFF',
          dark: '#111113',
        },
        present: '#10B981',
        absent: '#F43F5E',
        halfday: '#F59E0B',
        holiday: '#71717A',
      },
    },
  },
  plugins: [],
};
