'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href: string
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[]
  projectName?: string
}

export function Breadcrumb({ items, projectName }: BreadcrumbProps) {
  const pathname = usePathname()

  // Function to get breadcrumb path
  const getBreadcrumbItems = (path: string): BreadcrumbItem[] => {
    // If custom items provided, use those
    if (items && items.length > 0) {
      return items
    }

    const segments = path.split('/').filter(Boolean)
    const breadcrumb: BreadcrumbItem[] = []
    
    if (segments.length === 0) {
      return [{ label: 'Dashboard', href: '/dashboard' }]
    }
    
    // Handle specific routes
    if (segments[0] === 'projects') {
      breadcrumb.push({ label: 'Projects', href: '/projects' })
      
      if (segments[1] === 'create') {
        breadcrumb.push({ label: 'Create Project', href: '/projects/create' })
      } else if (segments[1] && segments[1] !== 'create') {
        breadcrumb.push({ label: projectName || 'Project Details', href: `/projects/${segments[1]}` })
      }
    } else if (segments[0] === 'organization') {
      breadcrumb.push({ label: 'Organization', href: '/organization' })
    } else if (segments[0] === 'org-chart') {
      breadcrumb.push({ label: 'Organization Chart', href: '/org-chart' })
    } else {
      // Default breadcrumb generation
      let currentPath = ''
      segments.forEach((segment) => {
        currentPath += `/${segment}`
        const capitalized = segment
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
        breadcrumb.push({ 
          label: capitalized, 
          href: currentPath 
        })
      })
    }
    
    return breadcrumb
  }

  const breadcrumbItems = getBreadcrumbItems(pathname)

  return (
    <nav className="flex items-center space-x-2 text-sm mb-6">
      <Link 
        href="/dashboard" 
        className="text-gray-500 hover:text-gray-700 transition-colors"
      >
        <Home className="w-4 h-4" />
      </Link>
      {breadcrumbItems.map((item, index) => (
        <div key={index} className="flex items-center space-x-2">
          <ChevronRight className="w-4 h-4 text-gray-400" />
          {index === breadcrumbItems.length - 1 ? (
            <span className="font-medium text-gray-900">{item.label}</span>
          ) : (
            <Link 
              href={item.href} 
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
