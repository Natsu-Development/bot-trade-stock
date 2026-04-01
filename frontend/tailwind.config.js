import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Background Colors
        background: 'var(--bg-void)',
        'bg-void': 'var(--bg-void)',
        'bg-deep': 'var(--bg-deep)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        hover: 'var(--bg-hover)',
        // Border Colors
        'border-dim': 'var(--border-dim)',
        'border-glow': 'var(--border-glow)',
        // Text Colors
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        // Neon Colors
        'neon-bull': 'var(--neon-bull)',
        'neon-bull-dim': 'var(--neon-bull-dim)',
        'neon-bear': 'var(--neon-bear)',
        'neon-bear-dim': 'var(--neon-bear-dim)',
        'neon-cyan': 'var(--neon-cyan)',
        'neon-cyan-dim': 'var(--neon-cyan-dim)',
        'neon-amber': 'var(--neon-amber)',
        'neon-purple': 'var(--neon-purple)',
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
      boxShadow: {
        'neon-bull': 'var(--neon-bull-glow)',
        'neon-bear': 'var(--neon-bear-glow)',
        'neon-cyan': 'var(--neon-cyan-glow)',
      },
      animationDuration: {
        '600': '600ms',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'slide-in-from-top': {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-from-bottom': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-from-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-out-to-right': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        'slide-out-to-top': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-20px)', opacity: '0' },
        },
        'row-fade-in': {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'orb-float': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(-10%, 10%) scale(1.1)' },
        },
        'status-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'logo-pulse': {
          '0%, 100%': { boxShadow: 'var(--neon-bull-glow)' },
          '50%': { boxShadow: '0 0 30px rgba(0, 255, 136, 0.4), 0 0 60px rgba(0, 255, 136, 0.2)' },
        },
        'chart-scan': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'stat-card-in': {
          '0%': { opacity: '0', transform: 'translateY(20px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-out': 'fade-out 0.3s ease-out',
        'slide-in-from-top': 'slide-in-from-top 0.5s ease-out',
        'slide-in-from-bottom': 'slide-in-from-bottom 0.4s ease-out',
        'slide-in-from-right': 'slide-in-from-right 0.3s ease-out',
        'slide-out-to-right': 'slide-out-to-right 0.3s ease-out',
        'slide-out-to-top': 'slide-out-to-top 0.3s ease-out',
        'row-fade-in': 'row-fade-in 0.3s ease-out',
        'orb-float': 'orb-float 20s ease-in-out infinite',
        'status-blink': 'status-blink 1.5s ease-in-out infinite',
        'logo-pulse': 'logo-pulse 2s ease-in-out infinite',
        'chart-scan': 'chart-scan 3s linear infinite',
        'stat-card-in': 'stat-card-in 0.6s ease-out backwards',
        'spin': 'spin 1s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
