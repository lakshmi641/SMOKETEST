'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()

  // Routes that don't require authentication
  const publicRoutes = ['/login']
  const isPublicRoute = publicRoutes.includes(pathname)
  const requiresPasswordChange = !!user?.mustChangePassword
  const forcedPasswordChangeRoute = '/profile'

  useEffect(() => {
    // Don't redirect if still loading
    if (loading) return

    // If user is not authenticated and trying to access protected route
    if (!user && !isPublicRoute) {
      router.push('/login')
      return
    }

    // If user must change password, always force them to profile page
    if (user && requiresPasswordChange && pathname !== forcedPasswordChangeRoute) {
      router.push(forcedPasswordChangeRoute)
      return
    }

    // If user is authenticated and trying to access login page, redirect to my tasks
    if (user && !requiresPasswordChange && pathname === '/login') {
      router.push('/my-tasks')
      return
    }
  }, [user, loading, pathname, isPublicRoute, router, requiresPasswordChange])

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // If user is not authenticated and trying to access protected route, show nothing
  // (redirect will happen in useEffect)
  if (!user && !isPublicRoute) {
    return null
  }

  // If user must change password and is not on the forced route, render nothing
  if (user && requiresPasswordChange && pathname !== forcedPasswordChangeRoute) {
    return null
  }

  // If user is authenticated and trying to access login page, show nothing
  // (redirect will happen in useEffect)
  if (user && !requiresPasswordChange && pathname === '/login') {
    return null
  }

  // Render children for authenticated users on protected routes
  // or for unauthenticated users on public routes
  return <>{children}</>
}
