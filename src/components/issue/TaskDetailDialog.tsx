'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { IssueDetailPage } from './IssueDetailPage'
import type { GeneratedTask } from '@/types/task-template-schema'
import type { EnhancedProject } from '@/types/project-schema'
import { useCompany } from '@/contexts/CompanyContext'
import { TaskTemplateService, UserService, WorkspaceService } from '@/lib/services'
import { EntityLookupService } from '@/lib/services/import/entity-lookup-service'
import type { ProjectCustomFieldWithDefinition } from '@/types/custom-field'

interface TaskDetailDialogProps {
  task: GeneratedTask | null
  project?: EnhancedProject | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: (task: GeneratedTask) => Promise<void>
  projectFields?: ProjectCustomFieldWithDefinition[]
  userRole?: string
  groupId?: string
}

export function TaskDetailDialog({
  task,
  project,
  open,
  onOpenChange,
  onUpdate,
  projectFields,
  userRole,
  groupId: groupIdFromProps
}: TaskDetailDialogProps) {
  const { companyId, groupId: currentGroupId } = useCompany()
  const groupId = groupIdFromProps || currentGroupId
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])
  const [currentTask, setCurrentTask] = useState<GeneratedTask | null>(task)
  const [projectTasks, setProjectTasks] = useState<GeneratedTask[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setCurrentTask(task)
  }, [task])

  // Load users when dialog opens
  useEffect(() => {
    if (open && companyId && project) {
      const loadUsers = async () => {
        try {
          let userList: any[] = []


          // Check if project has workspace and if it's private/secret
          if (project.workspaceId) {
            const workspace = await WorkspaceService.getWorkspace(groupId ?? companyId, companyId, project.workspaceId)
            const workspaceVisibility = workspace?.visibility || 'standard'
            const projectVisibility = project.visibility || 'standard'

            if (workspaceVisibility === 'private' || workspaceVisibility === 'secret' ||
              projectVisibility === 'private' || projectVisibility === 'secret') {
              // Only load workspace members for private/secret workspaces/projects
              const workspaceUsers = await EntityLookupService.fetchWorkspaceUsers(companyId, project.workspaceId, groupId ?? undefined)
              userList = workspaceUsers
            } else {
              // Load all users for standard/confidential workspaces/projects
              userList = await UserService.getUsers(companyId, groupId ?? undefined)
            }
          } else {
            // No workspace, load all users
            userList = await UserService.getUsers(companyId, groupId ?? undefined)
          }

          // Ensure assigned user is included even if not in workspace/project
          if (task?.assignedUserId) {
            const assignedUserInList = userList.find(u => u.id === task.assignedUserId)
            if (!assignedUserInList) {
              try {
                const assignedUser = await UserService.getUser(companyId, task.assignedUserId, groupId ?? undefined)
                if (assignedUser) {
                  userList.push(assignedUser)
                }
              } catch (error) {
                console.error('Error fetching assigned user:', error)
              }
            }
          }

          // Ensure reporter is included even if not in workspace/project
          if (task?.reporter) {
            const reporterInList = userList.find(u => u.id === task.reporter)
            if (!reporterInList) {
              try {
                const reporterUser = await UserService.getUser(companyId, task.reporter, groupId ?? undefined)
                if (reporterUser) {
                  userList.push(reporterUser)
                }
              } catch (error) {
                console.error('Error fetching reporter user:', error)
              }
            }
          }

          setUsers(userList.map(u => ({
            id: u.id,
            name: u.name || u.email || u.id,
            avatar: u.avatar
          })))
        } catch (error) {
          console.error('Error loading users:', error)
          // Fallback to all users on error
          try {
            const userList = await UserService.getUsers(companyId, groupId ?? undefined)
            setUsers(userList.map(u => ({
              id: u.id,
              name: u.name || u.email || u.id,
              avatar: u.avatar
            })))
          } catch (fallbackError) {
            console.error('Error loading fallback users:', fallbackError)
          }
        }
      }
      loadUsers()
    }
  }, [open, companyId, groupId, project, task?.assignedUserId])

  // Helper function to ensure assigned user is in users array
  const ensureAssignedUserInList = async (assignedUserId: string | undefined) => {
    if (!assignedUserId || !companyId) return

    setUsers(prevUsers => {
      const userExists = prevUsers.find(u => u.id === assignedUserId)
      if (!userExists) {
        // Fetch the assigned user and add to list asynchronously
        UserService.getUser(companyId, assignedUserId, groupId ?? undefined)
          .then(user => {
            if (user) {
              setUsers(prev => {
                // Check again to avoid duplicates
                if (!prev.find(u => u.id === user.id)) {
                  return [...prev, {
                    id: user.id,
                    name: user.name || user.email || user.id,
                    avatar: user.avatar
                  }]
                }
                return prev
              })
            }
          })
          .catch(error => {
            console.error('Error fetching assigned user:', error)
          })
      }
      return prevUsers
    })
  }

  // Reload task and fetch project tasks when dialog opens
  useEffect(() => {
    if (open && task?.id && companyId) {
      const reloadData = async () => {
        try {
          setLoading(true)

          // Fetch current task details
          const updatedTask = await TaskTemplateService.getTask(companyId, task.id, groupId ?? undefined)
          if (updatedTask) {
            setCurrentTask(updatedTask)
            // Ensure assigned user is in users array
            await ensureAssignedUserInList(updatedTask.assignedUserId)
          }

          // Fetch all project tasks for dependency picker
          if (project?.id) {
            const tasks = await TaskTemplateService.getProjectTasks(companyId, project.id, groupId ?? undefined)
            setProjectTasks(tasks)
          }
        } catch (error) {
          console.error('Error reloading task data:', error)
        } finally {
          setLoading(false)
        }
      }
      reloadData()
    }
  }, [open, task?.id, companyId, project?.id, groupId])

  const handleUpdate = async (updatedTask: GeneratedTask) => {
    if (onUpdate) {
      await onUpdate(updatedTask)
    }
    // Reload task after update
    if (updatedTask.id && companyId) {
      try {
        const reloaded = await TaskTemplateService.getTask(companyId, updatedTask.id, groupId ?? undefined)
        if (reloaded) {
          setCurrentTask(reloaded)
        }
      } catch (error) {
        console.error('Error reloading task after update:', error)
      }
    }
  }

  if (!currentTask) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 flex flex-col overflow-hidden [&>button]:hidden shadow-2xl border-muted/20">
        <DialogTitle className="sr-only">
          {currentTask.title || 'Task Details'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Detailed view of the task and its activities.
        </DialogDescription>
        <div className="flex-1 overflow-hidden relative scrollbar-ultrathin">
          <IssueDetailPage
            task={currentTask}
            project={project}
            onUpdate={handleUpdate}
            onBack={() => onOpenChange(false)}
            users={users}
            projectTasks={projectTasks}
            projectFields={projectFields}
            initialEdit={false}
            userRole={userRole}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

