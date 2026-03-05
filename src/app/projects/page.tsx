'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { useCompanyConfig } from '@/hooks/useCompanyConfig'
import { EnhancedProject } from '@/types/project-schema'
import { useCompany } from '@/contexts/CompanyContext'
import { useStarredItems } from '@/hooks/useStarredItems'
import { StarButton } from '@/components/ui/star-button'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useAuthStore } from '@/store/authStore'
import { ViewToggle, ViewType } from '@/components/ui/view-toggle'
import { VirtualizedProjectTable } from '@/components/features/projects'
import { EditProjectDialog } from '@/components/features/projects/EditProjectDialog'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { ActionMenu, createEditAction, createDeleteAction } from '@/components/ui/action-menu'
import { Plus, Users, Calendar, TrendingUp, Clock, Building2, CheckSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import { logger } from '@/lib/logger'
import { useProjectsQuery, useProjectMutations } from '@/hooks/queries/useProjectQueries'
import { useWorkspacesQuery } from '@/hooks/queries/useWorkspaceQueries'
import { formatDate } from '@/lib/utils/date-utils'

export default function ProjectsPage() {
  const router = useRouter()
  const { companyId, groupId, isLoading: companyLoading, currentCompanyUser } = useCompany()
  const { selectedWorkspace } = useWorkspace()
  const { user: currentUser } = useAuthStore()
  const { isStarred, toggleStarred } = useStarredItems()
  const companyConfig = useCompanyConfig()

  const [viewType, setViewType] = useState<ViewType>('table')
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    project: EnhancedProject | null
  }>({ open: false, project: null })
  const [editDialog, setEditDialog] = useState<{
    open: boolean
    project: EnhancedProject | null
  }>({ open: false, project: null })

  // Use TanStack Query (pass groupId for multi-org so we read from enterprise path)
  const {
    data: projects = [],
    isLoading: projectsLoading
  } = useProjectsQuery(
    companyId || undefined,
    groupId ?? undefined,
    currentUser?.id,
    currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'
  )

  const {
    data: workspaces = [],
    isLoading: workspacesLoading
  } = useWorkspacesQuery(groupId ?? companyId ?? undefined, companyId || undefined)

  const { deleteProject } = useProjectMutations(companyId || undefined, groupId ?? undefined)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-success/10 text-success'
      case 'planning':
        return 'bg-primary/10 text-primary'
      case 'completed':
        return 'bg-muted text-muted-foreground'
      case 'on-hold':
        return 'bg-warning/10 text-warning'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-destructive/10 text-destructive'
      case 'medium':
        return 'bg-warning/10 text-warning'
      case 'low':
        return 'bg-success/10 text-success'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const handleDeleteProject = async (project: EnhancedProject) => {
    if (!companyId) return

    const isCreator = (project as any).createdBy === currentUser?.id
    const isGlobalAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'

    // Check if user is a W-Admin of the parent workspace
    const workspace = workspaces.find(w => w.id === project.workspaceId)
    const isWAdmin = workspace?.ownerId === currentUser?.id

    if (!isCreator && !isGlobalAdmin && !isWAdmin) {
      toast.error('Only project creators, workspace admins, or global admins can delete this project')
      return
    }

    try {
      await deleteProject.mutateAsync(project.id)
      setDeleteDialog({ open: false, project: null })
      toast.success(`${project.name} has been deleted successfully`)
    } catch (error) {
      logger.error('Error deleting project:', error)
    }
  }

  const navigateToProject = (project: EnhancedProject) => {
    if (selectedWorkspace && project.workspaceId === selectedWorkspace.id) {
      router.push(`/workspaces/${selectedWorkspace.id}/projects/${project.id}`)
    } else if (project.workspaceId) {
      router.push(`/workspaces/${project.workspaceId}/projects/${project.id}`)
    } else {
      router.push(`/projects/${project.id}`)
    }
  }

  const handleEditProject = (project: EnhancedProject) => {
    setEditDialog({ open: true, project })
  }

  const handleProjectUpdate = (updatedProject: EnhancedProject) => {
    setEditDialog({ open: false, project: null })
  }

  const loading = companyLoading || projectsLoading || workspacesLoading

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
      <div className="w-full flex flex-col min-h-0 flex-1 space-y-6">

        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="text-muted-foreground">
              {selectedWorkspace
                ? `${selectedWorkspace.name} • ${projects.length} project${projects.length !== 1 ? 's' : ''}`
                : `Manage your ${companyConfig.name} manufacturing projects`
              }
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ViewToggle currentView={viewType} onViewChange={setViewType} />
            <Button onClick={() => router.push(`/projects/create${selectedWorkspace ? `?workspaceId=${selectedWorkspace.id}` : ''}`)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg border shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-card-foreground">{projects.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>

          <div className="bg-card rounded-lg border shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-success">
                  {projects.filter(p => p.status === 'active').length}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-success" />
            </div>
          </div>

          <div className="bg-card rounded-lg border shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Planning</p>
                <p className="text-2xl font-bold text-warning">
                  {projects.filter(p => p.status === 'planning').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-warning" />
            </div>
          </div>

          <div className="bg-card rounded-lg border shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold text-primary">
                  {projects.reduce((sum, p) => sum + (p.totalTasks || 0), 0)}
                </p>
              </div>
              <CheckSquare className="h-8 w-8 text-primary" />
            </div>
          </div>
        </div>

        {/* Main Content - table area scrolls when content grows */}
        <div className="grid grid-cols-1 gap-4 flex-1 min-h-0">
          {/* Project List */}
          <div className="flex flex-col min-h-0 flex-1">
            <div className="bg-card rounded-lg border shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex-shrink-0">
                <h2 className="text-xl font-semibold text-card-foreground">All Projects</h2>
              </div>
              <div className="p-4 flex-1 min-h-0">
                {viewType === 'table' ? (
                  <VirtualizedProjectTable
                    projects={projects}
                    workspaces={workspaces}
                    onView={navigateToProject}
                    onEdit={handleEditProject}
                    onDelete={(project) => setDeleteDialog({ open: true, project })}
                    height={600}
                    loading={loading}
                  />
                ) : (
                  <div className="space-y-3">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className="border border-border rounded-lg p-4 hover:shadow-lg transition-shadow bg-card cursor-pointer"
                        onClick={() => navigateToProject(project)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <Building2 className="w-5 h-5 text-primary" />
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-base clickable-text">{project.name}</h3>
                                <StarButton
                                  isStarred={isStarred('project', project.id)}
                                  onToggle={() => toggleStarred('project', project.id)}
                                  size="sm"
                                  className="h-4 w-4"
                                />
                              </div>
                              <p className="text-sm text-muted-foreground">{project.description}</p>
                            </div>
                          </div>
                          <div
                            className="flex items-center gap-3 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}>
                                {project.status}
                              </span>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(project.priority)}`}>
                                {project.priority}
                              </span>
                            </div>
                            <div className="flex items-center border-l pl-2 border-border ml-1">
                              <ActionMenu
                                items={[
                                  createEditAction(() => handleEditProject(project)),
                                  createDeleteAction(() => setDeleteDialog({ open: true, project }))
                                ]}
                                size="sm"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {Array.isArray(project.team) ? project.team.length : 0} members
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {project.endDate ? formatDate(project.endDate) : 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <CheckSquare className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {project.totalTasks || 0} tasks
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1 mt-3">
                          {(Array.isArray(project.tags) ? project.tags : []).map((tag, index) => (
                            <span key={index} className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded-md">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, project: null })}
        title="Delete Project"
        description={`Are you sure you want to delete ${deleteDialog.project?.name}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={() => deleteDialog.project && handleDeleteProject(deleteDialog.project)}
      />

      {/* Edit Project Dialog */}
      {editDialog.project && (
        <EditProjectDialog
          project={editDialog.project}
          open={editDialog.open}
          onOpenChange={(open) => setEditDialog({ open, project: null })}
          onUpdate={handleProjectUpdate}
        />
      )}
    </DashboardLayout>
  )
}
