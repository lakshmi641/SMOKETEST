'use client'

import React, { createContext, useContext } from 'react'
import { useUIStore } from '@/store/uiStore'
import { THEME_STYLES, ThemeConfig } from './theme-config'

const ThemeContext = createContext<ThemeConfig>(THEME_STYLES.modern)

export const useDashboardTheme = () => useContext(ThemeContext)

export function DashboardThemeWrapper({ children }: { children: React.ReactNode }) {
  const { dashboardTheme } = useUIStore()
  const themeConfig = THEME_STYLES[dashboardTheme] || THEME_STYLES.modern

  return (
    <ThemeContext.Provider value={themeConfig}>
      <div className="space-y-6">
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

