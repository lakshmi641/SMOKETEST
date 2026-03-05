'use client'

import { usePathname } from 'next/navigation'
import { useCompany } from '@/contexts/CompanyContext'
import { PermissionService } from '@/lib/services/permission-service'
import { getNavigationItemByHref } from '@/config/navigation'
import { ForbiddenContent } from '@/components/errors/ForbiddenContent'

interface ProtectedPageProps {
  children: React.ReactNode | (() => React.ReactNode)
  fallback?: React.ReactNode
  className?: string
}

/**
 * ProtectedPage - Wrapper that prevents children from mounting/executing if access is denied
 * Supports both regular children and render function pattern
 */
export function ProtectedPage({ children, fallback, className }: ProtectedPageProps) {
  const { currentCompany, currentCompanyUser, isLoading } = useCompany()
  const pathname = usePathname()

  // Show loading state while checking permissions
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    )
  }

  // Check access BEFORE creating/rendering children
  const navItem = getNavigationItemByHref(pathname)
  if (navItem) {
    const requirements = {
      requiredFeatures: navItem.requiredFeatures,
      requiredRoles: navItem.requiredRoles,
      requiredPermissions: navItem.requiredPermissions,
    }

    const canAccess = PermissionService.canAccessRoute(
      currentCompany,
      currentCompanyUser,
      requirements
    )

    if (!canAccess) {
      // Get the reason for denial
      const denialReason = PermissionService.getAccessDenialReason(
        currentCompany,
        currentCompanyUser,
        requirements
      )

      // If custom fallback is provided, use it
      if (fallback) {
        return <>{fallback}</>
      }

      // Show 403 content - children are NOT created/rendered
      return (
        <ForbiddenContent
          reason={denialReason.reason || 'permission'}
          feature={denialReason.missingFeature || null}
          attemptedPath={pathname}
        />
      )
    }
  }

  // Only render children if access is granted
  // If children is a function, call it (render prop pattern)
  // Otherwise, render children directly
  const content = typeof children === 'function' ? children() : children
  return <div className={className}>{content}</div>
}
