'use client'

import React, { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { FolderKanban, ListTodo, Plus, Pencil, Trash2, RefreshCw, Loader2 } from 'lucide-react'
import { ProjectTypeService, type ProjectTypeRow } from '@/lib/services/project-type-service'
import { TaskMasterDataService, type TaskType } from '@/lib/services/tasks/task-master-data-service'
import { useTaskTypesQuery, useInvalidateTaskTypes } from '@/hooks/queries/useTaskTypesQuery'
import { useProjectTypesQuery, useInvalidateProjectTypes } from '@/hooks/queries/useProjectTypesQuery'
import toast from 'react-hot-toast'

const TASK_TYPE_COLOR_PALETTE = [
  '#2563eb', '#10b981', '#7c3aed', '#ea580c', '#0891b2', '#6d28d9', '#dc2626', '#16a34a',
  '#6b7280', '#64748b', '#0ea5e9', '#84cc16', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6',
]

export default function AdminWorkspaceConfigPage() {
  const { currentCompany, companyId, groupId } = useCompany()
  const { user } = useAuthStore()
  const userId = user?.id ?? ''

  const { projectTypeRows, isLoading: loadingProject, refetch: refetchProjectTypes } = useProjectTypesQuery(companyId ?? undefined, groupId)
  const { systemTypes, customTypes: taskTypes, isLoading: loadingTask, refetch: refetchTaskTypes } = useTaskTypesQuery(companyId ?? undefined, groupId)
  const invalidateTaskTypes = useInvalidateTaskTypes()
  const invalidateProjectTypes = useInvalidateProjectTypes()

  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [projectEditId, setProjectEditId] = useState<string | null>(null)
  const [projectForm, setProjectForm] = useState({ code: '', name: '', description: '' })

  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskEditId, setTaskEditId] = useState<string | null>(null)
  const [taskForm, setTaskForm] = useState({ name: '', description: '', order: 0, color: '#6b7280' })

  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const openAddProject = () => {
    setProjectEditId(null)
    setProjectForm({ code: '', name: '', description: '' })
    setProjectDialogOpen(true)
  }

  const openEditProject = (row: ProjectTypeRow) => {
    if (row.source !== 'custom') return
    setProjectEditId(row.id)
    setProjectForm({
      code: row.code,
      name: row.name,
      description: row.description ?? '',
    })
    setProjectDialogOpen(true)
  }

  const saveProject = async () => {
    if (!companyId) return
    if (!projectForm.code.trim() || !projectForm.name.trim()) {
      toast.error('Code and name are required')
      return
    }
    setSaving(true)
    try {
      if (projectEditId) {
        await ProjectTypeService.updateCustomProjectType(
          companyId,
          projectEditId,
          {
            name: projectForm.name.trim(),
            description: projectForm.description.trim() || undefined,
          },
          groupId ?? undefined
        )
        toast.success('Project type updated')
      } else {
        await ProjectTypeService.createCustomProjectType(
          companyId,
          {
            code: projectForm.code.trim(),
            name: projectForm.name.trim(),
            description: projectForm.description.trim() || undefined,
          },
          userId,
          groupId ?? undefined
        )
        toast.success('Project type created')
      }
      setProjectDialogOpen(false)
      invalidateProjectTypes()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save project type')
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteProject = async () => {
    if (!companyId || !deleteProjectId) return
    setSaving(true)
    try {
      await ProjectTypeService.deleteCustomProjectType(companyId, deleteProjectId, groupId ?? undefined)
      toast.success('Project type deactivated')
      setDeleteProjectId(null)
      invalidateProjectTypes()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete')
    } finally {
      setSaving(false)
    }
  }

  const openAddTask = () => {
    setTaskEditId(null)
    setTaskForm({ name: '', description: '', order: taskTypes.length, color: '#6b7280' })
    setTaskDialogOpen(true)
  }

  const openEditTask = (t: TaskType) => {
    if (t.isSystem) return
    setTaskEditId(t.id)
    setTaskForm({
      name: t.name,
      description: t.description ?? '',
      order: t.order ?? 0,
      color: t.color ?? '#6b7280',
    })
    setTaskDialogOpen(true)
  }

  const saveTask = async () => {
    if (!companyId) return
    if (!taskForm.name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      if (taskEditId) {
        await TaskMasterDataService.updateTaskType(
          companyId,
          taskEditId,
          {
            name: taskForm.name.trim(),
            description: taskForm.description.trim() || undefined,
            order: taskForm.order,
            color: taskForm.color || undefined,
          },
          userId,
          groupId ?? undefined
        )
        toast.success('Task type updated')
      } else {
        await TaskMasterDataService.createTaskType(
          companyId,
          {
            companyId,
            name: taskForm.name.trim(),
            description: taskForm.description.trim() || undefined,
            order: taskForm.order,
            color: taskForm.color || undefined,
            isActive: true,
            createdBy: userId,
          },
          userId,
          groupId ?? undefined
        )
        toast.success('Task type created')
      }
      setTaskDialogOpen(false)
      invalidateTaskTypes()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save task type')
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteTask = async () => {
    if (!companyId || !deleteTaskId) return
    setSaving(true)
    try {
      await TaskMasterDataService.deleteTaskType(companyId, deleteTaskId, groupId ?? undefined)
      toast.success('Task type deactivated')
      setDeleteTaskId(null)
      invalidateTaskTypes()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete')
    } finally {
      setSaving(false)
    }
  }

  const toggleProjectTypeActive = async (id: string, isActive: boolean) => {
    if (!companyId) return
    try {
      await ProjectTypeService.updateCustomProjectType(companyId, id, { isActive }, groupId ?? undefined)
      toast.success(isActive ? 'Project type enabled' : 'Project type disabled')
      invalidateProjectTypes()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update')
    }
  }

  const toggleTaskTypeActive = async (taskTypeId: string, isActive: boolean) => {
    if (!companyId) return
    try {
      await TaskMasterDataService.updateTaskType(companyId, taskTypeId, { isActive }, userId, groupId ?? undefined)
      toast.success(isActive ? 'Task type enabled' : 'Task type disabled')
      invalidateTaskTypes()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update')
    }
  }

  if (!currentCompany) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Please select a company to manage project and task types.</p>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="w-full">
        <Tabs defaultValue="project-types" className="w-full">
          <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b border-border rounded-none gap-0">
            <TabsTrigger
              value="project-types"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent px-4 py-2.5 gap-2"
            >
              <FolderKanban className="h-4 w-4" />
              Project Types
            </TabsTrigger>
            <TabsTrigger
              value="task-types"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent px-4 py-2.5 gap-2"
            >
              <ListTodo className="h-4 w-4" />
              Task Types
            </TabsTrigger>
          </TabsList>

          <TabsContent value="project-types" className="mt-4 focus-visible:outline-none">
            <Card className="rounded-xl border border-border/50 shadow-sm">
              <CardHeader className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardDescription>System and custom project types used when creating projects.</CardDescription>
                  <Button onClick={openAddProject} size="sm" className="rounded-lg shrink-0">
                    <Plus className="h-4 w-4 mr-2" /> Add custom type
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[100px]">Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[100px]">Type</TableHead>
                        <TableHead className="w-[80px] text-center">On/Off</TableHead>
                        <TableHead className="w-[120px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingProject ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ) : projectTypeRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                            No project types found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        projectTypeRows.map((row) => (
                          <TableRow key={row.source === 'system' ? row.code : row.id}>
                            <TableCell className="font-mono text-sm">{row.code}</TableCell>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-muted-foreground max-w-xs truncate">
                              {'description' in row ? row.description ?? '—' : '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={row.source === 'system' ? 'secondary' : 'outline'}>
                                {row.source === 'system' ? 'System' : 'Custom'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {row.source === 'custom' ? (
                                <Switch
                                  checked={row.isActive}
                                  onCheckedChange={(checked) => toggleProjectTypeActive(row.id, !!checked)}
                                />
                              ) : (
                                <Switch checked disabled className="opacity-60" />
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.source === 'custom' && (
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEditProject(row)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => setDeleteProjectId(row.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="task-types" className="mt-4 focus-visible:outline-none">
            <Card className="rounded-xl border border-border/50 shadow-sm">
              <CardHeader className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardDescription>System and custom task types used when creating tasks.</CardDescription>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="rounded-lg" onClick={() => refetchTaskTypes()}>
                      <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                    </Button>
                    <Button onClick={openAddTask} size="sm" className="rounded-lg shrink-0">
                      <Plus className="h-4 w-4 mr-2" /> Add task type
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[80px]">Order</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[100px]">Type</TableHead>
                        <TableHead className="w-[80px] text-center">On/Off</TableHead>
                        <TableHead className="w-[120px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingTask ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {systemTypes.map((sys) => (
                            <TableRow key={`system-${sys.name}`}>
                              <TableCell className="text-muted-foreground">{sys.order}</TableCell>
                              <TableCell className="font-medium flex items-center gap-2">
                                <span
                                  className="inline-flex h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: sys.color ?? '#6b7280' }}
                                />
                                {sys.name}
                              </TableCell>
                              <TableCell className="text-muted-foreground max-w-xs">—</TableCell>
                              <TableCell>
                                <Badge variant="secondary">System</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Switch checked disabled className="opacity-60" />
                              </TableCell>
                              <TableCell className="text-right" />
                            </TableRow>
                          ))}
                          {taskTypes.map((t) => (
                            <TableRow key={t.id}>
                              <TableCell className="text-muted-foreground">{t.order}</TableCell>
                              <TableCell className="font-medium flex items-center gap-2">
                                {t.color && (
                                  <span
                                    className="inline-flex h-2.5 w-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: t.color }}
                                  />
                                )}
                                {t.name}
                              </TableCell>
                              <TableCell className="text-muted-foreground max-w-xs truncate">
                                {t.description ?? '—'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">Custom</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Switch
                                  checked={t.isActive}
                                  onCheckedChange={(checked) => toggleTaskTypeActive(t.id, !!checked)}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTask(t)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => setDeleteTaskId(t.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add/Edit Project Type Dialog */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{projectEditId ? 'Edit' : 'Add'} custom project type</DialogTitle>
            <DialogDescription>
              Custom project types are stored per company and appear alongside system types in project creation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="project-code">Code (unique key)</Label>
              <Input
                id="project-code"
                value={projectForm.code}
                onChange={(e) => setProjectForm((p) => ({ ...p, code: e.target.value }))}
                placeholder="e.g. internal_rnd"
                disabled={!!projectEditId}
                className="font-mono"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={projectForm.name}
                onChange={(e) => setProjectForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Internal R&D"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-desc">Description (optional)</Label>
              <Input
                id="project-desc"
                value={projectForm.description}
                onChange={(e) => setProjectForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Short description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveProject} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {projectEditId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Task Type Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{taskEditId ? 'Edit' : 'Add'} task type</DialogTitle>
            <DialogDescription>
              Task types categorize tasks. System types are seeded; you can add custom types for your company.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="task-name">Name</Label>
              <Input
                id="task-name"
                value={taskForm.name}
                onChange={(e) => setTaskForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Development, Review"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-desc">Description (optional)</Label>
              <Input
                id="task-desc"
                value={taskForm.description}
                onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Short description"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-order">Order (display order)</Label>
              <Input
                id="task-order"
                type="number"
                value={taskForm.order}
                onChange={(e) => setTaskForm((p) => ({ ...p, order: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {TASK_TYPE_COLOR_PALETTE.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setTaskForm((p) => ({ ...p, color: hex }))}
                    className={`h-8 w-8 rounded-full border-2 transition-all shrink-0 ${
                      taskForm.color === hex
                        ? 'border-foreground scale-110 ring-2 ring-offset-2 ring-primary'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: hex }}
                    title={hex}
                    aria-label={`Select color ${hex}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">Selected:</span>
                <span
                  className="inline-block h-5 w-8 rounded border border-border"
                  style={{ backgroundColor: taskForm.color }}
                />
                <span className="text-xs font-mono text-muted-foreground">{taskForm.color}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveTask} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {taskEditId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Type Confirmation */}
      <AlertDialog open={!!deleteProjectId} onOpenChange={(open) => !open && setDeleteProjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate project type?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the custom project type. It will no longer appear in dropdowns. Existing projects
              using this type are unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteProject} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Task Type Confirmation */}
      <AlertDialog open={!!deleteTaskId} onOpenChange={(open) => !open && setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate task type?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the task type (soft delete). It will no longer appear in dropdowns. Existing tasks
              using this type are unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTask} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
