/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forestDark: '#030C08',
        forestPanel: '#061911',
        forestBorder: 'rgba(52, 211, 153, 0.25)',
        apricot: '#FDBA74',
        apricotLight: '#FED7AA',
        apricotWarm: '#FB923C',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'forest-glow': '0 8px 32px 0 rgba(6, 25, 17, 0.6), 0 0 20px rgba(52, 211, 153, 0.1)',
        'apricot-glow': '0 0 20px rgba(251, 146, 60, 0.35)',
      },
    },
  },
  plugins: [],
}
