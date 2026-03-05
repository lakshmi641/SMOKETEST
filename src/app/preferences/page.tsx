'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Moon, Sun, Monitor, Globe, Loader2, Save } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useCompany, useGroupId } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { UserPreferencesService } from '@/lib/services/user-preferences-service'
import { toast } from 'react-hot-toast'
import type { UserPreferences } from '@/types/user-preferences'

// Common timezones list
const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'Mumbai (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { value: 'America/Mexico_City', label: 'Mexico City (CST)' },
  { value: 'America/Toronto', label: 'Toronto (EST)' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Asia/Seoul', label: 'Seoul (KST)' },
]

export default function PreferencesPage() {
  const { theme: currentTheme, setTheme } = useTheme()
  const { currentCompany } = useCompany()
  const groupId = useGroupId()
  const { user } = useAuthStore()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>('system')
  const [timezone, setTimezone] = useState<string>('')

  // Wait for theme to mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Load user preferences
  useEffect(() => {
    if (currentCompany?.id && user?.id && mounted) {
      loadPreferences()
    }
  }, [currentCompany?.id, user?.id, mounted])

  const loadPreferences = async () => {
    if (!currentCompany?.id || !user?.id) return

    try {
      setLoading(true)
      const prefs = await UserPreferencesService.getUserPreferences(
        currentCompany.id,
        user.id,
        groupId
      )
      setPreferences(prefs)
      setThemeState(prefs.theme)
      setTimezone(prefs.timezone)

      // Apply theme if it's different from current
      if (prefs.theme !== currentTheme) {
        setTheme(prefs.theme)
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
      toast.error('Failed to load preferences')
      // Set defaults
      const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      setThemeState('system')
      setTimezone(defaultTimezone)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!currentCompany?.id || !user?.id) return

    try {
      setSaving(true)
      await UserPreferencesService.updateUserPreferences(
        currentCompany.id,
        user.id,
        {
          theme,
          timezone,
        },
        groupId
      )

      // Apply theme immediately
      setTheme(theme)

      // Update local state
      setPreferences((prev) => ({
        ...(prev || {
          userId: user.id,
          companyId: currentCompany.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        theme,
        timezone,
        updatedAt: new Date().toISOString(),
      }))

      toast.success('Preferences saved successfully')
    } catch (error) {
      console.error('Failed to save preferences:', error)
      toast.error('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setThemeState(newTheme)
    // Apply theme immediately for better UX
    setTheme(newTheme)
  }

  if (!mounted || loading) {
    return (
      <DashboardLayout>
        <div>
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Preferences</h1>
          <p className="text-muted-foreground">
            Manage your personal preferences and settings
          </p>
        </div>

        <div className="max-w-4xl space-y-6">
          {/* Theme Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="w-5 h-5" />
                Theme
              </CardTitle>
              <CardDescription>
                Choose your preferred color theme for the application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={theme}
                onValueChange={(value) =>
                  handleThemeChange(value as 'light' | 'dark' | 'system')
                }
                className="grid grid-cols-3 gap-4"
              >
                <div>
                  <RadioGroupItem value="light" id="light" className="peer sr-only" />
                  <Label
                    htmlFor="light"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Sun className="mb-3 h-6 w-6" />
                    <span className="text-sm font-medium">Light</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
                  <Label
                    htmlFor="dark"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Moon className="mb-3 h-6 w-6" />
                    <span className="text-sm font-medium">Dark</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="system" id="system" className="peer sr-only" />
                  <Label
                    htmlFor="system"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Monitor className="mb-3 h-6 w-6" />
                    <span className="text-sm font-medium">System</span>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Timezone Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Timezone
              </CardTitle>
              <CardDescription>
                Set your timezone for accurate date and time display
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="timezone">Select Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="timezone" className="w-full">
                    <SelectValue placeholder="Select a timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {timezone && (
                  <p className="text-xs text-muted-foreground">
                    Current time: {new Date().toLocaleString('en-US', {
                      timeZone: timezone,
                      dateStyle: 'full',
                      timeStyle: 'long',
                    })}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="min-w-[120px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Preferences
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
