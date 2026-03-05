'use client'

import { Label } from '@/components/ui/label'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeModeSelector } from '../ThemeModeSelector'
import { ThemeSelector } from '@/components/providers/ThemeSelector'
import { ThemeToggle } from '@/components/providers/ThemeToggle'

export default function AppearancePage() {
  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <div className="mb-6">
        
          <p className="text-muted-foreground">Customize the look and feel of your workspace</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Theme Settings</CardTitle>
            <CardDescription>
              Choose your preferred theme mode and color scheme
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-foreground">Theme Mode</Label>
              <ThemeModeSelector />
            </div>
            <div className="space-y-3">
              <ThemeSelector />
            </div>
            <div className="space-y-3">
              <Label className="text-foreground">Quick Toggle</Label>
              <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-background">
                <span className="text-sm text-muted-foreground">Switch theme</span>
                <ThemeToggle />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
