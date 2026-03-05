'use client'

import { useState, useRef, useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { WebsiteService } from '@/lib/services'
import { Check, Loader2 } from 'lucide-react'
import {
  FONT_PAIRS,
  COLOR_PRESETS,
  SCALE_RATIOS,
  DEFAULT_BRAND_KIT,
  RADIUS_MAP,
  SHADOW_MAP,
} from './config'
import type {
  Website,
  WebsiteBrandKit,
  BrandKitColors,
  BorderRadiusOption,
  ButtonStyleOption,
  ShadowIntensityOption,
  SpacingOption,
  NavStyleOption,
} from '@/types/website-schema'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BrandKitSettingsProps {
  website: Website
  onUpdated?: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateDarkColors(colors: BrandKitColors): Partial<BrandKitColors> {
  return {
    primary: colors.primary,
    secondary: colors.secondary,
    accent: colors.accent,
    background: '#0F172A',
    surface: '#1E293B',
    text: '#F1F5F9',
    textMuted: '#94A3B8',
    border: '#334155',
  }
}

const COLOR_KEYS: { key: keyof BrandKitColors; label: string }[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'text', label: 'Text' },
  { key: 'textMuted', label: 'Text Muted' },
  { key: 'border', label: 'Border' },
]

const BORDER_RADIUS_OPTIONS: BorderRadiusOption[] = ['none', 'sm', 'md', 'lg', 'full']
const BUTTON_STYLES: ButtonStyleOption[] = ['filled', 'outline', 'ghost']
const SHADOW_OPTIONS: ShadowIntensityOption[] = ['none', 'subtle', 'medium', 'dramatic']
const SPACING_OPTIONS: { value: SpacingOption; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'spacious', label: 'Spacious' },
]
const NAV_STYLES: { value: NavStyleOption; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'transparent', label: 'Transparent' },
  { value: 'glass', label: 'Glass' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BrandKitSettings({ website, onUpdated }: BrandKitSettingsProps) {
  const { groupId, companyId } = useCompany()
  const [brandKit, setBrandKit] = useState<WebsiteBrandKit>(
    website.brandKit || DEFAULT_BRAND_KIT
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const savedTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  function scheduleAutoSave(newBrandKit: WebsiteBrandKit) {
    setBrandKit(newBrandKit)
    setSaved(false)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        await WebsiteService.updateBrandKit(groupId!, companyId!, website.id, newBrandKit)
        onUpdated?.()
        setSaved(true)
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
        savedTimerRef.current = setTimeout(() => setSaved(false), 2000)
      } catch (e) {
        console.error('Failed to save brand kit:', e)
      } finally {
        setSaving(false)
      }
    }, 3000)
  }

  // --- Updater shortcuts ---

  function updateColors(partial: Partial<BrandKitColors>, clearPreset = true) {
    scheduleAutoSave({
      ...brandKit,
      colors: { ...brandKit.colors, ...partial },
      ...(clearPreset ? { colorPresetId: undefined } : {}),
    })
  }

  function selectColorPreset(presetId: string, colors: BrandKitColors) {
    scheduleAutoSave({ ...brandKit, colors, colorPresetId: presetId })
  }

  function updateTypography(partial: Partial<WebsiteBrandKit['typography']>) {
    scheduleAutoSave({
      ...brandKit,
      typography: { ...brandKit.typography, ...partial },
    })
  }

  function updateStyle(partial: Partial<WebsiteBrandKit['style']>) {
    scheduleAutoSave({
      ...brandKit,
      style: { ...brandKit.style, ...partial },
    })
  }

  function updateDarkMode(enabled: boolean) {
    scheduleAutoSave({
      ...brandKit,
      darkMode: {
        enabled,
        ...(enabled ? { colors: generateDarkColors(brandKit.colors) } : {}),
      },
    })
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="space-y-8">
      {/* Save indicator */}
      <div className="flex items-center justify-end h-5 text-xs">
        {saving && (
          <span className="flex items-center gap-1.5 text-gray-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving...
          </span>
        )}
        {saved && !saving && (
          <span className="flex items-center gap-1.5 text-green-600">
            <Check className="h-3 w-3" /> Saved
          </span>
        )}
      </div>

      {/* ================================================================= */}
      {/* Section 1: Color Palette                                          */}
      {/* ================================================================= */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Color Palette</h3>

        {/* Preset grid */}
        <p className="text-sm font-medium text-gray-700 mb-2">Presets</p>
        <div className="grid grid-cols-5 gap-3 mb-6">
          {COLOR_PRESETS.map((preset) => {
            const isSelected = brandKit.colorPresetId === preset.id
            return (
              <button
                key={preset.id}
                onClick={() => selectColorPreset(preset.id, preset.colors)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                title={preset.label}
              >
                <span
                  className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center shrink-0"
                  style={{ backgroundColor: preset.colors.primary }}
                >
                  {isSelected && <Check className="h-5 w-5 text-white" />}
                </span>
                <span className="text-[11px] text-gray-600 truncate w-full text-center">
                  {preset.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Individual color pickers */}
        <p className="text-sm font-medium text-gray-700 mb-2">Custom Colors</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {COLOR_KEYS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <input
                type="color"
                value={brandKit.colors[key]}
                onChange={(e) => updateColors({ [key]: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer border border-gray-200 p-0.5"
              />
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-700 block">{label}</span>
                <span className="text-xs text-gray-400 font-mono block">
                  {brandKit.colors[key]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================= */}
      {/* Section 2: Typography                                             */}
      {/* ================================================================= */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Typography</h3>

        {/* Font pair cards */}
        <p className="text-sm font-medium text-gray-700 mb-2">Font Pair</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {FONT_PAIRS.map((pair) => {
            const isSelected = brandKit.typography.fontPairId === pair.id
            return (
              <button
                key={pair.id}
                onClick={() =>
                  updateTypography({
                    fontPairId: pair.id,
                    headingFont: pair.heading,
                    bodyFont: pair.body,
                  })
                }
                className={`text-left p-4 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-2 bg-blue-50/50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={isSelected ? { borderColor: brandKit.colors.primary } : undefined}
              >
                <link rel="stylesheet" href={pair.googleUrl} />
                <span
                  className="block text-base font-semibold mb-1 truncate"
                  style={{ fontFamily: `'${pair.heading}', sans-serif` }}
                >
                  {pair.label}
                </span>
                <span
                  className="block text-xs text-gray-500 truncate"
                  style={{ fontFamily: `'${pair.body}', sans-serif` }}
                >
                  The quick brown fox jumps over the lazy dog.
                </span>
                <span className="block text-[10px] text-gray-400 mt-1">
                  {pair.heading} / {pair.body}
                </span>
              </button>
            )
          })}
        </div>

        {/* Base size selector */}
        <div className="flex items-center gap-6 mb-4">
          <p className="text-sm font-medium text-gray-700">Base Size</p>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="baseSize"
              checked={brandKit.typography.baseSize === 16}
              onChange={() => updateTypography({ baseSize: 16 })}
              className="accent-blue-600"
            />
            16px (Compact)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="baseSize"
              checked={brandKit.typography.baseSize === 18}
              onChange={() => updateTypography({ baseSize: 18 })}
              className="accent-blue-600"
            />
            18px (Comfortable)
          </label>
        </div>

        {/* Scale ratio selector */}
        <div className="flex items-center gap-6">
          <p className="text-sm font-medium text-gray-700">Scale Ratio</p>
          {SCALE_RATIOS.map((sr) => (
            <label key={sr.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="scaleRatio"
                checked={brandKit.typography.scaleRatio === sr.value}
                onChange={() => updateTypography({ scaleRatio: sr.value })}
                className="accent-blue-600"
              />
              {sr.label}
            </label>
          ))}
        </div>
      </section>

      {/* ================================================================= */}
      {/* Section 3: Style                                                  */}
      {/* ================================================================= */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Style</h3>

        {/* Border radius */}
        <p className="text-sm font-medium text-gray-700 mb-2">Border Radius</p>
        <div className="flex items-center gap-2 mb-6">
          {BORDER_RADIUS_OPTIONS.map((opt) => {
            const isSelected = brandKit.style.borderRadius === opt
            return (
              <button
                key={opt}
                onClick={() => updateStyle({ borderRadius: opt })}
                className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg border transition-all ${
                  isSelected ? 'text-white' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
                style={
                  isSelected
                    ? { backgroundColor: brandKit.colors.primary, borderColor: brandKit.colors.primary }
                    : undefined
                }
              >
                <span
                  className={`w-8 h-8 border-2 ${
                    isSelected ? 'border-white/60' : 'border-gray-300'
                  }`}
                  style={{ borderRadius: RADIUS_MAP[opt] }}
                />
                <span className="text-xs capitalize">{opt}</span>
              </button>
            )
          })}
        </div>

        {/* Button style preview */}
        <p className="text-sm font-medium text-gray-700 mb-2">Button Style</p>
        <div className="flex items-center gap-3 mb-6">
          {BUTTON_STYLES.map((bs) => {
            const isSelected = brandKit.style.buttonStyle === bs
            const radius = RADIUS_MAP[brandKit.style.borderRadius]

            let btnClass = 'px-5 py-2 text-sm font-medium transition-all cursor-pointer'
            let btnStyle: React.CSSProperties = { borderRadius: radius }

            if (bs === 'filled') {
              btnClass += ' text-white'
              btnStyle = {
                ...btnStyle,
                backgroundColor: brandKit.colors.primary,
              }
            } else if (bs === 'outline') {
              btnClass += ' bg-transparent border-2'
              btnStyle = {
                ...btnStyle,
                color: brandKit.colors.primary,
                borderColor: brandKit.colors.primary,
              }
            } else {
              btnClass += ' bg-transparent'
              btnStyle = {
                ...btnStyle,
                color: brandKit.colors.primary,
              }
            }

            return (
              <button
                key={bs}
                onClick={() => updateStyle({ buttonStyle: bs })}
                className={`${btnClass} ${
                  isSelected ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                }`}
                style={btnStyle}
              >
                {bs.charAt(0).toUpperCase() + bs.slice(1)}
              </button>
            )
          })}
        </div>

        {/* Shadow intensity */}
        <p className="text-sm font-medium text-gray-700 mb-2">Shadow Intensity</p>
        <div className="grid grid-cols-4 gap-3 mb-6">
          {SHADOW_OPTIONS.map((so) => {
            const isSelected = brandKit.style.shadowIntensity === so
            return (
              <button
                key={so}
                onClick={() => updateStyle({ shadowIntensity: so })}
                className={`p-3 rounded-lg border transition-all ${
                  isSelected ? 'border-2' : 'border-gray-200 hover:border-gray-300'
                }`}
                style={isSelected ? { borderColor: brandKit.colors.primary } : undefined}
              >
                <div
                  className="w-full h-12 rounded bg-white mb-2"
                  style={{ boxShadow: SHADOW_MAP[so] }}
                />
                <span className="text-xs text-gray-600 capitalize">{so}</span>
              </button>
            )
          })}
        </div>

        {/* Spacing */}
        <div className="flex items-center gap-6 mb-4">
          <p className="text-sm font-medium text-gray-700">Spacing</p>
          {SPACING_OPTIONS.map((sp) => (
            <label key={sp.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="spacing"
                checked={brandKit.style.spacing === sp.value}
                onChange={() => updateStyle({ spacing: sp.value })}
                className="accent-blue-600"
              />
              {sp.label}
            </label>
          ))}
        </div>

        {/* Nav style */}
        <div className="flex items-center gap-6">
          <p className="text-sm font-medium text-gray-700">Navigation Style</p>
          {NAV_STYLES.map((ns) => (
            <label key={ns.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="navStyle"
                checked={brandKit.style.navStyle === ns.value}
                onChange={() => updateStyle({ navStyle: ns.value })}
                className="accent-blue-600"
              />
              {ns.label}
            </label>
          ))}
        </div>
      </section>

      {/* ================================================================= */}
      {/* Section 4: Dark Mode                                              */}
      {/* ================================================================= */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Dark Mode</h3>

        {/* Enable toggle */}
        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <button
            role="switch"
            aria-checked={brandKit.darkMode.enabled}
            onClick={() => updateDarkMode(!brandKit.darkMode.enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
              brandKit.darkMode.enabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                brandKit.darkMode.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-sm font-medium text-gray-700">Enable dark mode</span>
        </label>

        {/* Dark mode preview */}
        {brandKit.darkMode.enabled && (
          <div className="mb-4">
            <div
              className="rounded-lg p-5 border"
              style={{
                backgroundColor: '#0F172A',
                borderColor: '#334155',
              }}
            >
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: '#F1F5F9' }}
              >
                Dark Mode Preview
              </p>
              <p
                className="text-xs mb-3"
                style={{ color: '#94A3B8' }}
              >
                This is how your site will look for dark mode visitors.
              </p>
              <div className="flex gap-2">
                <span
                  className="px-3 py-1 text-xs text-white rounded"
                  style={{ backgroundColor: brandKit.colors.primary }}
                >
                  Primary
                </span>
                <span
                  className="px-3 py-1 text-xs text-white rounded"
                  style={{ backgroundColor: brandKit.colors.accent }}
                >
                  Accent
                </span>
                <span
                  className="px-3 py-1 text-xs rounded"
                  style={{
                    backgroundColor: '#1E293B',
                    color: '#F1F5F9',
                    border: '1px solid #334155',
                  }}
                >
                  Surface
                </span>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500">
          Dark mode automatically adapts your colors for visitors who prefer dark interfaces.
        </p>
      </section>
    </div>
  )
}
