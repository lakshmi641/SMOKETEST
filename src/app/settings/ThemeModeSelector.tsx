'use client'

import { useState, useEffect } from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

export function ThemeModeSelector() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Sun className="h-4 w-4" />
            <span className="text-sm">Light</span>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <RadioGroup value={theme} onValueChange={setTheme} className="grid grid-cols-3 gap-4">
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
  )
}

