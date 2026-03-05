'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  ArrowLeft,
  Check,
  LayoutList,
  Kanban,
  Calendar,
  LayoutGrid,
  BarChart3,
  GanttChart,
  StickyNote,
  Users,
  Lock,
  ChevronDown
} from 'lucide-react'
import { ProjectService, WorkspaceService } from '@/lib/services'
import { ProjectTaskTemplateService } from '@/lib/services/projects/project-task-template-service'
import { PermissionService } from '@/lib/services/permission-service'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import type { Workspace } from '@/types/workspace-schema'
import { ProjectType } from '@/types/project-task-template'
import toast from 'react-hot-toast'
import { CustomTemplateWizard } from './CustomTemplateWizard'
import { Badge } from '@/components/ui/badge'

interface SimpleProjectCreationProps {
  onProjectCreated?: (projectId: string) => void
  onCancel?: () => void
  initialWorkspaceId?: string
}

interface View {
  id: string
  name: string
  description: string
  icon: React.ElementType
  required?: boolean
  category: 'recommended' | 'popular'
}

const VIEWS: View[] = [
  {
    id: 'overview',
    name: 'Overview',
    description: 'Align on project info and resources',
    icon: LayoutGrid,
    category: 'recommended'
  },
  {
    id: 'list',
    name: 'List',
    description: 'Organize tasks in a powerful table',
    icon: LayoutList,
    required: true,
    category: 'recommended'
  },
  {
    id: 'board',
    name: 'Board',
    description: 'Track work in a Kanban view',
    icon: Kanban,
    category: 'recommended'
  },
  {
    id: 'timeline',
    name: 'Timeline',
    description: 'Schedule work over time',
    icon: GanttChart,
    category: 'recommended'
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Monitor project metrics and insights',
    icon: BarChart3,
    category: 'recommended'
  },
  {
    id: 'gantt',
    name: 'Gantt',
    description: 'Track dependencies and baselines',
    icon: GanttChart,
    category: 'popular'
  },
  {
    id: 'calendar',
    name: 'Calendar',
    description: 'Plan weekly or monthly work',
    icon: Calendar,
    category: 'recommended'
  },
  {
    id: 'note',
    name: 'Note',
    description: 'Write meeting notes and more',
    icon: StickyNote,
    category: 'popular'
  },
  {
    id: 'workload',
    name: 'Workload',
    description: "Manage your team's time and capacity",
    icon: Users,
    category: 'popular'
  }
]

