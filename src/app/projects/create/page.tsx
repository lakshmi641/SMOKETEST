'use client'

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProtectedPage } from '@/components/auth/ProtectedPage'
import { SimpleProjectCreation } from '@/components/features/projects'

export default function CreateProjectPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const workspaceId = searchParams.get('workspaceId') || undefined

  const handleProjectCreated = (projectId: string) => {
    // Navigate to the newly created project
    router.push(`/projects/${projectId}`)
  }

  const handleCancel = () => {
    router.push('/projects')
  }

  return (
    <DashboardLayout>
      <ProtectedPage>
        {() => (
          <div>
            <SimpleProjectCreation
              onProjectCreated={handleProjectCreated}
              onCancel={handleCancel}
              initialWorkspaceId={workspaceId}
            />
          </div>
        )}
      </ProtectedPage>
    </DashboardLayout>
  )
}
