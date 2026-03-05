'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'

import { Drawer, DrawerContent, DrawerFooter } from '@/components/ui/drawer'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CheckSquare, User as UserIcon, Loader2, AlertTriangle, UserPlus, Paperclip, X, File } from 'lucide-react'
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
import type { GeneratedTask } from '@/types/task-template-schema'
import { MemberSelect, MemberSelection } from '@/components/common/MemberSelect'
import { UserSelect } from '@/components/features/users/UserSelect'
import { formatDate, formatISODate } from '@/lib/utils/date-utils'
import { getPriorityColor } from './utils'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { UserService, TaskMasterDataService, WorkspaceService } from '@/lib/services'
import { EntityLookupService } from '@/lib/services/import/entity-lookup-service'
import { ProjectWorkflowAssignmentService } from '@/lib/services/projects/project-workflow-assignment-service'
import type { User } from '@/types'
import type { EnhancedProject } from '@/types/project-schema'
import type { RequirementType } from '@/lib/services/tasks/task-master-data-service'
import { useTaskTypesQuery } from '@/hooks/queries/useTaskTypesQuery'
import type { WorkflowDefinition } from '@/types/workflow-schema'
import { getActiveApprovalLinesWithSystem } from '@/lib/services/approval-line-service'
import { isSystemApprovalLine } from '@/lib/constants/system-approval-lines'
import * as EscalationPathService from '@/lib/services/escalation-path-service'
import type { ApprovalLine, EscalationPath } from '@/types/approval-line-schema'
import { WorkflowLifecycleService } from '@/lib/services/workflow-lifecycle-service'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useProjectsQuery } from '@/hooks/queries/useProjectQueries'
import {
  validateFile,
  formatFileSize,
  DEFAULT_ALLOWED_TYPES,
  DEFAULT_MAX_FILE_SIZE
} from '@/lib/services/storage/task-attachment-service'
import toast from 'react-hot-toast'

interface TaskFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: TaskFormData) => void
  mode: 'create' | 'edit' | 'view' | 'progress'
  task?: GeneratedTask | null
  isUpdatingProgress?: boolean
  progressUpdate?: string
  onProgressUpdate?: (progress: string, notes: string) => void
  completionNotes?: string
  onNotesChange?: (notes: string) => void
  defaultProjectId?: string
  defaults?: {
    isMilestone?: boolean
  }
  showWbsFields?: boolean
  isLoading?: boolean
}

export interface TaskFormData {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  estimatedHours: number
  dueDate: string
  startDate?: string  // Optional start date for multi-day tasks
  endDate?: string    // Optional end date (defaults to dueDate)

  assignee?: string   // User ID (derived if position assigned)
  assignedPositionId?: string // Position ID if assigned to position
  assignedToName?: string // Combined Name (e.g., "Position | User")
  reporter?: string
  reporterName?: string
  reporterPositionId?: string // Position ID for reporter
  projectId: string // Required - every task must belong to a project
  taskType?: string
  requirementType?: string
  progress?: string
  notes?: string
  workflowId?: string
  // WBS Fields
  isMilestone?: boolean
  targetDate?: string
  dependencies?: string[] // List of Task IDs
  workflowDefinitionId?: string
  escalationPolicyId?: string
  // Attachments - staged files for upload after task creation
  stagedAttachments?: File[]
}

type MasterDataOption = {
  value: string
  label: string
  color?: string
}

const DEFAULT_REQUIREMENT_TYPE_OPTIONS: MasterDataOption[] = [
  { value: 'Regulatory', label: 'Regulatory', color: '#2563eb' },
  { value: 'Internal', label: 'Internal', color: '#7c3aed' },
  { value: 'Customer', label: 'Customer', color: '#0891b2' },
  { value: 'Audit', label: 'Audit', color: '#ea580c' },
  { value: 'Safety', label: 'Safety', color: '#dc2626' },
  { value: 'Quality', label: 'Quality', color: '#16a34a' },
  { value: 'Other', label: 'Other', color: '#6b7280' },
]

const OPTIONAL_SELECT_NONE = '__none__' as const

