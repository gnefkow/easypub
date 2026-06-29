import type { Config } from 'tailwindcss'

export default {
  presets: [require('counterfoil-starter-kit/tailwind-preset')],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './node_modules/counterfoil-starter-kit/dist/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0f172a',
        onPrimary: '#ffffff',
        secondary: '#10b981',
        onSecondary: '#ffffff',
      },
      borderRadius: {
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
      },
      fontSize: {
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
      },
      fontFamily: {
        contentTypeface: ['serif'],
        uiTypeface: ['sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
