// Animation Presets — entrance animations for WaaS page sections

export interface AnimationPreset {
  label: string
  value: string // data-waas-anim attribute value
}

export const ANIMATION_PRESETS: AnimationPreset[] = [
  { label: 'None', value: 'none' },
  { label: 'Fade In', value: 'fade-in' },
  { label: 'Slide Up', value: 'slide-up' },
  { label: 'Slide from Left', value: 'slide-left' },
  { label: 'Slide from Right', value: 'slide-right' },
  { label: 'Zoom In', value: 'zoom-in' },
  { label: 'Blur In', value: 'blur-in' },
]

export const ANIMATION_SPEEDS = [
  { label: 'Slow', value: 'slow', duration: '0.8s' },
  { label: 'Normal', value: 'normal', duration: '0.5s' },
  { label: 'Fast', value: 'fast', duration: '0.3s' },
] as const

export const ANIMATION_DELAYS = [
  { label: 'None', value: 'none' },
  { label: 'Short', value: 'short' },
  { label: 'Medium', value: 'medium' },
] as const
