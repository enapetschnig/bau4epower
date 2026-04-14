/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#CC0000',
        'primary-dark': '#aa0000',
        'primary-light': '#ee1111',
        secondary: '#2c3e50',
        'gray-light': '#f5f6f8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
