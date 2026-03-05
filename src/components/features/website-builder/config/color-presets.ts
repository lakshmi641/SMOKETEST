// Color Presets — 10 curated palettes for the WaaS brand-kit picker

import type { BrandKitColors } from '@/types/website-schema'

export interface ColorPreset {
  id: string
  label: string
  description: string
  colors: BrandKitColors
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: 'ocean-blue',
    label: 'Ocean Blue',
    description: 'Professional and trustworthy',
    colors: {
      primary: '#2563EB',
      secondary: '#1E40AF',
      accent: '#F59E0B',
      background: '#FFFFFF',
      surface: '#F8FAFC',
      text: '#0F172A',
      textMuted: '#64748B',
      border: '#E2E8F0',
    },
  },
  {
    id: 'forest-green',
    label: 'Forest Green',
    description: 'Natural and growth-oriented',
    colors: {
      primary: '#059669',
      secondary: '#047857',
      accent: '#F59E0B',
      background: '#FFFFFF',
      surface: '#F0FDF4',
      text: '#0F172A',
      textMuted: '#64748B',
      border: '#D1FAE5',
    },
  },
  {
    id: 'sunset-orange',
    label: 'Sunset Orange',
    description: 'Energetic and bold',
    colors: {
      primary: '#EA580C',
      secondary: '#C2410C',
      accent: '#2563EB',
      background: '#FFFFFF',
      surface: '#FFF7ED',
      text: '#0F172A',
      textMuted: '#64748B',
      border: '#FED7AA',
    },
  },
  {
    id: 'royal-purple',
    label: 'Royal Purple',
    description: 'Premium and creative',
    colors: {
      primary: '#7C3AED',
      secondary: '#6D28D9',
      accent: '#F59E0B',
      background: '#FFFFFF',
      surface: '#F5F3FF',
      text: '#0F172A',
      textMuted: '#64748B',
      border: '#DDD6FE',
    },
  },
  {
    id: 'rose-gold',
    label: 'Rose Gold',
    description: 'Elegant and warm',
    colors: {
      primary: '#E11D48',
      secondary: '#BE123C',
      accent: '#F59E0B',
      background: '#FFFFFF',
      surface: '#FFF1F2',
      text: '#0F172A',
      textMuted: '#64748B',
      border: '#FECDD3',
    },
  },
  {
    id: 'slate-minimal',
    label: 'Slate Minimal',
    description: 'Clean and understated',
    colors: {
      primary: '#334155',
      secondary: '#1E293B',
      accent: '#3B82F6',
      background: '#FFFFFF',
      surface: '#F8FAFC',
      text: '#0F172A',
      textMuted: '#64748B',
      border: '#E2E8F0',
    },
  },
  {
    id: 'india-saffron',
    label: 'India Saffron',
    description: 'Warm and vibrant, inspired by Indian heritage',
    colors: {
      primary: '#D97706',
      secondary: '#B45309',
      accent: '#059669',
      background: '#FFFBEB',
      surface: '#FEF3C7',
      text: '#1C1917',
      textMuted: '#78716C',
      border: '#FDE68A',
    },
  },
  {
    id: 'diwali-festive',
    label: 'Diwali Festive',
    description: 'Rich and celebratory',
    colors: {
      primary: '#DC2626',
      secondary: '#B91C1C',
      accent: '#D97706',
      background: '#FFFBEB',
      surface: '#FEF2F2',
      text: '#1C1917',
      textMuted: '#78716C',
      border: '#FECACA',
    },
  },
  {
    id: 'teal-modern',
    label: 'Teal Modern',
    description: 'Fresh and contemporary',
    colors: {
      primary: '#0D9488',
      secondary: '#0F766E',
      accent: '#F59E0B',
      background: '#FFFFFF',
      surface: '#F0FDFA',
      text: '#0F172A',
      textMuted: '#64748B',
      border: '#CCFBF1',
    },
  },
  {
    id: 'midnight-dark',
    label: 'Midnight Dark',
    description: 'Bold dark theme',
    colors: {
      primary: '#3B82F6',
      secondary: '#2563EB',
      accent: '#F59E0B',
      background: '#0F172A',
      surface: '#1E293B',
      text: '#F1F5F9',
      textMuted: '#94A3B8',
      border: '#334155',
    },
  },
]

/** Look up a color preset by id. Returns undefined if not found. */
export function getColorPreset(id: string): ColorPreset | undefined {
  return COLOR_PRESETS.find((cp) => cp.id === id)
}
