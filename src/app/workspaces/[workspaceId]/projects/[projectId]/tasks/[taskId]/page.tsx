'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { IssueDetailPage } from '@/components/issue/IssueDetailPage'
import { useCompany } from '@/contexts/CompanyContext'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useAuthStore } from '@/store/authStore'
import { ProjectService, TaskTemplateService, UserService, WorkspaceService } from '@/lib/services'
import { EntityLookupService } from '@/lib/services/import/entity-lookup-service'
import type { EnhancedProject } from '@/types/project-schema'
import type { GeneratedTask } from '@/types/task-template-schema'
import type { User } from '@/types'

export default function WorkspaceProjectTaskDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { groupId, companyId, currentCompanyUser } = useCompany()
  const { user: currentUser } = useAuthStore()
  const { selectWorkspaceById } = useWorkspace()
  const workspaceId = params.workspaceId as string
  const projectId = params.projectId as string
  const taskId = params.taskId as string

  const [loading, setLoading] = useState(true)
  const [workspace, setWorkspace] = useState<any>(null)
  const [project, setProject] = useState<EnhancedProject | null>(null)
  const [task, setTask] = useState<GeneratedTask | null>(null)
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    const load = async () => {
      if (!groupId || !companyId || !workspaceId || !projectId || !taskId) return
      setLoading(true)
      try {
        const userId = currentUser?.id
        const isGlobalAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'
        const [workspaceData, proj, taskData] = await Promise.all([
          WorkspaceService.getWorkspace(groupId, companyId, workspaceId),
          ProjectService.getProject(companyId, projectId, userId, isGlobalAdmin, { groupId: groupId ?? undefined }),
          TaskTemplateService.getTask(companyId, taskId, groupId ?? undefined),
        ])

        // Load users - filter by workspace if private/secret
        let userList: any[] = []
        if (workspaceData && proj) {
          const workspaceVisibility = workspaceData.visibility || 'standard'
          const projectVisibility = proj.visibility || 'standard'

          if (workspaceVisibility === 'private' || workspaceVisibility === 'secret' ||
            projectVisibility === 'private' || projectVisibility === 'secret') {
            // Only load workspace members for private/secret workspaces/projects
            userList = await EntityLookupService.fetchWorkspaceUsers(companyId, workspaceId, groupId ?? undefined)
          } else {
            // Load all users for standard/confidential workspaces/projects
            userList = await UserService.getUsers(companyId, groupId ?? undefined)
          }
        } else {
          // Fallback to all users
          userList = await UserService.getUsers(companyId, groupId ?? undefined)
        }

        if (!workspaceData) {
          router.replace('/workspaces')
          return
        }

        // Check workspace visibility and access
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
            router.replace('/workspaces')
            return
          }
        } else {
          // For standard/confidential visibility: admins can access, non-admins need membership
          if (!isGlobalAdmin && !isOwner && !isWMember && !isWCreator) {
            router.replace('/workspaces')
            return
          }
        }

        setWorkspace(workspaceData)
        selectWorkspaceById(workspaceId)

        if (!proj) {
          router.replace(`/workspaces/${workspaceId}/projects`)
          return
        }

        // Validate project belongs to workspace
        if (proj.workspaceId !== workspaceId) {
          router.replace(`/workspaces/${workspaceId}/projects`)
          return
        }

        if (!taskData || (taskData.projectId && taskData.projectId !== projectId)) {
          // Task not found or doesn't belong to this project
          router.replace(`/workspaces/${workspaceId}/projects/${projectId}?tab=list`)
          return
        }

        setProject(proj)
        setTask(taskData)
        setUsers((userList as User[]).map(u => ({ id: u.id, name: u.name || u.email || u.id })))
      } catch (e) {
        console.error('Failed to load task details:', e)
        router.replace(`/workspaces/${workspaceId}/projects/${projectId}`)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [companyId, workspaceId, projectId, taskId, router, selectWorkspaceById])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  if (!project || !task || !workspace) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center text-gray-600">
          Task not found
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <IssueDetailPage
        task={task}
        project={project}
        initialEdit={true}
        users={users}
        userRole={currentCompanyUser?.role}
        onBack={() => router.push(`/workspaces/${workspaceId}/projects/${projectId}?tab=list`)}
        onUpdate={async (updated) => {
          if (!companyId) return
          await TaskTemplateService.updateTaskStatus(companyId, updated.id, updated.status, {
            title: updated.title,
            description: updated.description,
            priority: updated.priority,
            dueDate: updated.dueDate,
            estimatedHours: updated.estimatedHours,
            definitionOfDone: updated.definitionOfDone,
            progress: updated.progress ?? 0,
            assignedUserId: updated.assignedUserId,
            updatedAt: new Date().toISOString(),
          } as any, undefined, false, groupId ?? undefined)
          const refreshed = await TaskTemplateService.getTask(companyId, updated.id, groupId ?? undefined)
          if (refreshed) setTask(refreshed)
        }}
      />
    </DashboardLayout>
  )
}

