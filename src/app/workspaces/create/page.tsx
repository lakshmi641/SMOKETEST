'use client'

import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProtectedPage } from '@/components/auth/ProtectedPage'
import { WorkspaceForm } from '@/components/features/workspaces/WorkspaceForm'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import type { Workspace } from '@/types/workspace-schema'

export default function CreateWorkspacePage() {
  const router = useRouter()
  const { refreshWorkspaces } = useWorkspace()

  const handleSave = async (workspace: Workspace) => {
    // Refresh workspaces list to update the sidebar
    await refreshWorkspaces()
    router.push(`/workspaces/${workspace.id}`)
  }

  const handleCancel = () => {
    router.push('/workspaces')
  }

  return (
    <DashboardLayout>
      <ProtectedPage>
        {() => (
          <div className="mx-auto max-w-7xl flex flex-col min-h-0 flex-1 overflow-y-auto">
            <WorkspaceForm onSave={handleSave} onCancel={handleCancel} />
          </div>
        )}
      </ProtectedPage>
    </DashboardLayout>
  )
}

