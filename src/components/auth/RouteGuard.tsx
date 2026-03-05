'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useCompany } from '@/contexts/CompanyContext'
import { PermissionService } from '@/lib/services/permission-service'
import { getNavigationItemByHref } from '@/config/navigation'
import { ForbiddenContent } from '@/components/errors/ForbiddenContent'

interface RouteGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  redirectTo?: string
}

export function RouteGuard({ 
  children, 
  fallback,
  redirectTo = '/my-tasks'
}: RouteGuardProps) {
  const { currentCompany, currentCompanyUser, isLoading } = useCompany()
  const pathname = usePathname()

  // Check access and determine what to render
  const { canAccess, denialReason } = useMemo(() => {
    // Show loading state while checking permissions
    if (isLoading) {
      return { canAccess: null, denialReason: null }
    }

    // Check access BEFORE rendering children to prevent page from loading
    const navItem = getNavigationItemByHref(pathname)
    if (navItem) {
      const requirements = {
        requiredFeatures: navItem.requiredFeatures,
        requiredRoles: navItem.requiredRoles,
        requiredPermissions: navItem.requiredPermissions,
      }

      const hasAccess = PermissionService.canAccessRoute(
        currentCompany,
        currentCompanyUser,
        requirements
      )

      if (!hasAccess) {
        // Get the reason for denial
        const reason = PermissionService.getAccessDenialReason(
          currentCompany,
          currentCompanyUser,
          requirements
        )
        return { canAccess: false, denialReason: reason }
      }
    }

    return { canAccess: true, denialReason: null }
  }, [isLoading, pathname, currentCompany, currentCompanyUser])

  // Show loading state while checking permissions
  if (canAccess === null) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    )
  }

  // If access denied, show 403 - children are NOT evaluated/rendered
  if (!canAccess) {
    // If custom fallback is provided, use it
    if (fallback) {
      return <>{fallback}</>
    }

    // Show 403 content inline within the layout
    // Children are NOT rendered, so page component won't mount or execute
    return (
      <ForbiddenContent
        reason={denialReason?.reason || 'permission'}
        feature={denialReason?.missingFeature || null}
        attemptedPath={pathname}
      />
    )
  }

  // Only render children if access is granted
  // Children are only evaluated when canAccess is true
  return <>{children}</>
}
