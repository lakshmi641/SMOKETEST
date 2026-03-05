// Design Tokens — mapping brand-kit options to CSS values

import type {
  BorderRadiusOption,
  ShadowIntensityOption,
  SpacingOption,
  WebsiteBrandKit,
} from '@/types/website-schema'

// ---------------------------------------------------------------------------
// Token Maps
// ---------------------------------------------------------------------------

export const RADIUS_MAP: Record<BorderRadiusOption, string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '16px',
  full: '9999px',
}

export const SHADOW_MAP: Record<ShadowIntensityOption, string> = {
  none: 'none',
  subtle: '0 1px 3px rgba(0,0,0,0.08)',
  medium: '0 4px 12px rgba(0,0,0,0.1)',
  dramatic: '0 8px 30px rgba(0,0,0,0.12)',
}

export const SPACING_MAP: Record<SpacingOption, string> = {
  compact: '6px',
  comfortable: '8px',
  spacious: '10px',
}

export const SCALE_RATIOS = [
  { value: 1.2, label: 'Compact (1.2)' },
  { value: 1.25, label: 'Default (1.25)' },
  { value: 1.333, label: 'Dramatic (1.333)' },
] as const

// ---------------------------------------------------------------------------
// Default Brand Kit
// ---------------------------------------------------------------------------

export const DEFAULT_BRAND_KIT: WebsiteBrandKit = {
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
  typography: {
    headingFont: 'Poppins',
    bodyFont: 'Inter',
    fontPairId: 'professional',
    baseSize: 16,
    scaleRatio: 1.25,
  },
  style: {
    borderRadius: 'md',
    buttonStyle: 'filled',
    shadowIntensity: 'subtle',
    spacing: 'comfortable',
    navStyle: 'solid',
  },
  darkMode: {
    enabled: false,
  },
  colorPresetId: 'ocean-blue',
}