export function TaskForm({
  isOpen,
  onClose,
  onSubmit,
  mode,
  task,
  isUpdatingProgress,
  progressUpdate = '',
  onProgressUpdate,
  completionNotes = '',
  onNotesChange,
  defaultProjectId,
  defaults,
  showWbsFields = true,
  isLoading = false
}: TaskFormProps) {
  const { companyId, groupId, currentCompanyUser } = useCompany()
  const { user: currentUser } = useAuthStore()
  const { selectedWorkspace } = useWorkspace()
  const isAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'
  const { data: projectsData = [], isLoading: loadingProjects } = useProjectsQuery(
    companyId ?? undefined,
    groupId ?? undefined,
    currentUser?.id,
    isAdmin
  )
  const { taskTypeOptions } = useTaskTypesQuery(companyId ?? undefined, groupId ?? undefined)
  const [users, setUsers] = useState<User[]>([])
  const [requirementTypes, setRequirementTypes] = useState<RequirementType[]>([])
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([])
  const [approvalLines, setApprovalLines] = useState<ApprovalLine[]>([])
  const [escalationPaths, setEscalationPaths] = useState<EscalationPath[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingRequirementTypes, setLoadingRequirementTypes] = useState(false)
  const [loadingWorkflows, setLoadingWorkflows] = useState(false)
  const [defaultProjectIdState, setDefaultProjectIdState] = useState<string>('')

  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    priority: 'medium',
    estimatedHours: 1,
    dueDate: '',
    startDate: '',
    endDate: '',
    assignee: '',
    assignedPositionId: '',
    assignedToName: '',
    reporter: currentUser?.id || '',
    reporterPositionId: '',
    projectId: '', // Will be set when projects load
    taskType: '',
    requirementType: '',
    progress: '',
    notes: '',
    isMilestone: false,
    targetDate: '',
    dependencies: [],
    workflowId: '',
    workflowDefinitionId: '',
    escalationPolicyId: ''
  })

  const [assigneeSelection, setAssigneeSelection] = useState<MemberSelection | undefined>(undefined)
  const [reporterSelection, setReporterSelection] = useState<MemberSelection | undefined>(undefined)
  const [showAssigneeConfirmation, setShowAssigneeConfirmation] = useState(false)

  // Attachment staging
  const [stagedFiles, setStagedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)



  const today = new Date().toISOString().split('T')[0] || ''

  const requirementTypeOptions = useMemo<MasterDataOption[]>(() => {
    if (requirementTypes.length > 0) {
      return requirementTypes
        .filter(type => type.isActive)
        .map(type => ({
          value: type.name,
          label: type.name,
          color: type.color,
        }))
    }
    return DEFAULT_REQUIREMENT_TYPE_OPTIONS
  }, [requirementTypes])

  // Filter projects: active/planning, default/AUT inclusion, workspace filter
  const projects = useMemo(() => {
    const explicitDefault = defaultProjectId
      ? projectsData.find(project => project.id === defaultProjectId)
      : undefined
    const autProject = projectsData.find(project => (project.projectCode || '').toUpperCase() === 'AUT')

    let activeProjects = projectsData.filter(
      project => project.status === 'active' || project.status === 'planning'
    )

    if (explicitDefault && !activeProjects.some(project => project.id === explicitDefault.id)) {
      activeProjects = [explicitDefault, ...activeProjects]
    }

    if (autProject && !activeProjects.some(project => project.id === autProject.id)) {
      activeProjects = [autProject, ...activeProjects]
    }

    if (activeProjects.length === 0 && projectsData.length > 0) {
      activeProjects = projectsData
    }

    if (selectedWorkspace?.id) {
      activeProjects = activeProjects.filter(project => project.workspaceId === selectedWorkspace.id)

      // Apply guest restrictions
      if (currentUser?.id) {
        const isWMember = Array.isArray(selectedWorkspace.members) && selectedWorkspace.members.includes(currentUser.id)
        const isWOwner = selectedWorkspace.ownerId === currentUser.id
        const isWCreator = selectedWorkspace.createdBy === currentUser.id
        const isWAdmin = Array.isArray((selectedWorkspace as any).adminIds) && (selectedWorkspace as any).adminIds.includes(currentUser.id)
        const isWSpoc = Array.isArray((selectedWorkspace as any).spocIds) && (selectedWorkspace as any).spocIds.includes(currentUser.id)
        const isCompanyAdmin = currentUser.role === 'owner' || currentUser.role === 'admin'

        const isGuest = !isCompanyAdmin && !isWOwner && !isWCreator && !isWMember && !isWAdmin && !isWSpoc

        if (isGuest) {
          activeProjects = activeProjects.filter(p => p.projectType === 'rft' || (p.name && p.name.match(/RFT/i)))
        }
      }

      if (explicitDefault && !activeProjects.some(p => p.id === explicitDefault.id)) {
        activeProjects = [explicitDefault, ...activeProjects]
      }
      if (autProject && !activeProjects.some(p => p.id === autProject.id)) {
        activeProjects = [autProject, ...activeProjects]
      }
    }

    return activeProjects
  }, [projectsData, defaultProjectId, selectedWorkspace?.id, currentUser])

  const resolvedProjectId = formData.projectId || defaultProjectIdState || defaultProjectId
  const selectedProject = useMemo(
    () => (resolvedProjectId ? projects.find(p => p.id === resolvedProjectId) : undefined),
    [projects, resolvedProjectId]
  )

  // Set default project when projects load (create mode)
  useEffect(() => {
    if (!isOpen || mode !== 'create') return
    if (projects.length === 0) {
      setDefaultProjectIdState('')
      return
    }
    // When opened from a project page, always use context project so workflow load uses correct project
    if (defaultProjectId) {
      setDefaultProjectIdState(defaultProjectId)
      setFormData(prev => ({ ...prev, projectId: defaultProjectId }))
      return
    }
    const autProject = projects.find(project => (project.projectCode || '').toUpperCase() === 'AUT')
    const fallbackDefault = autProject || projects[0]
    if (fallbackDefault) {
      setDefaultProjectIdState(fallbackDefault.id)
      setFormData(prev => (prev.projectId ? prev : { ...prev, projectId: fallbackDefault.id }))
    } else {
      setDefaultProjectIdState('')
    }
  }, [isOpen, mode, projects, defaultProjectId])

  useEffect(() => {
    if (isOpen && companyId) {
      loadUsers(formData.projectId)
      loadTaskMasterData()
      // Set default reporter to current user and sync reporter selection for create mode
      if (currentUser && mode === 'create') {
        setFormData(prev => ({
          ...prev,
          reporter: currentUser.id,
          // Apply defaults if present
          ...(defaults?.isMilestone !== undefined && {
            isMilestone: defaults.isMilestone,
            estimatedHours: defaults.isMilestone ? 0 : 1
          })
        }))
        setReporterSelection({
          type: 'user',
          id: currentUser.id,
          label: currentUser.name || currentUser.email || 'You'
        })
      }
    }
  }, [isOpen, companyId, currentUser, mode, groupId])

  useEffect(() => {
    if (isOpen && companyId && resolvedProjectId) {
      loadUsers(resolvedProjectId)
      loadProjectWorkflows(resolvedProjectId)
    }
  }, [resolvedProjectId, isOpen, companyId, groupId])

  async function loadUsers(projectId?: string) {
    if (!companyId) return
    try {
      setLoadingUsers(true)

      // Check if we need to filter by workspace
      let usersData: User[] = []

      if (projectId) {
        // Get the project to check workspace and visibility
        const project = projects.find(p => p.id === projectId)
        if (project?.workspaceId) {
          // Fetch workspace to check visibility
          const workspace = await WorkspaceService.getWorkspace(groupId ?? companyId, companyId, project.workspaceId)

          // Check if workspace or project is private/secret
          const workspaceVisibility = workspace?.visibility || 'standard'
          const projectVisibility = project.visibility || 'standard'

          if (workspaceVisibility === 'private' || workspaceVisibility === 'secret' ||
            projectVisibility === 'private' || projectVisibility === 'secret') {
            // Only load workspace members for private/secret workspaces/projects
            usersData = await EntityLookupService.fetchWorkspaceUsers(companyId, project.workspaceId, groupId ?? undefined)
          } else {
            usersData = await UserService.getUsers(companyId, groupId ?? undefined)
          }
        } else {
          usersData = await UserService.getUsers(companyId, groupId ?? undefined)
        }
      } else {
        usersData = await UserService.getUsers(companyId, groupId ?? undefined)
      }

      setUsers(usersData)
    } catch (error) {
      console.error('Error loading users:', error)
      // Fallback to all users on error
      try {
        const usersData = await UserService.getUsers(companyId, groupId ?? undefined)
        setUsers(usersData)
      } catch (fallbackError) {
        console.error('Error loading fallback users:', fallbackError)
      }
    } finally {
      setLoadingUsers(false)
    }
  }



  async function loadTaskMasterData() {
    if (!companyId) return
    try {
      setLoadingRequirementTypes(true)
      const [requirementTypeList, workflowsList] = await Promise.all([
        TaskMasterDataService.getRequirementTypes(companyId, groupId ?? undefined),
        WorkflowLifecycleService.getAccessibleWorkflows(companyId, currentUser?.id || '', { status: ['active'] }, groupId ?? undefined),
      ])
      setRequirementTypes(requirementTypeList)
      setWorkflows(workflowsList || [])
    } catch (error) {
      console.error('Error loading task metadata:', error)
    } finally {
      setLoadingRequirementTypes(false)
    }
  }

  // Load project-specific approval lines and escalation paths
  async function loadProjectWorkflows(projectId: string) {
    if (!companyId || !projectId) {
      setApprovalLines([])
      setEscalationPaths([])
      return
    }

    try {
      setLoadingWorkflows(true)

      // Get all approval lines (including system lines) and escalation paths
      // Use companyId as groupId if groupId is not provided (for single-tenant compatibility)
      const effectiveGroupId = groupId || companyId
      const [allLines, allPaths, projectWorkflowIds] = await Promise.all([
        getActiveApprovalLinesWithSystem(companyId, effectiveGroupId),
        EscalationPathService.getEscalationPaths(companyId, { status: 'active' }, effectiveGroupId),
        ProjectWorkflowAssignmentService.getProjectWorkflowIds(companyId, projectId, effectiveGroupId)
      ])

      // Separate system lines from user-created lines
      const systemLines = allLines.filter(line => isSystemApprovalLine(line))
      const userLines = allLines.filter(line => !isSystemApprovalLine(line))

      // Filter user-created lines by project assignment
      // System lines are ALWAYS available (regardless of project assignment)
      let filteredUserLines: ApprovalLine[] = []
      if (projectWorkflowIds.approvalLineIds.length > 0) {
        filteredUserLines = userLines.filter(line =>
          projectWorkflowIds.approvalLineIds.includes(line.id)
        )
      }

      // Combine: system lines first, then project-assigned user lines
      setApprovalLines([...systemLines, ...filteredUserLines])

      if (projectWorkflowIds.escalationPathIds.length > 0) {
        const filteredPaths = allPaths.filter(path =>
          projectWorkflowIds.escalationPathIds.includes(path.id)
        )
        setEscalationPaths(filteredPaths)
      } else {
        setEscalationPaths([])
      }
    } catch (error) {
      console.error('Error loading project workflows:', error)
      setApprovalLines([])
      setEscalationPaths([])
    } finally {
      setLoadingWorkflows(false)
    }
  }

  // Load task data when editing
  useEffect(() => {
    if (mode === 'edit' && task) {
      setFormData(prev => ({
        ...prev,
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        estimatedHours: task.estimatedHours,
        dueDate: formatISODate(task.dueDate),
        startDate: formatISODate(task.startDate),
        assignee: task.assignedUserId || '',
        assignedPositionId: task.assignedPositionId || '',
        // Prefer explicit reporter, then assignedBy, finally current user
        reporter: (task as any).reporter || (task as any).assignedBy || currentUser?.id || '',
        projectId: task.projectId,
        taskType: task.taskType || '',
        requirementType: task.requirementType || '',
        isMilestone: !!task.isMilestone,
        targetDate: task.targetDate || '',
        dependencies: [], // Dependencies not fully loaded in form yet
        workflowId: (task as any).workflowId || (task as any).workflowInstanceId || '',
        workflowDefinitionId: task.workflowDefinitionId || '',
        escalationPolicyId: task.escalationPolicyId || ''
      }))

      // Initialize selection state
      if (task.assignedPositionId) {
        // If we have position info available, we could set label. 
        // For now just ID, MemberSelect needs to handle ID-only init or we need to fetch title
        setAssigneeSelection({
          type: 'position',
          id: task.assignedPositionId,
          label: 'Loading position...' // Will be resolved by MemberSelect internal lookup if we're lucky, or we need to pass data
        })
      } else if (task.assignedUserId) {
        setAssigneeSelection({
          type: 'user',
          id: task.assignedUserId,
          label: 'Loading user...'
        })
      } else {
        setAssigneeSelection(undefined)
      }

      // Initialize reporter selection
      if ((task as any).reporterPositionId) {
        setReporterSelection({
          type: 'position',
          id: (task as any).reporterPositionId,
          label: 'Loading position...'
        })
      } else if (task.assignedBy || (task as any).reporter) {
        setReporterSelection({
          type: 'user',
          id: (task as any).reporter || task.assignedBy || '',
          label: 'Loading user...'
        })
      } else {
        setReporterSelection(undefined)
      }
    }
  }, [task, mode, currentUser])



  const handleSubmit = (forceAssignToMe = false) => {
    const resolvedProjectId = formData.projectId || defaultProjectIdState
    if (!resolvedProjectId) {
      console.warn('Cannot create task without a project. Ensure a default project exists.')
      return
    }

    // Check if assignee is selected (only for create mode)
    const hasAssignee = formData.assignee || formData.assignedPositionId
    if (mode === 'create' && !hasAssignee && !forceAssignToMe) {
      setShowAssigneeConfirmation(true)
      return
    }

    // If forceAssignToMe is true, assign to current user
    const finalAssignee = forceAssignToMe && !hasAssignee ? currentUser?.id : formData.assignee
    const finalAssignedToName = forceAssignToMe && !hasAssignee ? (currentUser?.name || currentUser?.email || 'You') : formData.assignedToName

    // Preserve reporter from edit; default to current user only when creating
    const formDataWithReporter = {
      ...formData,
      projectId: resolvedProjectId,
      assignee: finalAssignee || '',
      assignedToName: finalAssignedToName || '',
      reporter: formData.reporter || currentUser?.id || '',
      reporterName: reporterSelection?.label || currentUser?.name || '',
      // Include staged attachments for upload after task creation
      stagedAttachments: stagedFiles.length > 0 ? stagedFiles : undefined,
    }
    onSubmit(formDataWithReporter)
    setShowAssigneeConfirmation(false)
    // Reset form for create mode
    if (mode === 'create') {
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        estimatedHours: 1,
        dueDate: '',
        startDate: '',
        endDate: '',
        assignee: '',
        reporter: currentUser?.id || '',
        projectId: resolvedProjectId,
        taskType: '',
        requirementType: '',
        progress: '',
        notes: '',
        isMilestone: false,
        targetDate: '',
        dependencies: [],
        workflowDefinitionId: '',
        escalationPolicyId: ''
      })
      setAssigneeSelection(undefined)
      setStagedFiles([]) // Reset staged attachments
    }
  }

  const handleCancel = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      estimatedHours: 1,
      dueDate: '',
      startDate: '',
      endDate: '',
      assignee: '',
      reporter: currentUser?.id || '',
      reporterPositionId: '',
      projectId: defaultProjectIdState || projects[0]?.id || '',
      taskType: '',
      requirementType: '',
      progress: '',
      notes: '',
      isMilestone: false,
      targetDate: '',
      dependencies: [],
      workflowDefinitionId: '',
      escalationPolicyId: ''
    })
    setAssigneeSelection(undefined)
    setStagedFiles([]) // Reset staged attachments
    onClose()
  }

  // File selection handlers for attachments
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const files = Array.from(e.target.files)
    const validFiles: File[] = []

    // Validate each file
    files.forEach((file) => {
      const validation = validateFile(file, DEFAULT_MAX_FILE_SIZE, DEFAULT_ALLOWED_TYPES)
      if (validation.valid) {
        validFiles.push(file)
      } else {
        toast.error(`${file.name}: ${validation.error}`)
      }
    })

    if (validFiles.length > 0) {
      setStagedFiles(prev => [...prev, ...validFiles])
    }

    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeStagedFile = (index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index))
  }

  // For progress update mode
  if (isUpdatingProgress) {
    return (
      <Drawer
        open={isOpen}
        onOpenChange={onClose}
        title={task?.title || 'Update Task Progress'}
        description="Update task progress"
      >
        <DrawerContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Update Progress
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={progressUpdate}
                  onChange={(e) => onProgressUpdate?.(e.target.value, completionNotes)}
                  placeholder="Enter progress %"
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Notes
              </label>
              <Textarea
                value={completionNotes}
                onChange={(e) => onNotesChange?.(e.target.value)}
                placeholder="Add progress notes..."
                rows={3}
              />
            </div>
          </div>
        </DrawerContent>
        <DrawerFooter>
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button onClick={() => {
            onProgressUpdate?.(progressUpdate, completionNotes)
            onClose()
          }}>
            Update Progress
          </Button>
        </DrawerFooter>
      </Drawer>
    )
  }

  // For view mode
  if (mode === 'view' && task) {
    return (
      <Drawer
        open={isOpen}
        onOpenChange={onClose}
        title={task.title}
        description={task.description}
      >
        <DrawerContent>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <p className="text-sm text-foreground capitalize">{task.status.replace('_', ' ')}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Priority</label>
                <Badge className={getPriorityColor(task.priority)}>
                  {task.priority}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Due Date</label>
                <p className="text-sm text-foreground">{formatDate(task.dueDate)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Estimated Hours</label>
                <p className="text-sm text-foreground">{task.estimatedHours}h</p>
              </div>
            </div>

            {task.definitionOfDone && task.definitionOfDone.length > 0 && (
              <>
                <Separator />
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Definition of Done
                  </label>
                  <div className="space-y-2">
                    {task.definitionOfDone.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${item.isCompleted ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700' : 'bg-muted border-border'
                          }`}>
                          {item.isCompleted && <CheckSquare className="h-3 w-3 text-green-600 dark:text-green-400" />}
                        </div>
                        <span className={`text-sm ${item.isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'
                          }`}>
                          {item.text}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {item.evidence?.length || 0} evidence
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  // For create/edit mode
  return (
    <Drawer
      open={isOpen}
      onOpenChange={onClose}
      title={mode === 'create' ? 'Create New Task' : 'Edit Task'}
      description={mode === 'create' ? 'Add a new task to your task list' : 'Update task details'}
    >
      <DrawerContent>
        <div className="space-y-4">
          {/* Ghost Issue Warning Banner */}
          {mode === 'edit' && task?.hasGhostIssue && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    Workflow Issue Detected
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {task.ghostInfo?.hasGhostApproval && task.ghostInfo?.approvalGhostReason === 'position_vacant' && (
                      <>The approval line has vacant positions. </>
                    )}
                    {task.ghostInfo?.hasGhostApproval && task.ghostInfo?.approvalGhostReason === 'position_missing' && (
                      <>The approval line has missing positions. </>
                    )}
                    {task.ghostInfo?.hasGhostEscalation && task.ghostInfo?.escalationGhostReason === 'position_vacant' && (
                      <>The escalation path has vacant positions. </>
                    )}
                    {task.ghostInfo?.hasGhostEscalation && task.ghostInfo?.escalationGhostReason === 'position_missing' && (
                      <>The escalation path has missing positions. </>
                    )}
                    Change to a valid workflow below to resolve this issue.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Task Title <span className="text-destructive">*</span>
            </label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter task title"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Description
            </label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter task description"
              rows={4}
            />
          </div>

          {/* Project Selector - Required for all tasks */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Project <span className="text-destructive">*</span>
            </label>
            <Select
              value={formData.projectId}
              onValueChange={(value) => {
                const project = projects.find(p => p.id === value)
                setFormData({
                  ...formData,
                  projectId: value,
                  // Don't auto-inherit approval line from project - let user choose manually
                  workflowDefinitionId: '',
                  // Don't auto-inherit escalation policy from project - let user choose manually
                  escalationPolicyId: ''
                })
              }}
              disabled={loadingProjects || mode === 'edit'}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingProjects ? "Loading projects..." : "Select a project..."} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">
                        {project.projectCode || project.name.substring(0, 4).toUpperCase()}
                      </span>
                      <span>{project.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projects.length === 0 && !loadingProjects && (
              <p className="text-xs text-muted-foreground mt-1">
                No active projects found. Create a project first.
              </p>
            )}
          </div>



          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Task Type <span className="text-destructive">*</span>
              </label>
              <Select
                value={formData.taskType || ''}
                onValueChange={(value) =>
                  setFormData(prev => ({
                    ...prev,
                    taskType: value
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select task type" />
                </SelectTrigger>
                <SelectContent>
                  {taskTypeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: option.color || '#6b7280' }}
                        />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Requirement Type <span className="text-destructive">*</span>
              </label>
              <Select
                value={formData.requirementType || ''}
                onValueChange={(value) =>
                  setFormData(prev => ({
                    ...prev,
                    requirementType: value
                  }))
                }
                disabled={loadingRequirementTypes}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingRequirementTypes ? 'Loading requirement types...' : 'Select requirement type'} />
                </SelectTrigger>
                <SelectContent>
                  {requirementTypeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: option.color || '#6b7280' }}
                        />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Assignee
              </label>
              <MemberSelect
                value={assigneeSelection}
                onValueChange={(selected) => {
                  setAssigneeSelection(selected)
                  if (!selected) {
                    setFormData(prev => ({
                      ...prev,
                      assignee: '',
                      assignedPositionId: '',
                      assignedToName: ''
                    }))
                    return
                  }

                  if (selected.type === 'user') {
                    setFormData(prev => ({
                      ...prev,
                      assignee: selected.id,
                      assignedPositionId: '',
                      assignedToName: selected.label
                    }))
                  } else {
                    setFormData(prev => ({
                      ...prev,
                      assignedPositionId: selected.id,
                      assignee: selected.userId || '',
                      assignedToName: selected.label
                    }))
                  }
                }}
                className="w-full"
                placeholder="Select user..."
                workspaceId={undefined}
                includePositions={false}
                allowedUserIds={selectedProject ? Array.from(new Set([
                  ...(selectedProject.manager ? [selectedProject.manager] : []),
                  ...(selectedProject.createdBy ? [selectedProject.createdBy] : []),
                  ...(selectedProject.team || []),
                  ...(selectedProject.projectType === 'rft' ? (selectedWorkspace?.members || []) : [])
                ])) : undefined}
                includeUsers={true}
              />
              {formData.assignedPositionId && !formData.assignee && (
                <p className="text-xs text-amber-600 mt-1">
                  Position assigned. User will be derived automatically.
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Reporter
              </label>
              <MemberSelect
                value={reporterSelection}
                onValueChange={(selected) => {
                  setReporterSelection(selected)
                  if (!selected) {
                    setFormData(prev => ({
                      ...prev,
                      reporter: '',
                      reporterPositionId: ''
                    }))
                    return
                  }

                  if (selected.type === 'user') {
                    setFormData(prev => ({
                      ...prev,
                      reporter: selected.id,
                      reporterPositionId: ''
                    }))
                  } else {
                    setFormData(prev => ({
                      ...prev,
                      reporterPositionId: selected.id,
                      reporter: selected.userId || ''
                    }))
                  }
                }}
                className="w-full"
                placeholder="Select reporter..."
                disabled={true}
                includeUsers={true}
                includePositions={false}
                workspaceId={undefined}
                allowedUserIds={selectedProject ? Array.from(new Set([
                  ...(selectedProject.manager ? [selectedProject.manager] : []),
                  ...(selectedProject.createdBy ? [selectedProject.createdBy] : []),
                  ...(selectedProject.team || [])
                ])) : undefined}
              />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">Auto-filled with the logged-in user</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Approval Line (Internal)
              </label>
              <Select
                value={formData.workflowDefinitionId || 'none'}
                onValueChange={(value) => setFormData({ ...formData, workflowDefinitionId: value === 'none' ? '' : value })}
                disabled={loadingWorkflows || approvalLines.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    loadingWorkflows ? 'Loading...' :
                      approvalLines.length === 0 ? 'No approval lines available' :
                        'Select approval line...'
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {approvalLines.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      <div className="flex items-center gap-2">
                        {isSystemApprovalLine(line) && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            System
                          </Badge>
                        )}
                        <span>{line.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                {approvalLines.length === 0 && !loadingWorkflows
                  ? 'Configure approval lines in Project Settings → Workflows'
                  : 'Select "Reporter Approval" to require reporter review before completion.'}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Escalation Policy
              </label>
              <Select
                value={formData.escalationPolicyId || 'none'}
                onValueChange={(value) => setFormData({ ...formData, escalationPolicyId: value === 'none' ? '' : value })}
                disabled={loadingWorkflows || escalationPaths.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    loadingWorkflows ? 'Loading...' :
                      escalationPaths.length === 0 ? 'No escalation paths available' :
                        'Select escalation path...'
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {escalationPaths.map((path) => (
                    <SelectItem key={path.id} value={path.id}>
                      {path.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                {escalationPaths.length === 0 && !loadingWorkflows
                  ? 'Configure escalation paths in Project Settings → Workflows'
                  : 'Monitors SLA breaches after task is started.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Priority *
              </label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value as any })}
              >
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

          {/* WBS SECTION */}
          {showWbsFields && (
            <div className="space-y-4 border rounded-md p-4 bg-gray-50/50">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isMilestone"
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  checked={formData.isMilestone}
                  onChange={(e) => setFormData({
                    ...formData,
                    isMilestone: e.target.checked,
                    estimatedHours: e.target.checked ? 0 : 1, // Auto-set 0 hours
                    // Clear date fields when switching mode
                    startDate: '',
                    targetDate: ''
                  })}
                />
                <label htmlFor="isMilestone" className="text-sm font-medium text-foreground cursor-pointer select-none">
                  Mark as Milestone
                </label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                {formData.isMilestone
                  ? "Milestone: Zero-duration marker for a key event or deadline"
                  : "Regular task with duration"
                }
              </p>
            </div>
          )}

          {/* CONDITIONAL DATE FIELDS - Based on Milestone Status */}
          {formData.isMilestone ? (
            /* MILESTONE: Show only Target Date */
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Target Date <span className="text-destructive">*</span>
                </label>
                <DatePicker
                  minDate={mode === 'create' ? today : undefined}
                  value={formData.targetDate || formData.dueDate}
                  onChange={(date) => setFormData({
                    ...formData,
                    targetDate: date,
                    dueDate: date, // Sync dueDate for compatibility
                    startDate: date, // Milestone: startDate = endDate = targetDate
                    endDate: date
                  })}
                  placeholder="Select target date"
                />

                <p className="text-xs text-muted-foreground mt-1">
                  The date this milestone is due
                </p>
              </div>
            </div>
          ) : (
            /* REGULAR TASK: Show Start Date, Due Date, Estimated Hours */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Estimated Hours
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.estimatedHours}
                    onChange={(e) => setFormData({ ...formData, estimatedHours: parseFloat(e.target.value) || 1 })}
                    placeholder="Estimated hours"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Start Date <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <DatePicker
                    value={formData.startDate || ''}
                    onChange={(date) => setFormData({ ...formData, startDate: date })}
                    maxDate={formData.dueDate} // Start date cannot be after due date
                    placeholder="Select start date"
                  />

                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Due Date <span className="text-destructive">*</span>
                  </label>
                  <DatePicker
                    value={formData.dueDate}
                    onChange={(date) => setFormData({
                      ...formData,
                      dueDate: date,
                      // Auto-set endDate to dueDate when dueDate changes
                      endDate: date
                    })}
                    minDate={mode === 'create' ? (formData.startDate && formData.startDate > today ? formData.startDate : today) : formData.startDate}
                    placeholder="Select due date"
                  />

                </div>
              </div>
            </div>
          )}

          {/* Dependencies Section */}
          {showWbsFields && (
            <div className="space-y-2 border rounded-md p-4 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Dependencies
                </label>
                {mode === 'edit' && task?.dependencies && task.dependencies.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {task.dependencies.length} linked
                  </span>
                )}
              </div>

              {mode === 'create' ? (
                <p className="text-xs text-muted-foreground">
                  💡 After creating the task, you can add dependencies in the <span className="font-medium">WBS Gantt</span> view
                  by clicking the <span className="font-mono bg-gray-200 px-1 rounded">+</span> button in the DEP column.
                </p>
              ) : task?.dependencies && task.dependencies.length > 0 ? (
                <div className="space-y-1">
                  {task.dependencies.map((dep, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs bg-white px-2 py-1 rounded border">
                      <span className="font-mono text-gray-400">#{dep.targetTaskId.slice(0, 6)}</span>
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
                        {dep.type}
                      </span>
                      {dep.lag > 0 && (
                        <span className="text-gray-500">+{dep.lag}d lag</span>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-2">
                    Edit dependencies in the WBS Gantt view for full control.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No dependencies set. Add them in the WBS Gantt view.
                </p>
              )}
            </div>
          )}

          {/* Attachments Section - Only for create mode */}
          {mode === 'create' && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Attachments <span className="text-xs text-muted-foreground font-normal">(Max {formatFileSize(DEFAULT_MAX_FILE_SIZE)})</span>
              </label>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept={DEFAULT_ALLOWED_TYPES.join(',')}
              />

              {/* Staged files list or Add button */}
              {stagedFiles.length === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full justify-start text-muted-foreground font-normal"
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Click to add files
                </Button>
              ) : (
                <div className="space-y-2">
                  {stagedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 border rounded-md bg-muted/30"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <File className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-sm truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          ({formatFileSize(file.size)})
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStagedFile(index)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary hover:text-primary"
                  >
                    <Paperclip className="h-3 w-3 mr-1" />
                    Add more
                  </Button>
                </div>
              )}
            </div>
          )}

        </div>
      </DrawerContent>
      <DrawerFooter>
        <Button
          variant="outline"
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button
          onClick={() => handleSubmit()}
          disabled={!formData.title || !formData.dueDate || !formData.taskType || !formData.requirementType || isLoading}
          className="min-w-[120px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === 'create' ? 'Creating...' : 'Updating...'}
            </>
          ) : (
            mode === 'create' ? 'Create Task' : 'Update Task'
          )}
        </Button>
      </DrawerFooter>

      {/* Assignee Confirmation Dialog - positioned above drawer */}
      <AlertDialog open={showAssigneeConfirmation} onOpenChange={setShowAssigneeConfirmation}>
        <AlertDialogContent className="max-w-sm z-[99999] fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]">
          <AlertDialogHeader className="text-center sm:text-center">
            <div className="flex flex-col items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <UserPlus className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <AlertDialogTitle className="text-lg">No Assignee Selected</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-muted-foreground text-center">
              You haven't selected an assignee for this task. Would you like to assign it to yourself, or go back to select someone else?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={() => handleSubmit(true)}
              className="bg-primary hover:bg-primary/90 w-full"
            >
              Assign to Me & Create
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={() => setShowAssigneeConfirmation(false)}
              className="w-full"
            >
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Drawer>
  )
}

