// Design System Configuration for Autocracy PMS
// Modern, professional design system for manufacturing and technology operations

export const designSystem = {
  // Color Palette
  colors: {
    // Primary Colors - Professional Blue
    primary: {
      50: '#eff6ff',
      100: '#dbeafe', 
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6', // Main primary
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554'
    },
    
    // Secondary Colors - Modern Gray
    secondary: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b', // Main secondary
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617'
    },
    
    // Accent Colors - Success Green
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e', // Main success
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      950: '#052e16'
    },
    
    // Warning Colors - Amber
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b', // Main warning
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
      950: '#451a03'
    },
    
    // Error Colors - Red
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444', // Main error
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
      950: '#450a0a'
    },
    
    // Neutral Colors
    neutral: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#e5e5e5',
      300: '#d4d4d4',
      400: '#a3a3a3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717',
      950: '#0a0a0a'
    }
  },
  
  // Typography
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'monospace']
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
      '5xl': '3rem',    // 48px
      '6xl': '3.75rem'  // 60px
    },
    fontWeight: {
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800'
    },
    lineHeight: {
      tight: '1.25',
      snug: '1.375',
      normal: '1.5',
      relaxed: '1.625',
      loose: '2'
    }
  },
  
  // Spacing
  spacing: {
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
    20: '5rem',     // 80px
    24: '6rem',     // 96px
    32: '8rem',     // 128px
    40: '10rem',    // 160px
    48: '12rem',    // 192px
    56: '14rem',    // 224px
    64: '16rem'     // 256px
  },
  
  // Border Radius
  borderRadius: {
    none: '0',
    sm: '0.125rem',   // 2px
    base: '0.25rem',  // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    '3xl': '1.5rem',  // 24px
    full: '9999px'
  },
  
  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    none: '0 0 #0000'
  },
  
  // Component Styles
  components: {
    button: {
      base: 'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
      sizes: {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
        xl: 'px-8 py-4 text-lg'
      },
      variants: {
        primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-sm',
        secondary: 'bg-secondary-100 text-secondary-900 hover:bg-secondary-200 focus:ring-secondary-500 border border-secondary-200',
        outline: 'border border-primary-600 text-primary-600 hover:bg-primary-50 focus:ring-primary-500',
        ghost: 'text-primary-600 hover:bg-primary-50 focus:ring-primary-500',
        success: 'bg-success-600 text-white hover:bg-success-700 focus:ring-success-500 shadow-sm',
        warning: 'bg-warning-600 text-white hover:bg-warning-700 focus:ring-warning-500 shadow-sm',
        error: 'bg-error-600 text-white hover:bg-error-700 focus:ring-error-500 shadow-sm'
      }
    },
    
    input: {
      base: 'block w-full rounded-lg border border-secondary-300 px-3 py-2 text-sm placeholder:text-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-secondary-50 disabled:text-secondary-500',
      error: 'border-error-500 focus:border-error-500 focus:ring-error-500'
    },
    
    card: {
      base: 'rounded-xl border border-secondary-200 bg-white shadow-sm',
      header: 'px-6 py-4 border-b border-secondary-200',
      content: 'px-6 py-4',
      footer: 'px-6 py-4 border-t border-secondary-200'
    },
    
    select: {
      base: 'block w-full rounded-lg border border-secondary-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-secondary-50 disabled:text-secondary-500',
      error: 'border-error-500 focus:border-error-500 focus:ring-error-500'
    }
  }
}

// CSS Variables for easy theming
export const cssVariables = `
  :root {
    /* Primary Colors */
    --color-primary-50: ${designSystem.colors.primary[50]};
    --color-primary-100: ${designSystem.colors.primary[100]};
    --color-primary-200: ${designSystem.colors.primary[200]};
    --color-primary-300: ${designSystem.colors.primary[300]};
    --color-primary-400: ${designSystem.colors.primary[400]};
    --color-primary-500: ${designSystem.colors.primary[500]};
    --color-primary-600: ${designSystem.colors.primary[600]};
    --color-primary-700: ${designSystem.colors.primary[700]};
    --color-primary-800: ${designSystem.colors.primary[800]};
    --color-primary-900: ${designSystem.colors.primary[900]};
    --color-primary-950: ${designSystem.colors.primary[950]};
    
    /* Secondary Colors */
    --color-secondary-50: ${designSystem.colors.secondary[50]};
    --color-secondary-100: ${designSystem.colors.secondary[100]};
    --color-secondary-200: ${designSystem.colors.secondary[200]};
    --color-secondary-300: ${designSystem.colors.secondary[300]};
    --color-secondary-400: ${designSystem.colors.secondary[400]};
    --color-secondary-500: ${designSystem.colors.secondary[500]};
    --color-secondary-600: ${designSystem.colors.secondary[600]};
    --color-secondary-700: ${designSystem.colors.secondary[700]};
    --color-secondary-800: ${designSystem.colors.secondary[800]};
    --color-secondary-900: ${designSystem.colors.secondary[900]};
    --color-secondary-950: ${designSystem.colors.secondary[950]};
    
    /* Success Colors */
    --color-success-500: ${designSystem.colors.success[500]};
    --color-success-600: ${designSystem.colors.success[600]};
    --color-success-700: ${designSystem.colors.success[700]};
    
    /* Warning Colors */
    --color-warning-500: ${designSystem.colors.warning[500]};
    --color-warning-600: ${designSystem.colors.warning[600]};
    --color-warning-700: ${designSystem.colors.warning[700]};
    
    /* Error Colors */
    --color-error-500: ${designSystem.colors.error[500]};
    --color-error-600: ${designSystem.colors.error[600]};
    --color-error-700: ${designSystem.colors.error[700]};
  }
`

export default designSystem
