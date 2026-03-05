'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  PRDAlignedProject,
  Position,
  WorkflowTemplate,
  ComplianceRequirement,
  ApprovalMatrix,
  RoutingRule
} from '@/types/prd-aligned-schema'
import { EnhancedProject } from '@/types/project-schema'
import { ProjectService, WorkspaceService } from '@/lib/services'
import { ProjectTaskTemplateService } from '@/lib/services/projects/project-task-template-service'
import { PermissionService } from '@/lib/services/permission-service'
import { generateProjectCode } from '@/lib/utils/project-utils'
import { useCompany } from '@/contexts/CompanyContext'
import type { Workspace } from '@/types/workspace-schema'
import { Users, Lock, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'
import { useProjectMutations } from '@/hooks/queries/useProjectQueries'

interface ProjectCreationFormProps {
  onProjectCreated?: (project: EnhancedProject) => void
  onCancel?: () => void
  currentUser: any
  positions: Position[]
  workflowTemplates: WorkflowTemplate[]
  complianceRequirements: ComplianceRequirement[]
}

interface FormData {
  name: string
  description: string
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'

  // Workspace (Level 1)
  workspaceId: string

  // Position-based assignment (FR2, FR3)
  assignedPositionId: string
  assignedUserId?: string
  matrixPositions: string[]

  // Organizational context
  department: string
  businessUnit: string
  costCenter: string

  // Timeline
  startDate: string
  endDate: string
  estimatedDuration: number

  // Financial
  costCategory: string

  // Workflow integration (FR4, FR5)
  workflowTemplateId?: string

  // Compliance tracking (FR9, FR13)
  complianceRequirements: string[]

  // Approval workflow (FR7)
  requiresApproval: boolean
  approvalMatrixId?: string

  // Definition of Done (FR8)
  definitionOfDone: string[]

  // Metadata
  tags: string[]
  projectCode: string
  client?: string
  location: string

  // Manufacturing-specific fields
  equipmentType: 'Industrial Robots' | 'Automation Systems' | 'Manufacturing Equipment' | 'Quality Control Systems' | 'Smart Sensors' | 'other'
  manufacturingPhase: 'Design & Engineering' | 'Prototyping' | 'Production Planning' | 'Manufacturing' | 'Quality Testing' | 'Packaging & Delivery'
  qualityStandards: string[]

  // Visibility settings
  visibility?: 'standard' | 'private' | 'secret'
}

const COMPLIANCE_REGULATIONS = [
  'SOX', 'GDPR', 'HIPAA', 'PCI-DSS', 'ISO 27001', 'SOC 2', 'FDA', 'OSHA', 'CE Marking', 'RoHS'
]

const INDUSTRY_CATEGORIES = [
  'Healthcare', 'Financial Services', 'Manufacturing', 'Technology', 'Government', 'Education', 'Retail', 'Energy'
]

const COST_CATEGORIES = [
  'Capital Expenditure', 'Operating Expense', 'Research & Development', 'Compliance', 'Training', 'Infrastructure'
]

export function ProjectCreationForm({
  onProjectCreated,
  onCancel,
  currentUser,
  positions,
  workflowTemplates,
  complianceRequirements
}: ProjectCreationFormProps) {
  const { companyId, groupId, currentCompany, currentCompanyUser } = useCompany()
  const [tagInput, setTagInput] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null)
  const [routingPreview, setRoutingPreview] = useState<any>(null)
  const [projectTaskTemplates, setProjectTaskTemplates] = useState<any[]>([])
  const [selectedProjectTaskTemplateId, setSelectedProjectTaskTemplateId] = useState<string>('')
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false)

  const initialValues: FormData = {
    name: '',
    description: '',
    status: 'planning',
    priority: 'medium',
    workspaceId: '',
    assignedPositionId: '',
    assignedUserId: '',
    matrixPositions: [],
    department: currentUser.orgUnitName || '',
    businessUnit: '',
    costCenter: '',
    startDate: '',
    endDate: '',
    estimatedDuration: 0,
    costCategory: 'Operating Expense',
    workflowTemplateId: '',
    complianceRequirements: [],
    requiresApproval: true,
    approvalMatrixId: '',
    definitionOfDone: [],
    tags: [],
    projectCode: '',
    client: '',
    location: '',
    equipmentType: 'other',
    manufacturingPhase: 'Design & Engineering',
    qualityStandards: [],
    visibility: 'standard'
  }

  const validateForm = (values: FormData): Record<string, string> => {
    const errors: Record<string, string> = {}

    if (!values.name.trim()) {
      errors.name = 'Project name is required'
    }

    if (!values.description.trim()) {
      errors.description = 'Project description is required'
    }

    if (!values.workspaceId) {
      errors.workspaceId = 'Workspace is required'
    }

    if (!values.assignedPositionId) {
      errors.assignedPositionId = 'Primary position assignment is required'
    }

    if (!values.department.trim()) {
      errors.department = 'Department is required'
    }

    if (!values.startDate) {
      errors.startDate = 'Start date is required'
    }

    if (!values.endDate) {
      errors.endDate = 'End date is required'
    }

    if (values.startDate && values.endDate && values.startDate >= values.endDate) {
      errors.endDate = 'End date must be after start date'
    }


    if (!values.projectCode.trim()) {
      errors.projectCode = 'Project code is required'
    }

    return errors
  }

  const [values, setValues] = useState<FormData>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const setValue = useCallback((field: keyof FormData, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }, [errors])

  const setFieldError = (field: string, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }))
  }

  // Load workspaces on mount (use groupId + companyId for multi-org so we hit enterprise path)
  useEffect(() => {
    const loadWorkspaces = async () => {
      if (!companyId) {
        console.warn('[ProjectCreationForm] No companyId provided, skipping workspace load');
        return;
      }

      try {
        setLoadingWorkspaces(true)
        console.log('[ProjectCreationForm] Loading workspaces for company:', companyId);
        const workspacesData = await WorkspaceService.getWorkspaces(
          groupId ?? companyId,
          companyId,
          { status: 'active' }
        )
        setWorkspaces(workspacesData)

        // Set default workspace if only one exists
        if (workspacesData.length === 1 && workspacesData[0]) {
          setValue('workspaceId', workspacesData[0].id)
        }
      } catch (error) {
        console.error('Error loading workspaces:', error)
      } finally {
        setLoadingWorkspaces(false)
      }
    }

    loadWorkspaces()
  }, [companyId, groupId, setValue])

  const { createProject } = useProjectMutations(companyId || undefined, groupId ?? undefined)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    const validationErrors = validateForm(values)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    try {
      if (!companyId) {
        throw new Error('No company selected')
      }

      const projectId = await createProject.mutateAsync({
        workspaceId: values.workspaceId,
        name: values.name,
        description: values.description,
        status: values.status,
        priority: values.priority,
        manager: values.assignedUserId || currentUser.id,
        team: values.assignedUserId ? [values.assignedUserId] : [],
        startDate: values.startDate,
        endDate: values.endDate,
        progress: 0,
        tags: values.tags,
        equipmentType: values.equipmentType || 'other',
        manufacturingPhase: values.manufacturingPhase || 'Design & Engineering',
        qualityStandards: values.qualityStandards || [],
        complianceRequirements: values.complianceRequirements,
        templateId: values.workflowTemplateId || null,
        projectCode: values.projectCode,
        department: values.department,
        client: values.client || null,
        location: values.location,
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
        requiresApproval: values.requiresApproval,
        approvedBy: values.requiresApproval ? null : currentUser.id,
        approvedAt: values.requiresApproval ? null : new Date().toISOString(),
        approvalNotes: values.requiresApproval ? null : 'Auto-approved',
        visibility: values.visibility || 'standard',
        createdBy: currentUser.id
      })

      if (selectedProjectTaskTemplateId) {
        try {
          await ProjectTaskTemplateService.applyTemplateToProject(
            companyId,
            projectId,
            values.startDate,
            selectedProjectTaskTemplateId,
            groupId ?? undefined
          )
        } catch (err) {
          console.error('Failed to apply project task template:', err)
        }
      }

      if (onProjectCreated) {
        const createdProject = await ProjectService.getProject(companyId, projectId)
        onProjectCreated(createdProject as any)
      }
    } catch (error) {
      console.error('Error creating project:', error)
      setFieldError('submit', 'Failed to create project. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Load available project task templates
  useEffect(() => {
    const loadTemplates = async () => {
      if (!companyId) return
      try {
        const list = await ProjectTaskTemplateService.getTemplates(companyId, { isActive: true }, groupId ?? undefined)
        setProjectTaskTemplates(list)
      } catch (err) {
        console.error('Failed to load project task templates', err)
      }
    }
    loadTemplates()
  }, [companyId])

  // Generate project code when name changes
  useEffect(() => {
    if (values.name) {
      const clean = values.name.replace(/[^a-zA-Z0-9 ]/g, '').toUpperCase()
      const words = clean.split(' ').filter(w => w.length > 0)

      let code = 'PRJ'
      if (words.length === 1) {
        const w = words[0]!
        code = w.length < 3 ? w : w.substring(0, 3)
      } else if (words.length >= 2) {
        code = words.map(w => w[0]).slice(0, 4).join('')
      }
      setValue('projectCode', code)
    }
  }, [values.name, setValue])

  // Calculate estimated duration when dates change
  useEffect(() => {
    if (values.startDate && values.endDate) {
      const start = new Date(values.startDate)
      const end = new Date(values.endDate)
      const diffTime = Math.abs(end.getTime() - start.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      setValue('estimatedDuration', diffDays)
    }
  }, [values.startDate, values.endDate, setValue])

  const handleTagAdd = () => {
    if (tagInput.trim() && !values.tags.includes(tagInput.trim())) {
      setValue('tags', [...values.tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleTagRemove = (tagToRemove: string) => {
    setValue('tags', values.tags.filter(tag => tag !== tagToRemove))
  }

  const handleComplianceToggle = (requirement: string) => {
    setValue('complianceRequirements', values.complianceRequirements.includes(requirement)
      ? values.complianceRequirements.filter(r => r !== requirement)
      : [...values.complianceRequirements, requirement]
    )
  }

  const handleTemplateSelect = (templateId: string) => {
    const template = workflowTemplates.find(t => t.id === templateId)
    setSelectedTemplate(template || null)

    if (template) {
      setValue('workflowTemplateId', template.id)
      setValue('complianceRequirements', template.complianceRequirements.map(cr => cr.id))
      setValue('definitionOfDone', template.steps.flatMap(step => step.definitionOfDone.map(item => item.text)))
    }
  }

  const handleMatrixPositionToggle = (positionId: string) => {
    setValue('matrixPositions', values.matrixPositions.includes(positionId)
      ? values.matrixPositions.filter(id => id !== positionId)
      : [...values.matrixPositions, positionId]
    )
  }

  const previewRouting = () => {
    if (values.assignedPositionId) {
      const position = positions.find(p => p.id === values.assignedPositionId)
      setRoutingPreview({
        primaryPosition: position,
        reasoning: `Project assigned to ${position?.title} based on department alignment and skill requirements`,
        confidence: 0.95
      })
    }
  }

  return (
    <div className="mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Project</CardTitle>
          <CardDescription>
            Create a new project using AI-Powered Organizational Hierarchy Platform with position-based architecture, intelligent routing, and compliance automation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Basic Information</h3>

              <div className="space-y-2">
                <Label htmlFor="workspaceId">Workspace *</Label>
                <Select
                  value={values.workspaceId}
                  onValueChange={(value) => setValue('workspaceId', value)}
                  disabled={loadingWorkspaces}
                >
                  <SelectTrigger className={errors.workspaceId ? 'border-red-500' : ''}>
                    <SelectValue placeholder={loadingWorkspaces ? "Loading workspaces..." : "Select workspace..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((workspace) => (
                      <SelectItem key={workspace.id} value={workspace.id}>
                        {workspace.name} ({workspace.teamName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.workspaceId && <p className="text-sm text-red-500">{errors.workspaceId}</p>}
                {workspaces.length === 0 && !loadingWorkspaces && (
                  <p className="text-sm text-muted-foreground">
                    No workspaces available. <a href="/workspaces/create" className="text-primary hover:underline">Create one first</a>.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    value={values.name}
                    onChange={(e) => setValue('name', e.target.value)}
                    placeholder="Enter project name"
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="projectCode" className="flex items-center gap-2">
                    Project Code *
                    <Badge variant="secondary" className="px-1 py-0 h-4 text-[10px] font-normal">Auto-generated</Badge>
                  </Label>
                  <Input
                    id="projectCode"
                    value={values.projectCode}
                    readOnly={true}
                    placeholder="Auto-generated"
                    className={`font-mono uppercase bg-muted/30 cursor-not-allowed ${errors.projectCode ? 'border-red-500' : ''}`}
                    title="Automatically generated from project name"
                  />
                  {errors.projectCode && <p className="text-sm text-red-500">{errors.projectCode}</p>}
                  <p className="text-xs text-muted-foreground">
                    Generated automatically to ensure system consistency
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={values.description}
                  onChange={(e) => setValue('description', e.target.value)}
                  placeholder="Describe the project objectives and scope"
                  rows={4}
                  className={errors.description ? 'border-red-500' : ''}
                />
                {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={values.status}
                    onValueChange={(value) => setValue('status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status..." />
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
                  <Select
                    value={values.priority}
                    onValueChange={(value) => setValue('priority', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority..." />
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

              {/* Privacy */}
              <div className="space-y-2">
                <Label htmlFor="privacy">Privacy</Label>
                <Select
                  value={values.visibility === 'standard' || !values.visibility ? 'shared' : values.visibility === 'private' ? 'private' : 'private-to-me'}
                  onValueChange={(value) => {
                    if (value === 'shared') setValue('visibility', 'standard')
                    else if (value === 'private') setValue('visibility', 'private')
                    else setValue('visibility', 'secret')
                  }}
                >
                  <SelectTrigger className="flex items-center gap-2 [&>span:first-child]:flex [&>span:first-child]:items-center [&>span:first-child]:gap-2 [&>span:first-child>div]:items-center [&>span:first-child_p]:hidden">
                    <SelectValue asChild>
                      <span className="flex items-center gap-2 min-w-0 flex-1">
                        {values.visibility === 'standard' || !values.visibility ? (
                          <>
                            <Users className="h-4 w-4 shrink-0" />
                            <span className="truncate">Shared with team</span>
                          </>
                        ) : values.visibility === 'private' ? (
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
            </div>

            {/* Position-Based Assignment (FR2, FR3) */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Position-Based Assignment</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="assignedPositionId">Primary Position *</Label>
                  <Select
                    value={values.assignedPositionId}
                    onValueChange={(value) => {
                      setValue('assignedPositionId', value)
                      previewRouting()
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select primary position..." />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.map(position => (
                        <SelectItem key={position.id} value={position.id}>
                          {position.title} - {position.department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.assignedPositionId && <p className="text-sm text-red-500">{errors.assignedPositionId}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignedUserId">Specific Person (Optional)</Label>
                  <Select
                    value={values.assignedUserId}
                    onValueChange={(value) => setValue('assignedUserId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Auto-assign based on position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-assign based on position</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Matrix Positions (FR19) */}
              <div className="space-y-2">
                <Label>Matrix Positions (Dotted-line reporting)</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-4">
                  {positions.map(position => (
                    <label key={position.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={values.matrixPositions.includes(position.id)}
                        onChange={(e) => handleMatrixPositionToggle(position.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{position.title} ({position.department})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Routing Preview */}
              {routingPreview && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <h4 className="font-semibold text-blue-900 mb-2">Routing Preview</h4>
                  <p className="text-sm text-blue-800">
                    <strong>Primary Position:</strong> {routingPreview.primaryPosition?.title}
                  </p>
                  <p className="text-sm text-blue-800">
                    <strong>Reasoning:</strong> {routingPreview.reasoning}
                  </p>
                  <p className="text-sm text-blue-800">
                    <strong>Confidence:</strong> {(routingPreview.confidence * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>

            {/* Organizational Context */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Organizational Context</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <Input
                    id="department"
                    value={values.department}
                    onChange={(e) => setValue('department', e.target.value)}
                    placeholder="Enter department"
                    className={errors.department ? 'border-red-500' : ''}
                  />
                  {errors.department && <p className="text-sm text-red-500">{errors.department}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessUnit">Business Unit</Label>
                  <Input
                    id="businessUnit"
                    value={values.businessUnit}
                    onChange={(e) => setValue('businessUnit', e.target.value)}
                    placeholder="Enter business unit"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="costCenter">Cost Center</Label>
                  <Input
                    id="costCenter"
                    value={values.costCenter}
                    onChange={(e) => setValue('costCenter', e.target.value)}
                    placeholder="Enter cost center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="costCategory">Cost Category</Label>
                  <Select
                    value={values.costCategory}
                    onValueChange={(value) => setValue('costCategory', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select cost category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {COST_CATEGORIES.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="equipmentType">Equipment Type</Label>
                  <Select
                    value={values.equipmentType}
                    onValueChange={(value) => setValue('equipmentType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select equipment type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Industrial Robots">Industrial Robots</SelectItem>
                      <SelectItem value="Automation Systems">Automation Systems</SelectItem>
                      <SelectItem value="Manufacturing Equipment">Manufacturing Equipment</SelectItem>
                      <SelectItem value="Quality Control Systems">Quality Control Systems</SelectItem>
                      <SelectItem value="Smart Sensors">Smart Sensors</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manufacturingPhase">Manufacturing Phase</Label>
                  <Select
                    value={values.manufacturingPhase}
                    onValueChange={(value) => setValue('manufacturingPhase', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manufacturing phase..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Design & Engineering">Design & Engineering</SelectItem>
                      <SelectItem value="Prototyping">Prototyping</SelectItem>
                      <SelectItem value="Production Planning">Production Planning</SelectItem>
                      <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="Quality Testing">Quality Testing</SelectItem>
                      <SelectItem value="Packaging & Delivery">Packaging & Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    value={values.location}
                    onChange={(e) => setValue('location', e.target.value)}
                    placeholder="Enter location"
                    className={errors.location ? 'border-red-500' : ''}
                  />
                  {errors.location && <p className="text-sm text-red-500">{errors.location}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qualityStandards">Quality Standards</Label>
                  <Input
                    id="qualityStandards"
                    value={values.qualityStandards.join(', ')}
                    onChange={(e) => setValue('qualityStandards', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                    placeholder="ISO 9001, ISO 14001, etc."
                  />
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Timeline</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={values.startDate}
                    onChange={(e) => setValue('startDate', e.target.value)}
                    className={errors.startDate ? 'border-red-500' : ''}
                  />
                  {errors.startDate && <p className="text-sm text-red-500">{errors.startDate}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={values.endDate}
                    onChange={(e) => setValue('endDate', e.target.value)}
                    className={errors.endDate ? 'border-red-500' : ''}
                  />
                  {errors.endDate && <p className="text-sm text-red-500">{errors.endDate}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimatedDuration">Estimated Duration (Days)</Label>
                  <Input
                    id="estimatedDuration"
                    type="number"
                    value={values.estimatedDuration}
                    onChange={(e) => setValue('estimatedDuration', parseInt(e.target.value) || 0)}
                    placeholder="Auto-calculated"
                    readOnly
                  />
                </div>
              </div>
            </div>

            {/* Workflow Template (FR4) */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Workflow Template</h3>

              <div className="space-y-2">
                <Label htmlFor="workflowTemplate">Select Template (Optional)</Label>
                <Select
                  value={values.workflowTemplateId}
                  onValueChange={(value) => handleTemplateSelect(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a workflow template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workflowTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} - {template.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplate && (
                  <div className="mt-2 p-3 bg-gray-50 border rounded-md">
                    <p className="text-sm text-gray-700">
                      <strong>Template:</strong> {selectedTemplate.description}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Steps:</strong> {selectedTemplate.steps.length} workflow steps
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Estimated Duration:</strong> {selectedTemplate.estimatedDuration} days
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Task Template for Project (position-based tasks) */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Project Task Template</h3>
              <div className="space-y-2">
                <Label htmlFor="projectTaskTemplate">Select Task Template (Optional)</Label>
                <Select
                  value={selectedProjectTaskTemplateId}
                  onValueChange={(value) => setSelectedProjectTaskTemplateId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project task template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTaskTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProjectTaskTemplateId && (
                  <div className="mt-2 p-3 bg-gray-50 border rounded-md">
                    <p className="text-sm text-gray-700">
                      This will generate all predefined tasks under the project with position-based assignees. Reporter will be system.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Compliance Requirements (FR9) */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Compliance Requirements</h3>

              <div className="space-y-4">
                <div>
                  <Label>Regulatory Compliance</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {COMPLIANCE_REGULATIONS.map(regulation => (
                      <label key={regulation} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={values.complianceRequirements.includes(regulation)}
                          onChange={() => handleComplianceToggle(regulation)}
                          className="rounded"
                        />
                        <span className="text-sm">{regulation}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Approval Workflow (FR7) */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Approval Workflow</h3>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="requiresApproval"
                    checked={values.requiresApproval}
                    onChange={(e) => setValue('requiresApproval', e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="requiresApproval">Requires approval before starting</Label>
                </div>

                {values.requiresApproval && (
                  <div className="space-y-2">
                    <Label htmlFor="approvalMatrix">Approval Matrix</Label>
                    <Select
                      value={values.approvalMatrixId}
                      onValueChange={(value) => setValue('approvalMatrixId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select approval matrix..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Tags</h3>

              <div className="space-y-2">
                <Label htmlFor="tags">Add Tags</Label>
                <div className="flex space-x-2">
                  <Input
                    id="tags"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Enter tag and press Enter"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleTagAdd())}
                  />
                  <Button type="button" onClick={handleTagAdd} variant="outline">
                    Add
                  </Button>
                </div>
                {values.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {values.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleTagRemove(tag)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Client Information */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Client Information</h3>

              <div className="space-y-2">
                <Label htmlFor="client">Client Name</Label>
                <Input
                  id="client"
                  value={values.client}
                  onChange={(e) => setValue('client', e.target.value)}
                  placeholder="Enter client name"
                />
              </div>
            </div>

            {/* Error Messages */}
            {errors.submit && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
