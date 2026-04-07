/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          950: '#070814',
          900: '#0b0d1f',
          800: '#121633',
        },
        panel: {
          900: 'rgba(18, 22, 51, 0.72)',
          800: 'rgba(18, 22, 51, 0.52)',
        },
        brand: {
          500: '#7c3aed',
          400: '#a78bfa',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(167, 139, 250, 0.25), 0 20px 60px rgba(0, 0, 0, 0.55)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        floaty: 'floaty 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
