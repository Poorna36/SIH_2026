/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lunaris: {
          bg: '#07080A',
          surface: '#0D0E12',
          panel: '#12141B',
          panelHover: '#181B24',
          border: 'rgba(212, 197, 154, 0.2)',
          borderBright: 'rgba(212, 197, 154, 0.5)',
          gold: '#D4C59A',
          goldLight: '#EBE2CD',
          goldMuted: '#A39062',
          goldDark: '#38311E',
          cream: '#FAF6EB',
          emerald: '#4ADE80',
          amber: '#FBBF24',
        },
        champagne: {
          50: '#FAF8F2',
          100: '#F5F0E4',
          200: '#EBE2CD',
          300: '#E0D2B4',
          400: '#D4C59A',
          500: '#C2B080',
          600: '#A8945F',
          700: '#7E6D43',
          800: '#54482B',
          900: '#2E2716',
        }
      },
      fontFamily: {
        headline: ['Unbounded', 'sans-serif'],
        unbounded: ['Unbounded', 'sans-serif'],
        subheading: ['"Instrument Serif"', 'Georgia', 'serif'],
        editorial: ['"Instrument Serif"', 'Georgia', 'serif'],
        cursive: ['"Instrument Serif"', 'Georgia', 'serif'],
        'mono-tech': ['"IBM Plex Mono"', 'monospace'],
        display: ['"Space Grotesk"', '"Noto Sans"', 'Roboto', 'sans-serif'],
        space: ['"Space Grotesk"', 'sans-serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
        sans: ['"DM Sans"', '"Noto Sans"', 'Roboto', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"Roboto Mono"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'lunaris-glow': '0 0 25px rgba(212, 197, 154, 0.35)',
        'lunaris-glow-sm': '0 0 12px rgba(212, 197, 154, 0.25)',
        'lunaris-card': '0 8px 32px 0 rgba(0, 0, 0, 0.7), inset 0 0 15px rgba(212, 197, 154, 0.03)',
      },
    },
  },
  plugins: [],
}
