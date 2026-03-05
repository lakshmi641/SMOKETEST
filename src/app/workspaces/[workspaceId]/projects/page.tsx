'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCompanyConfig } from '@/hooks/useCompanyConfig'
import { EnhancedProject } from '@/types/project-schema'
import { WorkspaceService } from '@/lib/services'
import { useProjectsQuery, useProjectMutations } from '@/hooks/queries/useProjectQueries'
import { PermissionService } from '@/lib/services/permission-service'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { ViewToggle, ViewType } from '@/components/ui/view-toggle'
import { ProjectTable, VirtualizedProjectTable } from '@/components/features/projects'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { ActionMenu, createEditAction, createDeleteAction } from '@/components/ui/action-menu'
import { Plus, Users, Calendar, DollarSign, TrendingUp, Clock, AlertCircle, Building2, ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { formatDate } from '@/lib/utils/date-utils'

export default function WorkspaceProjectsPage() {
  const params = useParams()
  const router = useRouter()
  const { groupId, companyId, isLoading: companyLoading, currentCompany, currentCompanyUser } = useCompany()
  const { selectedWorkspace, selectWorkspaceById } = useWorkspace()
  const { user: currentUser } = useAuthStore()
  const workspaceId = params.workspaceId as string

  const isGlobalAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'

  const { data: allProjects = [], isLoading: projectsLoading } = useProjectsQuery(
    companyId ?? undefined,
    groupId ?? undefined,
    currentUser?.id,
    isGlobalAdmin
  )
  const projects = useMemo(
    () => allProjects.filter(p => p.workspaceId === workspaceId),
    [allProjects, workspaceId]
  )

  const [workspace, setWorkspace] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [viewType, setViewType] = useState<ViewType>('table')
  const { deleteProject } = useProjectMutations(companyId ?? undefined, groupId ?? undefined)
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    project: EnhancedProject | null
  }>({ open: false, project: null })

  useEffect(() => {
    const loadData = async () => {
      if (!groupId || !companyId || !workspaceId) {
        setLoading(false)
        return
      }

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
        selectWorkspaceById(workspaceId)
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('Failed to load projects')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [groupId, companyId, workspaceId, router, selectWorkspaceById, currentUser, currentCompanyUser])

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

    // Only creator or admin can delete
    // Note: createdBy may not be in the schema but exists in practice
    const projectWithCreatedBy = project as EnhancedProject & { createdBy?: string }
    const isCreator = projectWithCreatedBy.createdBy === currentUser?.id
    const isAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'

    if (!isCreator && !isAdmin) {
      toast.error('You can only delete projects created by you')
      return
    }

    try {
      await deleteProject.mutateAsync(project.id)
      toast.success(`${project.name} has been deleted successfully`)
    } catch (error) {
      console.error('Error deleting project:', error)
      toast.error('Failed to delete project. Please try again.')
    }
  }

  const navigateToProject = (project: EnhancedProject) => {
    router.push(`/workspaces/${workspaceId}/projects/${project.id}`)
  }

  const handleEditProject = (project: EnhancedProject) => {
    router.push(`/workspaces/${workspaceId}/projects/${project.id}/edit`)
  }

  if (loading || companyLoading || projectsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!workspace) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Workspace not found</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="mx-auto space-y-4">

        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/workspaces/${workspaceId}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Projects</h1>
              <p className="text-muted-foreground">
                {workspace.name} • {projects.length} project{projects.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ViewToggle currentView={viewType} onViewChange={setViewType} />
            {PermissionService.canAccessRoute(
              currentCompany,
              currentCompanyUser,
              {
                requiredFeatures: ['projectManagement'],
                requiredRoles: ['owner', 'admin', 'manager'],
                requiredPermissions: ['canCreateProjects'],
              }
            ) && (
                <Button onClick={() => router.push(`/projects/create?workspaceId=${workspaceId}`)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Project
                </Button>
              )}
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
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {projects.filter(p => p.status === 'completed').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>

          <div className="bg-card rounded-lg border shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">On Hold</p>
                <p className="text-2xl font-bold text-warning">
                  {projects.filter(p => p.status === 'on-hold').length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-warning" />
            </div>
          </div>
        </div>

        {/* Projects List/Grid */}
        {projects.length === 0 ? (
          <div className="bg-card rounded-lg border shadow-sm p-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first project in {workspace.name}
            </p>
            {PermissionService.canAccessRoute(
              currentCompany,
              currentCompanyUser,
              {
                requiredFeatures: ['projectManagement'],
                requiredRoles: ['owner', 'admin', 'manager'],
                requiredPermissions: ['canCreateProjects'],
              }
            ) && (
                <Button onClick={() => router.push(`/projects/create?workspaceId=${workspaceId}`)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Project
                </Button>
              )}
          </div>
        ) : viewType === 'table' ? (
          <VirtualizedProjectTable
            projects={projects}
            onView={navigateToProject}
            onEdit={handleEditProject}
            onDelete={(project) => setDeleteDialog({ open: true, project })}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-card rounded-lg border shadow-sm p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigateToProject(project)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1">{project.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                  </div>
                  <ActionMenu
                    items={[
                      createEditAction(() => handleEditProject(project)),
                      createDeleteAction(() => setDeleteDialog({ open: true, project }))
                    ]}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(project.status)}>
                      {project.status}
                    </Badge>
                    <Badge className={getPriorityColor(project.priority)}>
                      {project.priority}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{project.team.length} members</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(project.endDate)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <div className="w-full bg-muted rounded-full h-2 mr-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{project.progress}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <ConfirmationDialog
          open={deleteDialog.open}
          onOpenChange={(open) => setDeleteDialog({ open, project: null })}
          title="Delete Project"
          description={`Are you sure you want to delete "${deleteDialog.project?.name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={() => {
            if (deleteDialog.project) {
              handleDeleteProject(deleteDialog.project)
              setDeleteDialog({ open: false, project: null })
            }
          }}
        />
      </div>
    </DashboardLayout>
  )
}

