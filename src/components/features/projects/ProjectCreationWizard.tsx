'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Circle,
  Building2,
  Users,
  Calendar,
  Settings,
  Shield,
  ArrowRight,
  ArrowLeft,
  Save,
  Lock,
  Check
} from 'lucide-react'
import {
  PRDAlignedProject,
  Position,
  WorkflowTemplate,
  ComplianceRequirement
} from '@/types/prd-aligned-schema'
import { EnhancedProject } from '@/types/project-schema'
import { ProjectTaskTemplate, ProjectType } from '@/types/project-task-template'
import { ProjectService, WorkspaceService } from '@/lib/services'
import { ProjectTaskTemplateService } from '@/lib/services/projects/project-task-template-service'
import { useCompany } from '@/contexts/CompanyContext'
import type { Workspace } from '@/types/workspace-schema'
import { getActiveApprovalLines } from '@/lib/services/approval-line-service'
import { getEscalationPaths } from '@/lib/services/escalation-path-service'
import type { ApprovalLine, EscalationPath } from '@/types/approval-line-schema'
import toast from 'react-hot-toast'
import { CustomTemplateWizard } from './CustomTemplateWizard'

interface ProjectCreationWizardProps {
  initialValues?: Partial<FormData>
  mode?: 'create' | 'edit'
  projectId?: string // Required for edit mode
  onProjectCreated?: (project: EnhancedProject | FormData) => void | Promise<void>
  onCancel?: () => void
  currentUser: any
  positions: Position[]
  workflowTemplates: WorkflowTemplate[]
  complianceRequirements: ComplianceRequirement[]
}

interface FormData {
  // Step 1: Basic Info
  name: string
  description: string
  projectCode: string
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  workspaceId: string // Workspace (Level 1)
  projectType?: ProjectType
  projectTemplateId?: string

  // Step 2: Team & Assignment
  assignedPositionId: string
  assignedUserId?: string
  matrixPositions: string[]

  // Step 3: Timeline & Budget
  startDate: string
  endDate: string
  estimatedDuration: number
  costCategory: string

  // Step 4: Organization & Context
  businessUnit: string
  costCenter: string
  location: string
  equipmentType: 'Industrial Robots' | 'Automation Systems' | 'Manufacturing Equipment' | 'Quality Control Systems' | 'Smart Sensors' | 'other'
  manufacturingPhase: 'Design & Engineering' | 'Prototyping' | 'Production Planning' | 'Manufacturing' | 'Quality Testing' | 'Packaging & Delivery'
  qualityStandards: string[]

  // Step 5: Workflow & Compliance
  workflowTemplateId?: string
  complianceRequirements: string[]
  requiresApproval: boolean
  approvalMatrixId?: string
  definitionOfDone: string[]
  tags: string[]
  client?: string

  // Step 5+: New Workflow Defaults
  workflowDefinitionId?: string
  escalationPolicyId?: string

  // Visibility settings
  visibility?: 'standard' | 'private' | 'secret'
}

const STEPS = [
  {
    id: 1,
    title: 'Project Basics',
    description: 'Type, template, and basic info',
    icon: Building2,
    fields: ['projectType', 'projectTemplateId', 'name', 'description', 'projectCode', 'status', 'priority']
  },
  {
    id: 2,
    title: 'Team Assignment',
    description: 'Assign team members and positions',
    icon: Users,
    fields: ['assignedPositionId', 'assignedUserId', 'matrixPositions']
  },
  {
    id: 3,
    title: 'Timeline & Budget',
    description: 'Schedule and financial planning',
    icon: Calendar,
    fields: ['startDate', 'endDate', 'costCategory']
  },
  {
    id: 4,
    title: 'Organization',
    description: 'Location, and context',
    icon: Settings,
    fields: ['businessUnit', 'location', 'equipmentType', 'manufacturingPhase']
  },
  {
    id: 5,
    title: 'Workflow & Compliance',
    description: 'Processes, approvals, and requirements',
    icon: Shield,
    fields: ['workflowTemplateId', 'workflowDefinitionId', 'escalationPolicyId', 'complianceRequirements', 'requiresApproval', 'tags']
  }
]

