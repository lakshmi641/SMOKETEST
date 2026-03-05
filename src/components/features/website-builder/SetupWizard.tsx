'use client'

import { useState } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { TemplateService, WebsiteService } from '@/lib/services'
import { TemplateGallery } from './TemplateGallery'
import { COLOR_PRESETS, FONT_PAIRS, getFontPair } from './config'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import type { WebsiteTemplate } from '@/types/website-schema'

type WizardStep = 'info' | 'template' | 'branding' | 'review'
const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'info', label: 'Business Info' },
  { key: 'template', label: 'Template' },
  { key: 'branding', label: 'Branding' },
  { key: 'review', label: 'Review & Create' },
]

export function SetupWizard() {
  const { companyId, groupId, currentCompany } = useCompany()
  const { user } = useAuthStore()
  const router = useRouter()

  const [step, setStep] = useState<WizardStep>('info')
  const [creating, setCreating] = useState(false)

  // Form state
  const [websiteName, setWebsiteName] = useState(currentCompany?.name ? `${currentCompany.name} Website` : '')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<WebsiteTemplate | null>(null)
  const [primaryColor, setPrimaryColor] = useState('#2563EB')
  const [secondaryColor, setSecondaryColor] = useState('#1E40AF')
  const [selectedPreset, setSelectedPreset] = useState<string | null>('ocean-blue')
  const [fontPairId, setFontPairId] = useState<string>('professional')

  const currentStepIndex = STEPS.findIndex((s) => s.key === step)

  const canProceed = () => {
    switch (step) {
      case 'info': return websiteName.trim().length > 0
      case 'template': return selectedTemplate !== null
      case 'branding': return true
      case 'review': return true
    }
  }

  const nextStep = () => {
    const idx = currentStepIndex
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]!.key)
  }

  const prevStep = () => {
    const idx = currentStepIndex
    if (idx > 0) setStep(STEPS[idx - 1]!.key)
  }

  const handleCreate = async () => {
    if (!selectedTemplate || !companyId || !groupId || !user) return
    setCreating(true)
    try {
      const websiteId = await TemplateService.instantiateTemplate(groupId, companyId, selectedTemplate.id, {
        name: websiteName,
        companyName: currentCompany?.name || websiteName,
        contactEmail,
        contactPhone,
        whatsappNumber,
        createdBy: user.id,
      })

      // Apply brand kit if a color preset was selected
      if (selectedPreset) {
        const preset = COLOR_PRESETS.find((p) => p.id === selectedPreset)
        const fontPair = getFontPair(fontPairId)
        if (preset) {
          await WebsiteService.updateBrandKit(groupId, companyId, websiteId, {
            colors: preset.colors,
            colorPresetId: preset.id,
            typography: {
              fontPairId: fontPair.id,
              headingFont: fontPair.heading,
              bodyFont: fontPair.body,
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
            darkMode: { enabled: false },
          })
        }
      }

      toast.success('Website created successfully!')
      router.push('/website')
    } catch (error) {
      console.error('Failed to create website:', error)
      toast.error('Failed to create website')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Your Website</h1>
        <p className="text-sm text-gray-500 mt-1">Follow these steps to set up your business website</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, idx) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              idx < currentStepIndex ? 'bg-green-100 text-green-700' :
              idx === currentStepIndex ? 'bg-blue-600 text-white' :
              'bg-gray-100 text-gray-400'
            }`}>
              {idx < currentStepIndex ? <Check className="h-4 w-4" /> : idx + 1}
            </div>
            <span className={`text-sm ${idx === currentStepIndex ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
              {s.label}
            </span>
            {idx < STEPS.length - 1 && <div className="w-8 h-px bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {step === 'info' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Business Information</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website Name</label>
              <input type="text" value={websiteName} onChange={(e) => setWebsiteName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="My Business Website" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="contact@business.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                <input type="tel" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="+91 98765 43210" />
              </div>
            </div>
          </div>
        )}

        {step === 'template' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Choose a Template</h2>
            <TemplateGallery
              selectedTemplateId={selectedTemplate?.id}
              onSelect={setSelectedTemplate}
            />
          </div>
        )}

        {step === 'branding' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Choose Your Brand Colors</h2>
              <p className="text-sm text-gray-500">Pick a color palette that matches your business. You can always customize further later.</p>
            </div>

            {/* Color Preset Grid */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Color Palette</label>
              <div className="grid grid-cols-5 gap-3">
                {COLOR_PRESETS.map((preset) => {
                  const isSelected = selectedPreset === preset.id
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setSelectedPreset(preset.id)
                        setPrimaryColor(preset.colors.primary)
                        setSecondaryColor(preset.colors.secondary)
                      }}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      title={preset.description}
                    >
                      <span
                        className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center shrink-0"
                        style={{ backgroundColor: preset.colors.primary }}
                      >
                        {isSelected && <Check className="h-4 w-4 text-white" />}
                      </span>
                      <span className="text-[11px] text-gray-600 truncate w-full text-center">
                        {preset.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Font Pair Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Font Pair</label>
              <select
                value={fontPairId}
                onChange={(e) => setFontPairId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {FONT_PAIRS.filter((fp) => ['professional', 'modern-clean', 'bold-impact', 'elegant-serif', 'tech-startup'].includes(fp.id)).map((fp) => (
                  <option key={fp.id} value={fp.id}>
                    {fp.label} ({fp.heading} / {fp.body})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Heading and body font combination for your site</p>
            </div>

            {/* Customize link */}
            <p className="text-sm text-gray-500">
              <Link href="/website/settings" className="text-blue-600 hover:underline">
                Customize further in Brand Kit settings
              </Link>{' '}
              after your website is created.
            </p>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Review & Create</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Website Name</span>
                <span className="font-medium">{websiteName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Template</span>
                <span className="font-medium">{selectedTemplate?.name || '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Email</span>
                <span className="font-medium">{contactEmail || '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Colors</span>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: primaryColor }} />
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: secondaryColor }} />
                  {selectedPreset && (
                    <span className="text-xs text-gray-400">
                      ({COLOR_PRESETS.find((p) => p.id === selectedPreset)?.label})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Font Pair</span>
                <span className="font-medium">{getFontPair(fontPairId).label}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevStep}
          disabled={currentStepIndex === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {step === 'review' ? (
          <button
            onClick={handleCreate}
            disabled={creating || !canProceed()}
            className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {creating ? 'Creating...' : 'Create Website'}
          </button>
        ) : (
          <button
            onClick={nextStep}
            disabled={!canProceed()}
            className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
