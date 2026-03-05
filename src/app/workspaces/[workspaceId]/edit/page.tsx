'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { WorkspaceForm } from '@/components/features/workspaces/WorkspaceForm'
import { WorkspaceService } from '@/lib/services'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import type { Workspace } from '@/types/workspace-schema'
import toast from 'react-hot-toast'

export default function EditWorkspacePage() {
  const params = useParams()
  const router = useRouter()
  const { groupId, companyId, currentCompanyUser } = useCompany()
  const { user: currentUser } = useAuthStore()
  const workspaceId = params.workspaceId as string

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadWorkspace = async () => {
      if (!groupId || !companyId || !workspaceId) return

      try {
        setLoading(true)
        const workspaceData = await WorkspaceService.getWorkspace(groupId, companyId, workspaceId)
        if (!workspaceData) {
          toast.error('Workspace not found')
          router.push('/workspaces')
          return
        }

        // Check workspace visibility and access
        const userId = currentUser?.id
        const isGlobalAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'
        const oldAdminIds = (workspaceData as any).adminIds || [];
        const ownerId = workspaceData.ownerId || (Array.isArray(oldAdminIds) && oldAdminIds.length > 0 ? oldAdminIds[0] : null);
        const isOwner = userId && ownerId === userId;
        const oldSpocIds = (workspaceData as any).spocIds || [];
        const members = workspaceData.members || oldSpocIds;
        const isWMember = userId && Array.isArray(members) && members.includes(userId);
        const isWCreator = userId && workspaceData.createdBy === userId;

        const visibility = workspaceData.visibility || 'standard';

        // Private/Secret: Zero inheritance - not visible to managers/admins unless explicitly invited
        if (visibility === 'private' || visibility === 'secret') {
          if (!isOwner && !isWMember && !isWCreator) {
            toast.error('You do not have permission to view this workspace.')
            router.push('/workspaces')
            return
          }
        } else {
          // For standard/confidential visibility: admins can access, non-admins need membership
          if (!isGlobalAdmin && !isOwner && !isWMember && !isWCreator) {
            toast.error('You do not have permission to view this workspace.')
            router.push('/workspaces')
            return
          }
        }

        setWorkspace(workspaceData)
      } catch (error) {
        console.error('Error loading workspace:', error)
        toast.error('Failed to load workspace')
        router.push('/workspaces')
      } finally {
        setLoading(false)
      }
    }

    loadWorkspace()
  }, [companyId, workspaceId, router, currentUser, currentCompanyUser])

  const handleSave = async (workspace: Workspace) => {
    router.push('/workspaces')
  }

  const handleCancel = () => {
    router.push('/workspaces')
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl flex flex-col min-h-0 flex-1 overflow-y-auto">
        <WorkspaceForm workspace={workspace} onSave={handleSave} onCancel={handleCancel} />
      </div>
    </DashboardLayout>
  )
}

