'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { IssueDetailPage } from '@/components/issue/IssueDetailPage'
import { useCompany } from '@/contexts/CompanyContext'
import { ProjectService, TaskTemplateService, UserService, WorkspaceService } from '@/lib/services'
import { EntityLookupService } from '@/lib/services/import/entity-lookup-service'
import { TaskApprovalService } from '@/lib/services/tasks/task-approval-service'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { EnhancedProject } from '@/types/project-schema'
import type { GeneratedTask } from '@/types/task-template-schema'
import { subscribeToTask } from '@/lib/services/tasks/task-realtime-service'

export default function ProjectTaskDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { companyId, groupId, currentCompanyUser } = useCompany()
  const projectId = params.projectId as string
  const taskId = params.taskId as string
  const { user: currentUser } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<EnhancedProject | null>(null)
  const [task, setTask] = useState<GeneratedTask | null>(null)
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])
  const [projectTasks, setProjectTasks] = useState<GeneratedTask[]>([])
  const [isApproverAccess, setIsApproverAccess] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!companyId || !projectId || !taskId) return
      setLoading(true)
      try {
        const userId = currentUser?.id
        const isGlobalAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'

        // First, fetch the task to get its actual projectId
        // This handles the case where projectId='all' (from approvals page)
        const taskData = await TaskTemplateService.getTask(companyId, taskId, groupId ?? undefined)

        // Determine the actual projectId to use
        const actualProjectId = (projectId === 'all' && taskData?.projectId)
          ? taskData.projectId
          : projectId

        const [proj, allProjectTasks] = await Promise.all([
          ProjectService.getProject(companyId, actualProjectId, userId, isGlobalAdmin, { groupId: groupId ?? undefined }),
          TaskTemplateService.getProjectTasks(companyId, actualProjectId, groupId ?? undefined),
        ])

        if (!proj) {
          router.replace('/projects')
          return
        }

        // Load users - filter by workspace if private/secret
        let userList: any[] = []
        if (proj.workspaceId) {
          const workspace = await WorkspaceService.getWorkspace(groupId ?? companyId, companyId, proj.workspaceId)

          if (workspace && userId && !isGlobalAdmin) {
            // Backward compatibility: check both old and new field names
            const oldAdminIds = (workspace as any).adminIds || [];
            const ownerId = workspace.ownerId || (Array.isArray(oldAdminIds) && oldAdminIds.length > 0 ? oldAdminIds[0] : null);
            const isOwner = ownerId === userId;
            const oldSpocIds = (workspace as any).spocIds || [];
            const members = workspace.members || oldSpocIds;
            const isWMember = Array.isArray(members) && members.includes(userId);
            const isCreator = workspace.createdBy === userId

            if (!isOwner && !isWMember && !isCreator) {
              // Special case: Allow if user is specifically assigned to the task
              const isAssignedUser = taskData?.assignedUserId === userId

              // Special case: Allow if user is an approver (past or current) for this task
              // This allows managers to view tasks they need to approve even if not in the project
              let isApprover = false
              if (taskData?.approvalInstanceId) {
                isApprover = await TaskApprovalService.isUserApproverForTask(companyId, taskId, userId, groupId ?? undefined)
                if (isApprover) {
                  setIsApproverAccess(true)
                }
              }

              if (!isAssignedUser && !isApprover) {
                toast.error('You do not have access to this task.')
                router.replace('/projects')
                return
              }
            }
          }

          // Check visibility to determine user list
          if (workspace) {
            const workspaceVisibility = workspace.visibility || 'standard'
            const projectVisibility = proj.visibility || 'standard'

            if (workspaceVisibility === 'private' || workspaceVisibility === 'secret' ||
              projectVisibility === 'private' || projectVisibility === 'secret') {
              // Only load workspace members for private/secret workspaces/projects
              userList = await EntityLookupService.fetchWorkspaceUsers(companyId, proj.workspaceId, groupId ?? undefined)
            } else {
              // Load all users for standard/confidential workspaces/projects
              userList = await UserService.getUsers(companyId, groupId ?? undefined)
            }
          } else {
            userList = await UserService.getUsers(companyId, groupId ?? undefined)
          }
        } else {
          // No workspace, load all users
          userList = await UserService.getUsers(companyId, groupId ?? undefined)
        }

        if (!taskData || (taskData.projectId && taskData.projectId !== actualProjectId)) {
          // Task not found or doesn't belong to this project
          router.replace(`/projects/${actualProjectId}?tab=list`)
          return
        }

        setProject(proj)
        setTask(taskData)
        setUsers(userList.map(u => ({ id: u.id, name: u.name || u.email || u.id })))
        setProjectTasks(allProjectTasks)
      } catch (e) {
        console.error('Failed to load task details:', e)
        router.replace('/projects')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [companyId, projectId, taskId, router])

  // Real-time task updates
  useEffect(() => {
    if (!companyId || !taskId) return

    const unsubscribe = subscribeToTask(
      companyId,
      taskId,
      (updatedTask) => {
        // Only update if we already have the task loaded
        setTask(prev => {
          if (!prev) return prev
          // Preserve projectCode if present in previous state but missing in update (Firestore doesn't store it)
          return {
            ...updatedTask,
            projectCode: prev.projectCode || updatedTask.projectCode
          }
        })
      },
      (error) => {
        console.error('Task subscription error:', error)
      },
      groupId ?? undefined
    )

    return () => unsubscribe()
  }, [companyId, taskId])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  if (!project || !task) {
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
        projectTasks={projectTasks}
        userRole={currentCompanyUser?.role}
        onBack={() => {
          // If there's clear history to go back to, use it
          // Otherwise fall back to the project list
          if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back()
          } else {
            router.push(`/projects/${project.id}?tab=list`)
          }
        }}
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


