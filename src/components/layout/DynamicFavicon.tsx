'use client'

import { useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'

export function DynamicFavicon() {
  const { currentCompany } = useCompany()

  useEffect(() => {
    if (currentCompany?.branding?.favicon) {
      const head = document.getElementsByTagName('head')[0]
      if (!head) return

      // Update favicon link
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
      if (link) {
        link.href = currentCompany.branding.favicon
      } else {
        const newLink = document.createElement('link')
        newLink.rel = 'icon'
        newLink.href = currentCompany.branding.favicon
        head.appendChild(newLink)
      }

      // Update apple-touch-icon
      const appleLink = document.querySelector("link[rel~='apple-touch-icon']") as HTMLLinkElement
      if (appleLink) {
        appleLink.href = currentCompany.branding.favicon
      } else {
        const newAppleLink = document.createElement('link')
        newAppleLink.rel = 'apple-touch-icon'
        newAppleLink.href = currentCompany.branding.favicon
        head.appendChild(newAppleLink)
      }
    }
  }, [currentCompany?.branding?.favicon])

  return null
}
