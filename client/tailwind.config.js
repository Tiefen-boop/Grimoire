/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: '#fdf9f0',
          100: '#f9f0d9',
          200: '#f0ddb0',
        },
        crimson: {
          600: '#9b1c2e',
          700: '#7f1624',
          800: '#621020',
        }
      }
    }
  },
  plugins: []
}
