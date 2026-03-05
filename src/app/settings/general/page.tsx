'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCompanyConfig } from '@/hooks/useCompanyConfig'
import { useCompany } from '@/contexts/CompanyContext'
import { CompanyService } from '@/lib/services/companies/company-services'
import { uploadFile } from '@/lib/services/storage/storage-service'
import { Upload, Image as ImageIcon, Save, Loader2, X } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import toast from 'react-hot-toast'

export default function GeneralSettingsPage() {
  const companyConfig = useCompanyConfig()
  const { companyId, groupId } = useCompany()
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    name: companyConfig.name,
    description: companyConfig.description || '',
    logo: companyConfig.logo || '',
  })

  useEffect(() => {
    setFormData({
      name: companyConfig.name,
      description: companyConfig.description || '',
      logo: companyConfig.logo || '',
    })
  }, [companyConfig])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !companyId) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('Image size must be less than 5MB')
      return
    }

    try {
      setUploadingLogo(true)
      const fileExtension = file.name.split('.').pop()
      const fileName = `companies/${companyId}/logo/${Date.now()}.${fileExtension}`
      const uploadedFile = await uploadFile(file, fileName)
      setFormData(prev => ({ ...prev, logo: uploadedFile.url }))
      toast.success('Logo uploaded successfully')
    } catch (error) {
      console.error('Error uploading logo:', error)
      toast.error('Failed to upload logo')
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) {
        logoInputRef.current.value = ''
      }
    }
  }

  const handleSave = async () => {
    if (!companyId) {
      toast.error('Company not found')
      return
    }

    try {
      setSaving(true)

      await CompanyService.updatePMSConfig(companyId, {
        description: formData.description,
      }, groupId ?? undefined)

      await CompanyService.updateCompany(companyId, {
        name: formData.name,
      }, groupId ?? undefined)

      await CompanyService.updateCompanyBranding(companyId, {
        logo: formData.logo,
      }, groupId ?? undefined)

      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveLogo = () => {
    setFormData(prev => ({ ...prev, logo: '' }))
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <p className="text-muted-foreground">Manage company identity and branding</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Company Branding</CardTitle>
            <CardDescription>
              Update company logo, name, and description. These will appear on the login page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-foreground">Company Logo</Label>
              <div className="mt-2 flex items-center space-x-4">
                <div className="relative">
                  {formData.logo ? (
                    <div className="w-24 h-24 rounded-lg overflow-hidden border border-border bg-muted">
                      <img
                        src={formData.logo}
                        alt="Company logo"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted">
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="bg-background text-foreground border-border"
                  >
                    {uploadingLogo ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        {formData.logo ? 'Change Logo' : 'Upload Logo'}
                      </>
                    )}
                  </Button>
                  {formData.logo && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveLogo}
                      className="bg-background text-foreground border-border"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <p className="text-xs text-muted-foreground">Max size 5MB. JPG, PNG supported.</p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="company-name" className="text-foreground">Company Name *</Label>
              <Input
                id="company-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter company name"
                className="mt-2 bg-background text-foreground border-border"
                required
              />
            </div>

            <div>
              <Label htmlFor="company-description" className="text-foreground">Company Description</Label>
              <Textarea
                id="company-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter company description"
                rows={4}
                className="mt-2 bg-background text-foreground border-border"
              />
              <p className="text-xs text-muted-foreground mt-1">This description will appear on the login page.</p>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !formData.name}
              className="w-full bg-primary text-primary-foreground"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