const COMPLIANCE_REGULATIONS = [
  'SOX', 'GDPR', 'HIPAA', 'PCI-DSS', 'ISO 27001', 'SOC 2', 'FDA', 'OSHA', 'CE Marking', 'RoHS'
]

const COST_CATEGORIES = [
  'Capital Expenditure', 'Operating Expense', 'Research & Development', 'Compliance', 'Training', 'Infrastructure'
]

export function ProjectCreationWizard({
  initialValues: providedInitialValues,
  mode = 'create',
  projectId: providedProjectId,
  onProjectCreated,
  onCancel,
  currentUser,
  positions,
  workflowTemplates,
  complianceRequirements
}: ProjectCreationWizardProps) {
  const { companyId, groupId } = useCompany()
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState(1)
  const [tagInput, setTagInput] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null)
  const [projectTaskTemplates, setProjectTaskTemplates] = useState<ProjectTaskTemplate[]>([])
  const [showCustomTemplateWizard, setShowCustomTemplateWizard] = useState(false)
  const [selectedProjectTaskTemplateId, setSelectedProjectTaskTemplateId] = useState<string>('')
  const [routingPreview, setRoutingPreview] = useState<any>(null)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [stepErrors, setStepErrors] = useState<Record<number, Record<string, string>>>({})
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false)
  const [approvalLines, setApprovalLines] = useState<ApprovalLine[]>([])
  const [escalationPaths, setEscalationPaths] = useState<EscalationPath[]>([])
  const [loadingMetadata, setLoadingMetadata] = useState(false)
  const [showVerificationDialog, setShowVerificationDialog] = useState(false)

  const defaultValues: FormData = {
    name: '',
    description: '',
    projectCode: '',
    status: 'planning',
    priority: 'medium',
    workspaceId: '',
    assignedPositionId: '',
    assignedUserId: '',
    matrixPositions: [],
    startDate: '',
    endDate: '',
    estimatedDuration: 0,
    costCategory: 'Operating Expense',
    businessUnit: '',
    costCenter: '',
    location: '',
    equipmentType: 'other',
    manufacturingPhase: 'Design & Engineering',
    qualityStandards: [],
    workflowTemplateId: '',
    complianceRequirements: [],
    requiresApproval: true,
    approvalMatrixId: '',
    definitionOfDone: [],
    tags: [],
    client: '',
    workflowDefinitionId: '',
    escalationPolicyId: '',
    visibility: 'standard'
  }

  const initialValues: FormData = { ...defaultValues, ...providedInitialValues }

  const [values, setValues] = useState<FormData>(initialValues)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const setValue = useCallback((field: keyof FormData, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }))
    // Clear step errors when user starts typing
    if (stepErrors[currentStep]?.[field]) {
      setStepErrors(prev => ({
        ...prev,
        [currentStep]: {
          ...prev[currentStep],
          [field]: ''
        }
      }))
    }
  }, [currentStep, stepErrors])

  const validateStep = (stepNumber: number): Record<string, string> => {
    const step = STEPS.find(s => s.id === stepNumber)
    if (!step) return {}

    const errors: Record<string, string> = {}

    switch (stepNumber) {
      case 1:
        if (!values.workspaceId) errors.workspaceId = 'Workspace is required'
        if (!values.name.trim()) errors.name = 'Project name is required'
        if (!values.description.trim()) errors.description = 'Description is required'
        if (!values.projectCode.trim()) errors.projectCode = 'Project code is required'
        break
      case 2:
        if (!values.assignedPositionId) errors.assignedPositionId = 'Primary position is required'
        break
      case 3:
        if (!values.startDate) errors.startDate = 'Start date is required'
        if (!values.endDate) errors.endDate = 'End date is required'
        if (values.startDate && values.endDate && values.startDate >= values.endDate) {
          errors.endDate = 'End date must be after start date'
        }
        break
      case 4:
        if (!values.location.trim()) errors.location = 'Location is required'
        break;
      case 5:
        // Step 5 is optional, no required validation
        break
    }

    return errors
  }

  const handleNext = () => {
    const errors = validateStep(currentStep)
    setStepErrors(prev => ({ ...prev, [currentStep]: errors }))

    if (Object.keys(errors).length === 0) {
      setCompletedSteps(prev => [...prev, currentStep])
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1)
      }
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleStepClick = (stepNumber: number) => {
    // Allow navigation to completed steps or next step
    if (completedSteps.includes(stepNumber) || stepNumber === currentStep + 1) {
      setCurrentStep(stepNumber)
    }
  }

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true)
    try {
      // Create project data
      const projectData = {
        ...values,
        actualCost: 0,
        progress: 0,
        riskLevel: 'low',
        qualityScore: 0,
        complianceScore: 0,
        workflowSteps: selectedTemplate?.steps || [],
        currentStepId: selectedTemplate?.steps[0]?.id,
        routingRules: [],
        lastRoutingDecision: null as any,
        manualOverrides: [],
        approvalStatus: values.requiresApproval ? 'pending' : 'approved',
        approvalHistory: [],
        comments: [],
        mentions: [],
        activityLog: [],
        notificationPreferences: [],
        auditTrail: [],
        createdBy: currentUser.id,
        lastModifiedBy: currentUser.id
      }

      if (!companyId) {
        throw new Error('No company selected')
      }

      const projectId = await ProjectService.createProject(
        companyId,
        {
          workspaceId: values.workspaceId,
          name: values.name,
          description: values.description,
          status: values.status,
          priority: values.priority,
          // If no user is assigned, default to the creator as manager
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
          projectType: values.projectType,
          projectTemplateId: values.projectTemplateId || selectedProjectTaskTemplateId || null,
          workflowDefinitionId: values.workflowDefinitionId || undefined,
          escalationPolicyId: values.escalationPolicyId || undefined,
          projectCode: values.projectCode,
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
        },
        groupId ? { groupId } : undefined
      )

      if (mode === 'edit' && providedProjectId) {
        // For edit mode, call update handler with form data
        if (onProjectCreated) {
          await onProjectCreated(values)
        }
        return
      }

      // Create mode
      console.log('Project created successfully with ID:', projectId)
      // Apply project task template if selected (could be projectTemplateId or selectedProjectTaskTemplateId)
      const templateToApply = values.projectTemplateId || selectedProjectTaskTemplateId
      if (templateToApply) {
        try {
          await ProjectTaskTemplateService.applyTemplateToProject(
            companyId,
            projectId,
            values.startDate || new Date().toISOString(),
            templateToApply,
            groupId ?? undefined
          )
        } catch (err) {
          console.error('Failed to apply project task template:', err)
        }
      }

      toast.success(`Project "${values.name}" created successfully!`)

      // Invalidate queries to update sidebar and other lists
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] })

      // Dispatch event for other components that might listen (legacy/external)
      window.dispatchEvent(new CustomEvent('project-created', { detail: { projectId } }))

      if (onProjectCreated) {
        const createdProject = {
          id: projectId,
          ...projectData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        onProjectCreated(createdProject as any)
      }
    } catch (error) {
      console.error('Error creating project:', error)
      toast.error('Failed to create project. Please try again.')
    } finally {
      setIsSubmitting(false)
      setShowVerificationDialog(false)
    }
  }

  const handleSubmit = async () => {
    // Validate all steps
    let hasErrors = false
    const allErrors: Record<number, Record<string, string>> = {}

    for (let i = 1; i <= STEPS.length; i++) {
      const errors = validateStep(i)
      if (Object.keys(errors).length > 0) {
        allErrors[i] = errors
        hasErrors = true
      }
    }

    setStepErrors(allErrors)
    if (hasErrors) {
      // Go to first step with errors
      const firstErrorStep = Object.keys(allErrors)[0]
      if (firstErrorStep) {
        setCurrentStep(parseInt(firstErrorStep))
      }
      return
    }

    setShowVerificationDialog(true)
  }

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

        // Set default workspace if only one exists
        if (workspacesData.length === 1 && workspacesData[0] && !values.workspaceId) {
          setValue('workspaceId', workspacesData[0].id)
        }
      } catch (err) {
        console.error('Failed to load workspaces', err)
      } finally {
        setLoadingWorkspaces(false)
      }
    }
    loadWorkspaces()
  }, [companyId, groupId, setValue, values.workspaceId])

  useEffect(() => {
    const loadMetadata = async () => {
      if (!companyId) return
      try {
        setLoadingMetadata(true)
        const [lines, paths] = await Promise.all([
          getActiveApprovalLines(companyId),
          getEscalationPaths(companyId, { status: 'active' })
        ])
        setApprovalLines(lines || [])
        setEscalationPaths(paths || [])
      } catch (err) {
        console.error('Failed to load workflow metadata', err)
      } finally {
        setLoadingMetadata(false)
      }
    }
    loadMetadata()
  }, [companyId])

  // Load project task templates based on project type
  useEffect(() => {
    const loadTemplates = async () => {
      if (!companyId) return
      try {
        const filters: any = { isActive: true }
        if (values.projectType) {
          filters.projectType = values.projectType
        }
        const list = await ProjectTaskTemplateService.getTemplates(companyId, filters, groupId ?? undefined)
        setProjectTaskTemplates(list)
      } catch (err) {
        console.error('Failed to load project task templates', err)
      }
    }
    loadTemplates()
  }, [companyId, groupId, values.projectType])

  // Generate project code when name changes
  useEffect(() => {
    // Always auto-generate from name (no manual override)
    if (values.name) {
      const clean = values.name.replace(/[^a-zA-Z0-9 ]/g, '').toUpperCase()
      const words = clean.split(' ').filter(w => w.length > 0)

      let code = 'PRJ'
      if (words.length === 1) {
        // Single word: Take first 3 chars (e.g. "DEMO" -> "DEM")
        const w = words[0]!
        code = w.length < 3 ? w : w.substring(0, 3)
      } else if (words.length >= 2) {
        // Multiple words: Take first letter of each word (max 4 chars)
        // e.g. "Project Asta" -> "PA"
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

  const progressPercentage = (completedSteps.length / STEPS.length) * 100

  const renderStepContent = () => {
    const currentStepData = STEPS.find(s => s.id === currentStep)
    const errors = stepErrors[currentStep] || {}

    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Building2 className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Project Basics</h2>
              <p className="text-gray-600">Let's start with the essential information about your project</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="projectType">Project Type (Optional)</Label>
                <Select
                  value={values.projectType || ''}
                  onValueChange={(value) => {
                    setValue('projectType', value as ProjectType)
                    setValue('projectTemplateId', '')
                    setSelectedProjectTaskTemplateId('')
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="projectTemplateId">Project Template (Optional)</Label>
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
                  value={values.projectTemplateId || selectedProjectTaskTemplateId || ''}
                  onValueChange={(value) => {
                    setValue('projectTemplateId', value)
                    setSelectedProjectTaskTemplateId(value)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template (optional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTaskTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          {template.name}
                          {template.isSystemTemplate && (
                            <Badge variant="secondary" className="px-1 py-0 h-4 text-[10px] font-normal">Predefined</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                    {projectTaskTemplates.length === 0 && (
                      <SelectItem value="none" disabled>No templates found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Users className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Team Assignment</h2>
              <p className="text-gray-600">Assign team members and define reporting structure</p>
            </div>

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
                        {position.title}
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
                    <span className="text-sm">{position.title}</span>
                  </label>
                ))}
              </div>
            </div>

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
        )

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Calendar className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Timeline & Budget</h2>
              <p className="text-gray-600">Set project schedule and financial parameters</p>
            </div>

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
                <Label htmlFor="estimatedDuration">Duration (Days)</Label>
                <Input
                  id="estimatedDuration"
                  type="number"
                  value={values.estimatedDuration}
                  placeholder="Auto-calculated"
                  readOnly
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

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
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Settings className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Organization</h2>
              <p className="text-gray-600">Define organizational context and manufacturing details</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">


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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        )

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Shield className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Workflow & Compliance</h2>
              <p className="text-gray-600">Configure processes, approvals, and compliance requirements</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="workflowTemplate">Workflow Template (Optional)</Label>
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

              {/* Project Task Template selection */}
              <div className="space-y-2">
                <Label htmlFor="projectTaskTemplate">Project Task Template (Optional)</Label>
                <Select
                  value={selectedProjectTaskTemplateId}
                  onValueChange={(value) => setSelectedProjectTaskTemplateId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project task template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTaskTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProjectTaskTemplateId && (
                  <div className="mt-2 p-3 bg-gray-50 border rounded-md">
                    <p className="text-sm text-gray-700">
                      Selecting this will auto-generate predefined tasks under the project with position-based assignees. Reporter will be system.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <Label>Regulatory Compliance</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="requiresApproval"
                    checked={values.requiresApproval}
                    onChange={(e) => setValue('requiresApproval', e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="requiresApproval">Requires approval before starting (Project Approval)</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="workflowDefinitionId">Default Approval Line (For Tasks)</Label>
                  <Select
                    value={values.workflowDefinitionId || 'none'}
                    onValueChange={(value) => setValue('workflowDefinitionId', value === 'none' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select default approval line..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {approvalLines.map(line => (
                        <SelectItem key={line.id} value={line.id}>
                          {line.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    New tasks created in this project will default to this approval line.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="escalationPolicyId">Default Escalation Policy (For Tasks)</Label>
                  <Select
                    value={values.escalationPolicyId || 'none'}
                    onValueChange={(value) => setValue('escalationPolicyId', value === 'none' ? '' : value)}
                    disabled={loadingMetadata}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingMetadata ? "Loading..." : "Select default escalation policy..."} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {escalationPaths.map(path => (
                        <SelectItem key={path.id} value={path.id}>
                          {path.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    New tasks created in this project will default to this escalation policy.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
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
                      <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleTagRemove(tag)}>
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="client">Client Name (Optional)</Label>
                <Input
                  id="client"
                  value={values.client}
                  onChange={(e) => setValue('client', e.target.value)}
                  placeholder="Enter client name"
                />
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="w-full">
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-500">
            Step {currentStep} of {STEPS.length}
          </div>
        </div>

        <Progress value={progressPercentage} className="mb-4" />

        {/* Step Navigation */}
        <div className="flex justify-between">
          {STEPS.map((step) => {
            const Icon = step.icon
            const isCompleted = completedSteps.includes(step.id)
            const isCurrent = currentStep === step.id
            const isClickable = completedSteps.includes(step.id) || step.id === currentStep + 1

            return (
              <div
                key={step.id}
                className={`flex flex-col items-center cursor-pointer transition-all ${isClickable ? 'hover:opacity-80' : 'opacity-50'
                  }`}
                onClick={() => handleStepClick(step.id)}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${isCompleted
                  ? 'bg-green-500 text-white'
                  : isCurrent
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-500'
                  }`}>
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <div className="text-center">
                  <div className={`text-sm font-medium ${isCurrent ? 'text-primary' : 'text-gray-500'
                    }`}>
                    {step.title}
                  </div>
                  <div className="text-xs text-gray-400 max-w-20">
                    {step.description}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-8">
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation Footer */}
      <div className="flex justify-between items-center mt-8">
        <Button
          variant="outline"
          onClick={currentStep === 1 ? onCancel : handlePrevious}
          disabled={isSubmitting}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {currentStep === 1 ? 'Cancel' : 'Previous'}
        </Button>

        <div className="flex space-x-2">
          {currentStep < STEPS.length ? (
            <Button onClick={handleNext} disabled={isSubmitting}>
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {mode === 'edit' ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {mode === 'edit' ? 'Update Project' : 'Create Project'}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      {showCustomTemplateWizard && (
        <CustomTemplateWizard
          companyId={companyId!}
          groupId={groupId ?? undefined}
          initialProjectType={values.projectType || undefined}
          onClose={() => setShowCustomTemplateWizard(false)}
          onTemplateCreated={(templateId) => {
            setValue('projectTemplateId', templateId)
            setSelectedProjectTaskTemplateId(templateId)
            setShowCustomTemplateWizard(false)
          }}
        />
      )}
    </div>
  )
}
