'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PermissionService } from '@/lib/services/permission-service'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { Plus, Users, FolderKanban, CheckCircle2, Building2, Archive, Edit, Trash, Eye, Lock, LockKeyhole } from 'lucide-react'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import type { Workspace } from '@/types/workspace-schema'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { StarButton } from '@/components/ui/star-button'
import { useStarredItems } from '@/hooks/useStarredItems'
import { useWorkspacesQuery, useWorkspaceMutations } from '@/hooks/queries/useWorkspaceQueries'

export default function WorkspacesPage() {
  const router = useRouter()
  const { companyId, groupId, isLoading: companyLoading, currentCompany, currentCompanyUser } = useCompany()
  const { user: currentUser } = useAuthStore()
  const { isStarred, toggleStarred } = useStarredItems()

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    workspace: Workspace | null
  }>({ open: false, workspace: null })

  // TanStack Query
  const {
    data: workspaces = [],
    isLoading: workspacesLoading
  } = useWorkspacesQuery(groupId ?? companyId ?? undefined, companyId || undefined)

  const { deleteWorkspace } = useWorkspaceMutations(groupId ?? companyId ?? undefined, companyId || undefined)

  const handleDeleteWorkspace = async (workspace: Workspace) => {
    if (!companyId) return

    const isCreator = workspace.createdBy === currentUser?.id
    const oldAdminIds = (workspace as any).adminIds || [];
    const ownerId = workspace.ownerId || (Array.isArray(oldAdminIds) && oldAdminIds.length > 0 ? oldAdminIds[0] : null);
    const isOwner = ownerId === currentUser?.id;
    const isGlobalAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'

    if (!isCreator && !isOwner && !isGlobalAdmin) {
      toast.error('Only workspace administrators or global admins can delete this workspace')
      return
    }

    try {
      await deleteWorkspace.mutateAsync(workspace.id)
      setDeleteDialog({ open: false, workspace: null })
      toast.success(`${workspace.name} has been deleted successfully`)
    } catch (error) {
      console.error('Error deleting workspace:', error)
    }
  }

  const activeWorkspaces = workspaces.filter(w => w?.status === 'active')
  const totalProjects = workspaces.reduce((sum, w) => sum + (w.totalProjects || 0), 0)
  const activeProjects = workspaces.reduce((sum, w) => sum + (w.activeProjects || 0), 0)
  const totalTasks = workspaces.reduce((sum, w) => sum + (w.totalTasks || 0), 0)
  const completedTasks = workspaces.reduce((sum, w) => sum + (w.completedTasks || 0), 0)

  const loading = companyLoading || workspacesLoading

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
          <p className="text-muted-foreground">
            Manage functional teams and their projects
          </p>
          <div className="flex items-center gap-4">
            {PermissionService.canAccessRoute(
              currentCompany,
              currentCompanyUser,
              {
                requiredFeatures: ['projectManagement'],
                requiredRoles: ['owner', 'admin'],
              }
            ) && (
                <Button onClick={() => router.push('/workspaces/create')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Workspace
                </Button>
              )}
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Workspaces</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeWorkspaces.length}</div>
              <p className="text-xs text-muted-foreground">{activeWorkspaces.length} {activeWorkspaces.length === 1 ? 'workspace' : 'workspaces'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProjects}</div>
              <p className="text-xs text-muted-foreground">{activeProjects} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTasks}</div>
              <p className="text-xs text-muted-foreground">{completedTasks} completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Workspaces List - table scrolls when content grows */}
        <div className="flex-1 min-h-0 flex flex-col">
        {workspaces.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No workspaces yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first workspace to organize projects by functional teams
              </p>
              {PermissionService.canAccessRoute(
                currentCompany,
                currentCompanyUser,
                {
                  requiredFeatures: ['projectManagement'],
                  requiredRoles: ['owner', 'admin'],
                }
              ) && (
                  <Button onClick={() => router.push('/workspaces/create')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Workspace
                  </Button>
                )}
            </CardContent>
          </Card>
        ) : (
          <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div
              className="overflow-auto min-h-0 flex-1"
              style={{ maxHeight: '600px' }}
            >
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[180px]">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[100px]">Visibility</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[80px]">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[120px]">Projects</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[100px]">Tasks</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[100px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaces.map((workspace) => (
                    <tr key={workspace.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-4 align-top min-w-[180px]">
                        <div className="flex items-start gap-2 min-w-0">
                          <StarButton
                            isStarred={isStarred('workspace', workspace.id)}
                            onToggle={() => toggleStarred('workspace', workspace.id)}
                            size="sm"
                            className="shrink-0 mt-0.5"
                          />
                          <Link href={`/workspaces/${workspace.id}`} className="flex items-center gap-2 hover:text-primary min-w-0 break-words">
                            {workspace.color && (
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: workspace.color }}
                              />
                            )}
                            <span className="font-medium break-words">{workspace.name}</span>
                          </Link>
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top">
                        {(() => {
                          const visibility = workspace.visibility || 'standard'
                          if (visibility === 'private' || visibility === 'secret') {
                            return (
                              <Badge variant="outline" className="flex items-center gap-1 w-fit border-amber-300 text-amber-700 bg-amber-50">
                                <LockKeyhole className="h-3 w-3" />
                                Private
                              </Badge>
                            )
                          } else if (visibility === 'confidential') {
                            return (
                              <Badge variant="outline" className="flex items-center gap-1 w-fit border-blue-300 text-blue-700 bg-blue-50">
                                <Lock className="h-3 w-3" />
                                Confidential
                              </Badge>
                            )
                          } else {
                            return (
                              <Badge variant="outline" className="flex items-center gap-1 w-fit border-green-300 text-green-700 bg-green-50">
                                <Eye className="h-3 w-3" />
                                Public
                              </Badge>
                            )
                          }
                        })()}
                      </td>
                      <td className="py-3 px-4 align-top">
                        <Badge variant={workspace.status === 'active' ? 'default' : 'secondary'}>
                          {workspace.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 align-top break-words">
                        <div className="flex items-center gap-1 flex-wrap">
                          <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">{workspace.totalProjects ?? 0}</span>
                          {workspace.activeProjects != null && workspace.activeProjects > 0 && (
                            <span className="text-xs text-muted-foreground">({workspace.activeProjects} active)</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top break-words">
                        <div className="flex items-center gap-1 flex-wrap">
                          <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">{workspace.totalTasks ?? 0}</span>
                          {workspace.completedTasks != null && workspace.completedTasks > 0 && (
                            <span className="text-xs text-muted-foreground">({workspace.completedTasks} done)</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {(currentCompanyUser?.role === 'owner' ||
                            currentCompanyUser?.role === 'admin' ||
                            workspace.createdBy === currentUser?.id ||
                            (() => {
                              const oldAdminIds = (workspace as any).adminIds || [];
                              const ownerId = workspace.ownerId || (Array.isArray(oldAdminIds) && oldAdminIds.length > 0 ? oldAdminIds[0] : null);
                              return ownerId === currentUser?.id;
                            })()) && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    router.push(`/workspaces/${workspace.id}/edit`)
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    setDeleteDialog({ open: true, workspace })
                                  }}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        </div>

        <ConfirmationDialog
          open={deleteDialog.open}
          onOpenChange={(open) => setDeleteDialog({ open, workspace: null })}
          title="Delete Workspace"
          description={`Are you sure you want to delete "${deleteDialog.workspace?.name}"? This will also affect all projects in this workspace. This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
          onConfirm={() => {
            if (deleteDialog.workspace) {
              handleDeleteWorkspace(deleteDialog.workspace)
            }
          }}
        />
      </div>
    </DashboardLayout >
  )
}
