'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

/**
 * Workspace-scoped project detail page
 * Redirects to the global project detail page to ensure UI consistency
 */
export default function WorkspaceProjectDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  useEffect(() => {
    // Redirect to global project detail page
    if (projectId) {
      const search = window.location.search
      router.replace(`/projects/${projectId}${search}`)
    }
  }, [projectId, router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground animate-pulse">Redirecting to project...</p>
      </div>
    </div>
  )
}
