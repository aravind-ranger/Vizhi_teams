/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#3B5BDB",
          hover: "#3451C7",
        },
        success: "#2F9E44",
        warning: "#F08C00",
        danger: "#E03131",
        purple: "#7048E8",
        background: "#F8F9FA",
        border: "#DEE2E6",
        text: {
          primary: "#212529",
          secondary: "#495057",
          muted: "#868E96",
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      borderRadius: {
        'badge': '6px',
        'input': '10px',
        'button': '10px',
        'card': '16px',
        'modal': '24px',
      },
      boxShadow: {
        'card': '0 4px 20px rgba(0,0,0,0.03)',
        'modal': '0 30px 60px -12px rgba(0,0,0,0.15)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      }
    },
  },
  plugins: [],
}