export function SimpleProjectCreation({ onProjectCreated, onCancel, initialWorkspaceId }: SimpleProjectCreationProps) {
  const router = useRouter()
  const { companyId, groupId, currentCompany, currentCompanyUser } = useCompany()
  const { user: currentUser } = useAuthStore()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<1 | 2>(1)
  const [projectName, setProjectName] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [visibility, setVisibility] = useState<'standard' | 'private' | 'secret'>('standard')
  const [selectedViews, setSelectedViews] = useState<string[]>(['overview', 'list', 'board', 'timeline', 'calendar', 'dashboard'])
  const [projectType, setProjectType] = useState<ProjectType | ''>('')
  const [projectTemplateId, setProjectTemplateId] = useState<string>('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showCustomTemplateWizard, setShowCustomTemplateWizard] = useState(false)

  // Load workspaces (use groupId + companyId for multi-org so we hit enterprise path)
  useEffect(() => {
    const loadWorkspaces = async () => {
      if (!companyId) return
      try {
        setLoadingWorkspaces(true)
        const workspacesData = await WorkspaceService.getWorkspaces(
          groupId ?? companyId,
          companyId,
          { status: 'active' }
        )
        setWorkspaces(workspacesData)

        // Pre-select if initialWorkspaceId is provided
        if (initialWorkspaceId) {
          setWorkspaceId(initialWorkspaceId)
        }
        // Auto-select if only one workspace and no initialWorkspaceId
        else if (workspacesData.length === 1 && workspacesData[0]) {
          setWorkspaceId(workspacesData[0].id)
        }
      } catch (err) {
        console.error('Failed to load workspaces', err)
      } finally {
        setLoadingWorkspaces(false)
      }
    }
    loadWorkspaces()
  }, [companyId, groupId, initialWorkspaceId])

  // Load templates based on project type
  useEffect(() => {
    const loadTemplates = async () => {
      if (!companyId) return
      try {
        const filters: any = { isActive: true }
        if (projectType) {
          filters.projectType = projectType
        }
        const list = await ProjectTaskTemplateService.getTemplates(companyId, filters, groupId ?? undefined)
        setTemplates(list)
      } catch (err) {
        console.error('Failed to load templates', err)
      }
    }
    loadTemplates()
  }, [companyId, groupId, projectType])

  const handleContinue = () => {
    if (!projectName.trim()) {
      setError('Project name is required')
      return
    }
    setError('')
    setStep(2)
  }

  const handleBack = () => {
    if (step === 2) {
      setStep(1)
    } else if (onCancel) {
      onCancel()
    }
  }

  const toggleView = (viewId: string) => {
    const view = VIEWS.find(v => v.id === viewId)
    if (view?.required) return // Can't deselect required views

    setSelectedViews(prev =>
      prev.includes(viewId)
        ? prev.filter(id => id !== viewId)
        : [...prev, viewId]
    )
  }

  const handleCreateProject = async () => {
    if (!companyId) {
      toast.error('No company selected')
      return
    }

    // Anyone can create projects - no permission check needed

    setIsSubmitting(true)
    try {
      const projectId = await ProjectService.createProject(
        companyId,
        {
          workspaceId: workspaceId,
          name: projectName,
          description: '',
          status: 'active',
          priority: 'medium',
          manager: currentUser?.id || null,
          createdBy: currentUser?.id || '',
          team: [],
          startDate: new Date().toISOString().split('T')[0] || '',
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '',
          progress: 0,
          tags: [],
          views: selectedViews,
          equipmentType: 'other',
          manufacturingPhase: 'Design & Engineering',
          qualityStandards: [],
          complianceRequirements: [],
          templateId: selectedTemplateId || null,
          projectType: projectType || undefined,
          projectTemplateId: projectTemplateId || selectedTemplateId || null,
          projectCode: '',
          department: '',
          client: null,
          location: '',
          totalTasks: 0,
          completedTasks: 0,
          overdueTasks: 0,
          teamUtilization: 0,
          qualityScore: 0,
          safetyScore: 0,
          riskLevel: 'low',
          issuesCount: 0,
          resolvedIssuesCount: 0,
          lastActivityDate: new Date().toISOString(),
          requiresApproval: false,
          approvedBy: null,
          approvedAt: null,
          approvalNotes: null,
          visibility: visibility
        },
        groupId ? { groupId } : undefined
      )

      // Apply template if selected (use projectTemplateId or selectedTemplateId)
      const templateToApply = projectTemplateId || selectedTemplateId
      if (templateToApply) {
        try {
          await ProjectTaskTemplateService.applyTemplateToProject(
            companyId,
            projectId,
            new Date().toISOString().split('T')[0] || '',
            templateToApply,
            groupId ?? undefined
          )
        } catch (err) {
          console.error('Failed to apply template:', err)
        }
      }

      toast.success(`Project "${projectName}" created successfully!`)

      // Invalidate queries to update sidebar and other lists
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] })

      // Dispatch event for other components that might listen (legacy/external)
      window.dispatchEvent(new CustomEvent('project-created', { detail: { projectId } }))

      if (onProjectCreated) {
        onProjectCreated(projectId)
      } else {
        router.push(`/projects/${projectId}`)
      }
    } catch (error) {
      console.error('Error creating project:', error)
      toast.error('Failed to create project. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const recommendedViews = VIEWS.filter(v => v.category === 'recommended')

  return (
    <div className="w-full">
      {step === 1 ? (
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">New project</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Project Name */}
                <div className="space-y-2">
                  <Label htmlFor="projectName">Project name</Label>
                  <Input
                    id="projectName"
                    value={projectName}
                    onChange={(e) => {
                      setProjectName(e.target.value)
                      setError('')
                    }}
                    placeholder="Enter project name"
                    className={error ? 'border-red-500' : ''}
                    autoFocus
                  />
                  {error && <p className="text-sm text-red-500">{error}</p>}
                </div>

                {/* Workspace */}
                <div className="space-y-2">
                  <Label htmlFor="workspace">Workspace</Label>
                  <Select
                    value={workspaceId}
                    onValueChange={setWorkspaceId}
                    disabled={loadingWorkspaces}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingWorkspaces ? "Loading workspaces..." : "Select workspace..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaces.map((workspace) => (
                        <SelectItem key={workspace.id} value={workspace.id}>
                          {workspace.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {workspaces.length === 0 && !loadingWorkspaces && (
                    <p className="text-sm text-muted-foreground">
                      No workspaces available. <a href="/workspaces/create" className="text-primary hover:underline">Create one first</a>.
                    </p>
                  )}
                </div>

                {/* Project Type */}
                <div className="space-y-2">
                  <Label htmlFor="projectType">Project Type (Optional)</Label>
                  <Select
                    value={projectType || ''}
                    onValueChange={(value) => {
                      setProjectType(value as ProjectType)
                      setProjectTemplateId('')
                      setSelectedTemplateId('')
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type (optional)..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rft">Request from Teams (RFT)</SelectItem>
                      <SelectItem value="reports">Reports</SelectItem>
                      <SelectItem value="compliance">Compliance (Statutory)</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Project Template */}
                {projectType && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="projectTemplate">Project Template (Optional)</Label>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-primary hover:underline"
                        onClick={() => setShowCustomTemplateWizard(true)}
                      >
                        + Create Custom Template
                      </Button>
                    </div>
                    <Select
                      value={projectTemplateId || selectedTemplateId || ''}
                      onValueChange={(value) => {
                        setProjectTemplateId(value)
                        setSelectedTemplateId(value)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select template (optional)..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            <div className="flex items-center gap-2">
                              {template.name}
                              {template.isSystemTemplate && (
                                <Badge variant="secondary" className="px-1 py-0 h-4 text-[10px] font-normal">Predefined</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                        {templates.length === 0 && (
                          <SelectItem value="none" disabled>No templates found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Privacy */}
                <div className="space-y-2">
                  <Label htmlFor="privacy">Privacy</Label>
                  <Select
                    value={visibility === 'standard' ? 'shared' : visibility === 'private' ? 'private' : 'private-to-me'}
                    onValueChange={(value) => {
                      if (value === 'shared') setVisibility('standard')
                      else if (value === 'private') setVisibility('private')
                      else setVisibility('secret')
                    }}
                  >
                    <SelectTrigger className="flex items-center gap-2 [&>span:first-child]:flex [&>span:first-child]:items-center [&>span:first-child]:gap-2 [&>span:first-child>div]:items-center [&>span:first-child_p]:hidden">
                      <SelectValue asChild>
                        <span className="flex items-center gap-2 min-w-0 flex-1">
                          {visibility === 'standard' ? (
                            <>
                              <Users className="h-4 w-4 shrink-0" />
                              <span className="truncate">Shared with team</span>
                            </>
                          ) : visibility === 'private' ? (
                            <>
                              <Lock className="h-4 w-4 shrink-0" />
                              <span className="truncate">Private to members</span>
                            </>
                          ) : (
                            <>
                              <Lock className="h-4 w-4 shrink-0" />
                              <span className="truncate">Private to me</span>
                            </>
                          )}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="min-w-[300px]">
                      <SelectItem value="shared" className="py-3 pl-10">
                        <div className="flex items-start gap-3 w-full">
                          <Users className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">Shared with team</div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Only this team and invited members can find and access this project.
                            </p>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="private" className="py-3 pl-10">
                        <div className="flex items-start gap-3 w-full">
                          <Lock className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">Private to members</div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Only invited members can find and access this project.
                            </p>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="private-to-me" className="py-3 pl-10">
                        <div className="flex items-start gap-3 w-full">
                          <Lock className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">Private to me</div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Only you can find and access this project.
                            </p>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleBack}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleContinue}
                    disabled={!projectName.trim() || !workspaceId}
                  >
                    Continue
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview Placeholder */}
            <div className="hidden lg:block">
              <Card className="h-full">
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{projectName || 'Project name'}</CardTitle>
                    <div className="flex space-x-2">
                      <div className="h-8 bg-gray-200 rounded w-16"></div>
                      <div className="h-8 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="space-y-0">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div
                        key={i}
                        className="flex items-center space-x-4 px-6 py-4 border-b hover:bg-gray-50"
                      >
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300 bg-white"></div>
                        <div className={`flex-1 h-4 rounded ${i <= 3 ? 'bg-gray-200' : 'bg-gray-100'}`}></div>
                        <div className="w-8 h-8 rounded-full bg-gray-300"></div>
                        <div className={`h-6 w-16 rounded ${i === 1 ? 'bg-red-200' : i <= 3 ? 'bg-green-200' : 'bg-gray-200'
                          }`}></div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: View Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Choose views for your project</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Recommended Views */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3">
                    {recommendedViews.map((view) => {
                      const Icon = view.icon
                      const isSelected = selectedViews.includes(view.id)
                      return (
                        <button
                          key={view.id}
                          onClick={() => toggleView(view.id)}
                          className={`flex items-start space-x-3 p-4 border-2 rounded-lg text-left transition-all ${isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-gray-300'
                            } ${view.required ? 'opacity-100' : ''}`}
                          disabled={view.required}
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
                                {view.required && (
                                  <span className="ml-1 text-xs text-muted-foreground">(required)</span>
                                )}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{view.description}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Optional: Template Selection */}
                {templates.length > 0 && (
                  <div className="space-y-3 pt-4 border-t">
                    <Label htmlFor="template">Project template (optional)</Label>
                    <Select value={selectedTemplateId || '__none__'} onValueChange={(value) => setSelectedTemplateId(value === '__none__' ? '' : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="No template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No template</SelectItem>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between items-center pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleCreateProject}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      'Create project'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Right: Preview */}
            <div className="hidden lg:block">
              <Card className="sticky top-8">
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{projectName || 'TEst'}</CardTitle>
                    <div className="flex space-x-2">
                      {selectedViews.slice(0, 5).map((viewId) => {
                        const view = VIEWS.find(v => v.id === viewId)
                        return (
                          <div
                            key={viewId}
                            className={`px-3 py-1 text-xs font-medium rounded ${viewId === 'list'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-gray-100 text-gray-700'
                              }`}
                          >
                            {view?.name}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Preview of list view */}
                  <div className="space-y-0">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <div
                        key={i}
                        className="flex items-center space-x-4 px-6 py-4 border-b hover:bg-gray-50"
                      >
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300 bg-white"></div>
                        <div className={`flex-1 h-4 rounded ${i <= 4 ? 'bg-gray-200' : 'bg-green-100'}`}></div>
                        <div className="w-8 h-8 rounded-full bg-gray-300"></div>
                        <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                        <div className={`h-6 w-16 rounded ${i === 1 ? 'bg-red-200' : i === 4 ? 'bg-red-100' : i <= 3 ? 'bg-green-200' : 'bg-purple-200'
                          }`}></div>
                        {i <= 3 && <div className="h-6 w-20 rounded bg-purple-200"></div>}
                        {[1, 4].includes(i) && <div className="h-6 w-16 rounded bg-orange-200"></div>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Custom Template Dialog - Now outside the step condition */}
      {showCustomTemplateWizard && (
        <CustomTemplateWizard
          companyId={companyId!}
          groupId={groupId ?? undefined}
          initialProjectType={projectType || undefined}
          onClose={() => setShowCustomTemplateWizard(false)}
          onTemplateCreated={(templateId) => {
            setProjectTemplateId(templateId)
            setSelectedTemplateId(templateId)
            setShowCustomTemplateWizard(false)
          }}
        />
      )}
    </div>
  )
}

