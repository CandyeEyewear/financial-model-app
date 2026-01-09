/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  darkMode: 'class', // Enable dark mode with class strategy
  theme: {
    extend: {
      // ============================================================================
      // COLOR PALETTE - Banking/Finance Professional Theme
      // ============================================================================
      colors: {
        // Primary - Professional Blue (Trust, Stability)
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Success - Green (Positive metrics, approvals)
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        // Warning - Amber (Caution, attention needed)
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        // Danger - Red (Breaches, critical alerts)
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        // Info - Indigo (Information, insights)
        info: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Neutral - Slate (Text, borders, backgrounds)
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Chart colors for data visualization
        chart: {
          blue: '#2563eb',
          green: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
          purple: '#8b5cf6',
          cyan: '#06b6d4',
          pink: '#ec4899',
          indigo: '#6366f1',
        },
      },
      
      // ============================================================================
      // TYPOGRAPHY - Professional Financial Application
      // ============================================================================
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace',
        ],
      },
      fontSize: {
        // Display sizes for headers
        'display-xl': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-lg': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        // Headline sizes
        'headline-lg': ['1.875rem', { lineHeight: '1.25', fontWeight: '600' }],
        'headline': ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        'headline-sm': ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
        // Body text
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        'body': ['1rem', { lineHeight: '1.5' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
        // Caption and labels
        'caption': ['0.75rem', { lineHeight: '1.4' }],
        'overline': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.05em', fontWeight: '600' }],
        // Numbers (for financial data)
        'number-xl': ['2rem', { lineHeight: '1.2', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }],
        'number-lg': ['1.5rem', { lineHeight: '1.2', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }],
        'number': ['1rem', { lineHeight: '1.4', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }],
        'number-sm': ['0.875rem', { lineHeight: '1.4', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }],
      },
      
      // ============================================================================
      // SPACING - Consistent layout system
      // ============================================================================
      spacing: {
        // Component-specific spacing
        'card': '1.5rem',
        'card-sm': '1rem',
        'card-lg': '2rem',
        'section': '2rem',
        'section-lg': '3rem',
        'gutter': '1rem',
        'gutter-lg': '1.5rem',
      },
      
      // ============================================================================
      // BORDER RADIUS - Consistent corner rounding
      // ============================================================================
      borderRadius: {
        'card': '0.75rem',
        'card-lg': '1rem',
        'button': '0.5rem',
        'button-lg': '0.75rem',
        'input': '0.5rem',
        'badge': '9999px',
        'chip': '0.375rem',
      },
      
      // ============================================================================
      // BOX SHADOWS - Elevation system
      // ============================================================================
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'card-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'modal': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        'dropdown': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'button': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'button-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'focus': '0 0 0 3px rgb(59 130 246 / 0.5)',
        'focus-danger': '0 0 0 3px rgb(239 68 68 / 0.5)',
        'focus-success': '0 0 0 3px rgb(34 197 94 / 0.5)',
        'inner-glow': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
      },
      
      // ============================================================================
      // ANIMATIONS - Smooth transitions
      // ============================================================================
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-out': 'fadeOut 0.2s ease-in',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'slide-in-up': 'slideInUp 0.3s ease-out',
        'slide-in-down': 'slideInDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'scale-out': 'scaleOut 0.15s ease-in',
        'spin-slow': 'spin 2s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'shimmer': 'shimmer 2s infinite',
        'progress': 'progress 1s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleOut: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.95)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        progress: {
          '0%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      
      // ============================================================================
      // TRANSITIONS - Consistent timing
      // ============================================================================
      transitionDuration: {
        'fast': '150ms',
        'normal': '200ms',
        'slow': '300ms',
        'slower': '500ms',
      },
      transitionTimingFunction: {
        'ease-out-back': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'ease-in-out-back': 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
      },
      
      // ============================================================================
      // Z-INDEX - Layering system
      // ============================================================================
      zIndex: {
        'dropdown': '1000',
        'sticky': '1020',
        'fixed': '1030',
        'modal-backdrop': '1040',
        'modal': '1050',
        'popover': '1060',
        'tooltip': '1070',
        'toast': '1080',
      },
      
      // ============================================================================
      // BACKDROP BLUR
      // ============================================================================
      backdropBlur: {
        xs: '2px',
      },
      
      // ============================================================================
      // RING WIDTHS & OFFSETS - For focus states
      // ============================================================================
      ringWidth: {
        '3': '3px',
      },
      ringOffsetWidth: {
        '3': '3px',
      },
    },
  },
  plugins: [
    // Custom plugin for focus-visible styling
    function({ addUtilities, addComponents, theme }) {
      // Focus visible utilities
      addUtilities({
        '.focus-ring': {
          '@apply focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2': {},
        },
        '.focus-ring-danger': {
          '@apply focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-500 focus-visible:ring-offset-2': {},
        },
        '.focus-ring-success': {
          '@apply focus:outline-none focus-visible:ring-2 focus-visible:ring-success-500 focus-visible:ring-offset-2': {},
        },
        // Scrollbar hiding
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        // Tabular numbers for financial data
        '.tabular-nums': {
          'font-variant-numeric': 'tabular-nums',
        },
        // Gradient text
        '.gradient-text': {
          'background-clip': 'text',
          '-webkit-background-clip': 'text',
          'color': 'transparent',
        },
      });
      
      // Custom component styles
      addComponents({
        // Financial metric display
        '.metric-positive': {
          '@apply text-success-600 dark:text-success-400': {},
        },
        '.metric-negative': {
          '@apply text-danger-600 dark:text-danger-400': {},
        },
        '.metric-neutral': {
          '@apply text-neutral-600 dark:text-neutral-400': {},
        },
        // Status badges
        '.badge-success': {
          '@apply inline-flex items-center px-2.5 py-0.5 rounded-badge text-caption font-semibold bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400': {},
        },
        '.badge-warning': {
          '@apply inline-flex items-center px-2.5 py-0.5 rounded-badge text-caption font-semibold bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400': {},
        },
        '.badge-danger': {
          '@apply inline-flex items-center px-2.5 py-0.5 rounded-badge text-caption font-semibold bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400': {},
        },
        '.badge-info': {
          '@apply inline-flex items-center px-2.5 py-0.5 rounded-badge text-caption font-semibold bg-info-100 text-info-800 dark:bg-info-900/30 dark:text-info-400': {},
        },
      });
    },
  ],
};
