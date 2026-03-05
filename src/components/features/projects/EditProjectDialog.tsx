'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Check, LayoutList, Kanban, Calendar, LayoutGrid, BarChart3, GanttChart, Lock } from 'lucide-react'
import { EnhancedProject } from '@/types/project-schema'
import { ProjectService } from '@/lib/services'
import { useCompany } from '@/contexts/CompanyContext'
import toast from 'react-hot-toast'

interface EditProjectDialogProps {
  project: EnhancedProject
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (updatedProject: EnhancedProject) => void
}

interface View {
  id: string
  name: string
  icon: React.ElementType
}

const AVAILABLE_VIEWS: View[] = [
  { id: 'overview', name: 'Overview', icon: LayoutGrid },
  { id: 'list', name: 'List', icon: LayoutList },
  { id: 'board', name: 'Board', icon: Kanban },
  { id: 'timeline', name: 'Timeline', icon: GanttChart },
  { id: 'calendar', name: 'Calendar', icon: Calendar },
  { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
]

export function EditProjectDialog({ project, open, onOpenChange, onUpdate }: EditProjectDialogProps) {
  const { companyId, groupId } = useCompany()
  const [name, setName] = useState(project.name)
  const [projectCode, setProjectCode] = useState(project.projectCode || '')
  const [description, setDescription] = useState(project.description)
  const [status, setStatus] = useState(project.status)
  const [priority, setPriority] = useState(project.priority)
  const [selectedViews, setSelectedViews] = useState<string[]>(
    Array.isArray(project.views) && project.views.length > 0
      ? project.views
      : ['overview', 'list', 'board', 'timeline', 'calendar', 'dashboard']
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName(project.name)
      setProjectCode(project.projectCode || '')
      setDescription(project.description)
      setStatus(project.status)
      setPriority(project.priority)
      setSelectedViews(
        Array.isArray(project.views) && project.views.length > 0
          ? project.views
          : ['overview', 'list', 'board', 'timeline', 'calendar', 'dashboard']
      )
    }
  }, [open, project])

  const toggleView = (viewId: string) => {
    if (viewId === 'list') return // List is required

    setSelectedViews(prev =>
      prev.includes(viewId)
        ? prev.filter(id => id !== viewId)
        : [...prev, viewId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!companyId) {
      toast.error('No company selected')
      return
    }

    if (!name.trim()) {
      toast.error('Project name is required')
      return
    }

    setIsSubmitting(true)
    try {
      await ProjectService.updateProject(
        companyId,
        project.id,
        {
          name,
          projectCode,
          description,
          status,
          priority,
          views: selectedViews,
        },
        groupId ? { groupId } : undefined
      )

      const updatedProject = {
        ...project,
        name,
        projectCode,
        description,
        status,
        priority,
        views: selectedViews,
      }

      onUpdate(updatedProject)
      toast.success('Project updated successfully')
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating project:', error)
      toast.error('Failed to update project')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update project details and configure views
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter project name"
                  required
                />
              </div>
              <div className="col-span-1 space-y-2">
                <Label htmlFor="projectCode" className="flex items-center gap-2">
                  Unique Key
                  <Lock className="w-3 h-3 text-muted-foreground" />
                </Label>
                <Input
                  id="projectCode"
                  value={projectCode}
                  disabled={true}
                  placeholder="EX: D1"
                  className="font-mono uppercase bg-muted cursor-not-allowed"
                  title="Project Key cannot be changed after creation to maintain task ID integrity"
                />
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Locked to protect task IDs
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter project description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Views Configuration */}
          <div className="space-y-3">
            <Label>Project Views</Label>
            <div className="grid grid-cols-2 gap-3">
              {AVAILABLE_VIEWS.map((view) => {
                const Icon = view.icon
                const isSelected = selectedViews.includes(view.id)
                const isRequired = view.id === 'list'
                return (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => toggleView(view.id)}
                    disabled={isRequired}
                    className={`flex items-start space-x-3 p-4 border-2 rounded-lg text-left transition-all ${isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                      } ${isRequired ? 'opacity-100 cursor-not-allowed' : ''}`}
                  >
                    <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-gray-300'
                      }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <Icon className="w-5 h-5 text-gray-600" />
                        <span className="font-medium text-gray-900">
                          {view.name}
                          {isRequired && (
                            <span className="ml-1 text-xs text-muted-foreground">(required)</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

