/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Circus theme colors
        'circus-gold': '#FFD700',
        'circus-red': '#FF1744',
        'circus-cream': '#FFF5E6',
        'circus-blue': '#00E5FF',
        'circus-yellow': '#FFD700',
        'circus-orange': '#FF8C00',
        'circus-gray': '#2C2C2C',
        'background': '#0A0A0A',
        'muted-foreground': '#A1A1AA',
        'gradient-gold': 'linear-gradient(45deg, #FFD700, #FFA500)',
        'shadow-circus': '0 8px 32px rgba(255, 215, 0, 0.3)',
        'shadow-gold': '0 4px 16px rgba(255, 215, 0, 0.4)',
        'shadow-circus-red': '0 8px 32px rgba(255, 23, 68, 0.3)',
        'shadow-circus-yellow': '0 8px 32px rgba(255, 215, 0, 0.3)',
        'gradient-circus': 'linear-gradient(135deg, #FF1744, #FFD700, #00E5FF)',
      },
      fontFamily: {
        'display': ['"Poppins", sans-serif'],
        'body': ['"Inter", sans-serif'],
        'circus': ['"Bungee", cursive'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'sparkle': 'sparkle 2s ease-in-out infinite',
        'ferris': 'ferris 10s linear infinite',
        'ping-slow': 'ping 4s cubic-bezier(0, 0, 0.2, 1) infinite',
        'bounce': 'bounce 3s infinite',
        'wiggle': 'wiggle 1.5s ease-in-out infinite',
        'pulse-slow': 'pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'float-fast': 'float 4s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'fade-in': 'fadeIn 1s ease-in forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '25%': { transform: 'translateY(-15px) rotate(2deg)', opacity: '0.9' },
          '50%': { transform: 'translateY(-25px) rotate(0deg)', opacity: '1' },
          '75%': { transform: 'translateY(-15px) rotate(-2deg)', opacity: '0.9' },
        },
        sparkle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
          '25%': { opacity: '0.8', transform: 'scale(1.1) rotate(5deg)' },
          '50%': { opacity: '1', transform: 'scale(1.2) rotate(0deg)' },
          '75%': { opacity: '0.8', transform: 'scale(1.1) rotate(-5deg)' },
        },
        ferris: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        ping: {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '70%, 100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        bounce: {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '25%': { transform: 'translateY(-15px) scale(1.05)' },
          '50%': { transform: 'translateY(0) scale(1)' },
          '75%': { transform: 'translateY(-10px) scale(1.03)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg) scale(1.02)' },
          '50%': { transform: 'rotate(3deg) scale(1.02)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulse: {
          '0%, 100%': { opacity: '0.1', transform: 'scale(1)' },
          '50%': { opacity: '0.15', transform: 'scale(1.03)' },
        },
      },
      backdropBlur: {
        'xs': '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'card': '0 10px 20px rgba(0,0,0,0.25)',
      },
      borderRadius: {
        'xl': '1rem',
      },
    },
  },
  plugins: [],
}
