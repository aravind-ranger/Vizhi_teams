/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          hover: "rgb(var(--primary-hover) / <alpha-value>)",
        },
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        purple: "rgb(var(--purple) / <alpha-value>)",
        background: "rgb(var(--background) / <alpha-value>)",
        glass: "rgb(var(--glass) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        text: {
          primary: "rgb(var(--text-primary) / <alpha-value>)",
          secondary: "rgb(var(--text-secondary) / <alpha-value>)",
          muted: "rgb(var(--text-muted) / <alpha-value>)",
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
