import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { EnhancedProject } from '@/types/project-schema'
import { TenantProfile } from '@/types/tenant-schema'

type TabType = 'summary' | 'board' | 'list' | 'calendar' | 'timeline' | 'dashboard' | 'wbs' | 'workflows' | 'governance' | 'project-info' | 'document-vault'

export function useProjectTabs(project: EnhancedProject | null, tenantProfile: TenantProfile | null = null) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const initialTab = (searchParams.get('tab') as TabType) || 'list'
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)

  // No longer checking for specific tenant restriction for base tabs
  // const isGreenSecure = tenantProfile?.subdomain?.toLowerCase().includes('greensecure') || false

  // Keep tab in sync with URL and available views
  useEffect(() => {
    if (project) {
      // Ensure views is an array, fallback to default views including Project Info and Document Vault
      const defaultViews = ['overview', 'list', 'board', 'timeline', 'calendar', 'dashboard', 'wbs', 'governance', 'project-info', 'document-vault']

      const projectViews = Array.isArray(project.views) && project.views.length > 0 ? project.views : defaultViews
      const availableViews = [...new Set([...projectViews, ...defaultViews])]

      const viewMap: Record<string, string> = {
        'overview': 'summary',
        'list': 'list',
        'board': 'board',
        'timeline': 'timeline',
        'calendar': 'calendar',
        'dashboard': 'dashboard',
        'wbs': 'wbs',
        'workflows': 'governance',
        'governance': 'governance',
        'project-info': 'project-info',
        'document-vault': 'document-vault'
      }

      const urlTab = (searchParams.get('tab') as TabType)

      // Check if current tab is available (any view key mapping to this tab must be in available views)
      const matchingViewKeys = Object.entries(viewMap).filter(([_, tab]) => tab === activeTab).map(([key]) => key)
      const isCurrentTabAvailable = matchingViewKeys.some(key => availableViews.includes(key))

      if (urlTab && urlTab !== activeTab) {
        setActiveTab(urlTab)
      } else if (!isCurrentTabAvailable) {
        // If current tab is not available, switch to first available
        const firstAvailable = availableViews[0]
        if (firstAvailable) {
          const firstTab = viewMap[firstAvailable] || 'summary'
          setActiveTab(firstTab as TabType)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, project])

  const handleTabChange = (value: string) => {
    const next = (value as TabType)
    setActiveTab(next)
    const sp = new URLSearchParams(Array.from(searchParams.entries()))
    if (next === 'summary') {
      sp.delete('tab')
    } else {
      sp.set('tab', next)
    }
    const newUrl = `${pathname}${sp.toString() ? `?${sp.toString()}` : ''}`
    router.replace(newUrl, { scroll: false })
  }

  // Get project views, default with all tabs globally available
  const defaultViews = ['overview', 'list', 'board', 'timeline', 'calendar', 'dashboard', 'wbs', 'governance', 'project-info', 'document-vault']

  const projectViews = Array.isArray(project?.views) && project.views.length > 0
    ? [...new Set([...project.views, ...defaultViews])]
    : defaultViews

  return {
    activeTab,
    setActiveTab,
    handleTabChange,
    projectViews,
  }
}
