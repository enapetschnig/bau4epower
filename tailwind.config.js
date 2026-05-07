/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#f68714',
        'primary-dark': '#d97206',
        'primary-light': '#ffa040',
        'primary-50': '#fff7ed',
        'primary-100': '#ffedd5',
        secondary: '#1f2937',
        'gray-light': '#f5f5f5',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
