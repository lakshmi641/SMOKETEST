'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Pencil,
  X,
  Link as LinkIcon,
  Paperclip,
  MessageSquare,
  Clock,
  User,
  Calendar,
  Flag,
  CheckCircle,
  AlertCircle,
  FileText,
  Play,
  Pause,
  ArrowLeft,
  Plus,
  Save,
  Check,
  Loader2,
  ShieldCheck,
  ShieldOff,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  History
} from 'lucide-react'
import type { GeneratedTask, TaskAttachment } from '@/types/task-template-schema'
import type { EnhancedProject } from '@/types/project-schema'
import type { WorkflowDefinition } from '@/types/workflow-schema'
import { useAuthStore } from '@/store/authStore'
import { TaskAttachmentUpload } from '@/components/features/tasks/TaskAttachmentUpload'
import { TaskAttachmentsList } from '@/components/features/tasks/TaskAttachmentsList'
import { getTaskAttachments } from '@/lib/services/storage/task-attachment-service'
import { useCompany } from '@/contexts/CompanyContext'
import { TaskTemplateService } from '@/lib/services/tasks/task-template-service'
import { TaskApprovalService } from '@/lib/services/tasks/task-approval-service'
import { getActiveApprovalLinesWithSystem } from '@/lib/services/approval-line-service'
import { isSystemReporterApprovalLine } from '@/lib/constants/system-approval-lines'
import { getEscalationPaths } from '@/lib/services/escalation-path-service'
import { ApprovalLine, EscalationPath } from '@/types/approval-line-schema'
import { ApprovalWorkflowStatus } from '@/components/features/tasks/ApprovalWorkflowStatus'
import { EscalationStatusDisplay } from '@/components/features/tasks/EscalationStatusDisplay'
import { TaskComments } from '@/components/comments/TaskComments'
import toast from 'react-hot-toast'
import { TaskLastSeenAvatars } from '@/components/features/tasks/TaskLastSeenAvatars'
import { TaskBreadcrumb } from './TaskBreadcrumb'
import { formatTaskId } from '@/lib/utils/task-display'
import { ImportWizard } from '@/components/import/ImportWizard'
import { FileSpreadsheet } from 'lucide-react'
import { DependencyDialog } from '@/components/features/tasks/wbs/DependencyDialog'
import { DependencyWarningDialog } from '@/components/features/tasks/DependencyWarningDialog'
import type { DependencyValidationResult } from '@/lib/services/tasks/task-template-service'
import { cn } from '@/lib/utils'
import { LinkedWorkItemsList } from './LinkedWorkItemsList'
import { LinkWorkItemDialog } from './LinkWorkItemDialog'
import { RecentlyViewedService } from '@/lib/services/tasks/recently-viewed-service'
import { StarButton } from '@/components/ui/star-button'
import { useStarredItems } from '@/hooks/useStarredItems'
import { subscribeToTaskActivities } from '@/lib/services/task-activity-service'
import type { TaskActivity } from '@/types/task-activity-schema'
import { CustomFieldCell } from '@/components/features/custom-fields'
import type { ProjectCustomFieldWithDefinition } from '@/types/custom-field'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { formatDate, formatDateTime } from '@/lib/utils/date-utils'
import { MemberSelect, MemberSelection } from '@/components/common/MemberSelect'
import { WorkspaceService } from '@/lib/services'
import type { Workspace } from '@/types/workspace-schema'
import { LogTimeDrawer } from '@/components/features/tasks/LogTimeDrawer'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'
import {
  Tooltip as ShadcnTooltip,
  TooltipContent as ShadcnTooltipContent,
  TooltipProvider as ShadcnTooltipProvider,
  TooltipTrigger as ShadcnTooltipTrigger
} from '@/components/ui/tooltip'

const DEP_TYPE_LABELS: Record<string, string> = {
  'FS': 'Finish to Start',
  'SS': 'Start to Start',
  'FF': 'Finish to Finish',
  'SF': 'Start to Finish'
}

interface IssueDetailPageProps {
  task: GeneratedTask
  project?: EnhancedProject | null
  onUpdate?: (task: GeneratedTask) => Promise<void>
  onBack?: () => void
  users?: Array<{ id: string; name: string; avatar?: string }>
  projectTasks?: GeneratedTask[]
  projectFields?: ProjectCustomFieldWithDefinition[]
  initialEdit?: boolean // Deprecated - kept for backward compatibility
  userRole?: string
}

export function IssueDetailPage({
  task: initialTask,
  project,
  onUpdate,
  onBack,
  users = [],
  projectTasks = [],
  projectFields = [],
  initialEdit = false,
  userRole = 'employee'
}: IssueDetailPageProps) {
  const { user: currentUser } = useAuthStore()
  const isCreator = initialTask.reporter === currentUser?.id

  // Use granular permissions instead of role checks
  const canEditTask = usePermission(PERMISSIONS.TASK_EDIT)
  const canCreateSubtask = usePermission(PERMISSIONS.TASK_CREATE)

  // Keep isAdmin for backward compatibility or specific admin-only UI elements if needed
  const isAdmin = userRole === 'admin' || userRole === 'owner' || userRole === 'manager'
  const router = useRouter()
  const { companyId, groupId, currentCompany } = useCompany()
  const { isStarred, toggleStarred } = useStarredItems()
  const [task, setTask] = useState<GeneratedTask>(initialTask)
  const [isSavingField, setIsSavingField] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('details')
  const [attachments, setAttachments] = useState<TaskAttachment[]>(initialTask.attachments || [])
  const [loadingAttachments, setLoadingAttachments] = useState(false)

  // Inline editing states
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editingTitle, setEditingTitle] = useState(initialTask.title)
  const [isSavingTitle, setIsSavingTitle] = useState(false)

  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editingDescription, setEditingDescription] = useState(initialTask.description || '')
  const [isSavingDescription, setIsSavingDescription] = useState(false)

  // Subtasks
  const [subtasks, setSubtasks] = useState<GeneratedTask[]>([])
  const [loadingSubtasks, setLoadingSubtasks] = useState(false)
  const [isCreatingSubtask, setIsCreatingSubtask] = useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [importWizardOpen, setImportWizardOpen] = useState(false)

  // Parent task tracking for breadcrumb navigation
  const [parentTask, setParentTask] = useState<GeneratedTask | null>(null)
  const [isLoadingSubtask, setIsLoadingSubtask] = useState(false)
  const [isDependencyDialogOpen, setIsDependencyDialogOpen] = useState(false)
  const [editingDependencyId, setEditingDependencyId] = useState<string | null>(null)
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)

  const titleInputRef = useRef<HTMLInputElement>(null)
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null)

  const [projectTasksState, setProjectTasksState] = useState<GeneratedTask[]>(projectTasks || [])
  const [approvalLines, setApprovalLines] = useState<ApprovalLine[]>([])
  const [escalationPaths, setEscalationPaths] = useState<EscalationPath[]>([])
  const [loadingWorkflows, setLoadingWorkflows] = useState(false)

  // Approval resubmission state
  const [isResubmitting, setIsResubmitting] = useState(false)
  const [approvalInstance, setApprovalInstance] = useState<any>(null)
  const [approvalHistory, setApprovalHistory] = useState<any[]>([])
  const [showApprovalHistory, setShowApprovalHistory] = useState(false)
  const [isLogTimeDrawerOpen, setIsLogTimeDrawerOpen] = useState(false)

  // Dependency warning dialog state
  const [dependencyWarningOpen, setDependencyWarningOpen] = useState(false)
  const [dependencyValidation, setDependencyValidation] = useState<DependencyValidationResult | null>(null)
  const [pendingStatus, setPendingStatus] = useState<GeneratedTask['status'] | null>(null)

  // Workspace and member selection state
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [assigneeSelection, setAssigneeSelection] = useState<MemberSelection | undefined>(undefined)
  const [reporterSelection, setReporterSelection] = useState<MemberSelection | undefined>(undefined)

  useEffect(() => {
    if (projectTasks && projectTasks.length > 0) {
      setProjectTasksState(projectTasks)
    }
  }, [projectTasks])

  // Fetch all tasks for the project if not provided
  useEffect(() => {
    async function fetchProjectTasks() {
      if (companyId && task.projectId && projectTasksState.length === 0) {
        try {
          const tasks = await TaskTemplateService.getProjectTasks(companyId, task.projectId, groupId ?? undefined)
          setProjectTasksState(tasks)
        } catch (error) {
          console.error('Failed to fetch project tasks:', error)
        }
      }
    }
    fetchProjectTasks()
  }, [companyId, task.projectId, projectTasksState.length])

  // Fetch available workflows for selection
  useEffect(() => {
    async function fetchWorkflows() {
      if (companyId) {
        try {
          setLoadingWorkflows(true)
          const [lines, paths] = await Promise.all([
            getActiveApprovalLinesWithSystem(companyId, groupId ?? undefined),
            getEscalationPaths(companyId, { status: 'active' }, groupId ?? undefined)
          ])
          setApprovalLines(lines)
          setEscalationPaths(paths)
        } catch (error) {
          console.error('Failed to fetch workflows:', error)
        } finally {
          setLoadingWorkflows(false)
        }
      }
    }
    fetchWorkflows()
  }, [companyId])

  // Fetch workspace for position filtering
  useEffect(() => {
    async function fetchWorkspace() {
      if (companyId && project?.workspaceId) {
        try {
          const ws = await WorkspaceService.getWorkspace(groupId ?? companyId, companyId, project.workspaceId)
          setWorkspace(ws)
        } catch (error) {
          console.error('Failed to fetch workspace:', error)
        }
      }
    }
    fetchWorkspace()
  }, [companyId, project?.workspaceId])

  useEffect(() => {
    if (task) {
      const getResolvedName = (name: string | null | undefined, userId?: string) => {
        if (name) {
          if (name.includes(' | ')) return name.split(' | ').pop()
          if (name.includes(' - ')) return name.split(' - ').pop()
        }
        const user = users.find(u => u.id === userId)
        if (user?.name) return user.name
        return name || undefined
      }

      if (task.assignedPositionId) {
        setAssigneeSelection({
          type: 'position',
          id: task.assignedPositionId,
          label: getResolvedName(task.assignedToName, task.assignedUserId) || 'Position',
          subLabel: 'Position'
        })
      } else if (task.assignedUserId) {
        setAssigneeSelection({
          type: 'user',
          id: task.assignedUserId,
          label: getResolvedName(task.assignedToName, task.assignedUserId) || 'User',
          subLabel: 'User'
        })
      } else {
        setAssigneeSelection(undefined)
      }

      if (task.reporterPositionId) {
        // Extract person name from reporterName if it's in "Position | Name" format
        const reporterDisplayName = task.reporterName
          ? (task.reporterName.includes(' | ') ? task.reporterName.split(' | ').pop() : task.reporterName)
          : 'Reporter Position';

        setReporterSelection({
          type: 'position',
          id: task.reporterPositionId,
          label: reporterDisplayName || 'Reporter Position',
          subLabel: 'Position'
        })
      } else if (task.reporter) {
        const reporterUser = users.find(u => u.id === task.reporter)
        // Also check reporterName for fallback
        const reporterDisplayName = reporterUser?.name || (task.reporterName
          ? (task.reporterName.includes(' | ') ? task.reporterName.split(' | ').pop() : task.reporterName)
          : 'Reporter');

        setReporterSelection({
          type: 'user',
          id: task.reporter,
          label: reporterDisplayName,
          subLabel: 'User'
        })
      } else {
        setReporterSelection(undefined)
      }
    }
  }, [task.id, task.assignedPositionId, task.assignedUserId, task.reporterPositionId, task.reporter, task.assignedToName])

  useEffect(() => {
    setTask(initialTask)
    setAttachments(initialTask.attachments || [])
    setEditingTitle(initialTask.title)
    setEditingDescription(initialTask.description || '')
    // Reset parent task when initial task changes (not from subtask click)
    if (!initialTask.parentTaskId) {
      setParentTask(null)
    }
  }, [initialTask, initialTask.lastSeenBy])

  // Refresh task data on mount to ensure we have latest endDate from WBS calculations
  useEffect(() => {
    async function refreshTaskData() {
      if (companyId && initialTask.id) {
        try {
          const refreshed = await TaskTemplateService.getTask(companyId, initialTask.id, groupId ?? undefined)
          if (refreshed) {
            // Update task state with latest data, especially endDate from WBS
            setTask(prev => {
              // Only update if dates have actually changed to avoid unnecessary re-renders
              if (refreshed.endDate !== prev.endDate ||
                refreshed.startDate !== prev.startDate ||
                refreshed.dueDate !== prev.dueDate) {
                return refreshed
              }
              return prev
            })
          }
        } catch (error) {
          console.error('Error refreshing task data:', error)
        }
      }
    }
    // Refresh once on mount to get latest WBS-calculated dates
    refreshTaskData()
  }, [companyId, initialTask.id])

  // Real-time subscription to task document for live updates
  useEffect(() => {
    if (!companyId || !task.id || !groupId) return

    const segments = companySubcollectionPathSegments(groupId, companyId, 'tasks')
    const taskDocRef = doc(db, segments[0], ...segments.slice(1), task.id)

    const unsubscribe = onSnapshot(taskDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const updatedTask = { id: snapshot.id, ...snapshot.data() } as GeneratedTask
        setTask(prev => {
          // Only update if there are actual changes to avoid infinite loops
          // Compare key fields that might change externally
          if (updatedTask.status !== prev.status ||
            updatedTask.approvalStatus !== prev.approvalStatus ||
            updatedTask.approvalInstanceId !== prev.approvalInstanceId ||
            updatedTask.reporterApprovalStatus !== prev.reporterApprovalStatus ||
            updatedTask.assignedUserId !== prev.assignedUserId ||
            updatedTask.updatedAt !== prev.updatedAt) {
            return updatedTask
          }
          return prev
        })
      }
    }, (error) => {
      console.error('Error subscribing to task updates:', error)
    })

    return () => unsubscribe()
  }, [companyId, task.id, groupId])

  // Load subtasks when task changes (only for main tasks, not subtasks)
  useEffect(() => {
    if (companyId && task.id && !task.parentTaskId) {
      loadSubtasks()
    } else {
      // Clear subtasks if viewing a subtask
      setSubtasks([])
    }
  }, [companyId, task.id, task.parentTaskId])

  // Fetch parent task for breadcrumb
  useEffect(() => {
    async function fetchParent() {
      if (task.parentTaskId && companyId) {
        try {
          // If we already have it in state, skip (handled by initial prop or previous fetch)
          if (parentTask?.id === task.parentTaskId) return

          const parent = await TaskTemplateService.getTask(companyId, task.parentTaskId, groupId ?? undefined)
          if (parent) {
            setParentTask(parent)
          }
        } catch (error) {
          console.error('Failed to fetch parent task:', error)
        }
      }
    }
    fetchParent()
  }, [task.parentTaskId, companyId, parentTask?.id])

  // Fetch approval instance(s) for rejection details and history
  useEffect(() => {
    async function fetchApprovalInstances() {
      if (companyId && task.id) {
        try {
          // Fetch ALL approval instances for history
          const allInstances = await TaskApprovalService.getAllApprovalInstances(companyId, task.id, groupId ?? undefined)
          setApprovalHistory(allInstances)

          // Set the current instance (latest one, or the one matching approvalInstanceId)
          if (task.approvalInstanceId) {
            const currentInstance = allInstances.find(i => i.id === task.approvalInstanceId) || allInstances[allInstances.length - 1]
            setApprovalInstance(currentInstance)
          } else if (allInstances.length > 0) {
            setApprovalInstance(allInstances[allInstances.length - 1])
          } else {
            setApprovalInstance(null)
          }
        } catch (error) {
          console.error('Failed to fetch approval instances:', error)
        }
      } else {
        setApprovalInstance(null)
        setApprovalHistory([])
      }
    }
    fetchApprovalInstances()
  }, [companyId, task.approvalInstanceId, task.id])

  // Handle resubmit for rejected tasks
  const handleResubmitForApproval = async () => {
    if (!companyId || !task.id || !currentUser?.id) return

    try {
      setIsResubmitting(true)

      // Check if this is a reporter approval (system approval line)
      const isReporterApproval = isSystemReporterApprovalLine(task.workflowDefinitionId) || task.requiresReporterApproval

      if (isReporterApproval) {
        // For reporter approval: Update status to approval_required first, then trigger approval
        await TaskTemplateService.updateTaskStatus(
          companyId,
          task.id,
          'approval_required',
          undefined, // no additional updates
          currentUser.id,
          false, // skipDependencyCheck
          groupId ?? undefined
        )
        // triggerReporterApproval is automatically called by updateTaskStatus when status changes to approval_required
      } else {
        // For regular approval lines: Trigger direct approval
        await TaskApprovalService.triggerDirectApproval(companyId, task.id, currentUser.id, groupId ?? undefined)
      }

      // Refresh task data
      const updatedTask = await TaskTemplateService.getTask(companyId, task.id, groupId ?? undefined)
      if (updatedTask) {
        setTask(updatedTask)
        if (onUpdate) {
          await onUpdate(updatedTask)
        }
      }

      toast.success('Task resubmitted for approval')
    } catch (error) {
      console.error('Error resubmitting for approval:', error)
      toast.error('Failed to resubmit for approval')
    } finally {
      setIsResubmitting(false)
    }
  }

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  useEffect(() => {
    if (isEditingDescription && descriptionTextareaRef.current) {
      descriptionTextareaRef.current.focus()
    }
  }, [isEditingDescription])

  const loadSubtasks = async (taskId?: string) => {
    const targetTaskId = taskId || task.id
    if (!companyId || !targetTaskId) return

    try {
      setLoadingSubtasks(true)
      const subtasksData = await TaskTemplateService.getSubtasks(companyId, targetTaskId, groupId ?? undefined)
      setSubtasks(subtasksData)
    } catch (error) {
      console.error('Error loading subtasks:', error)
      toast.error('Failed to load subtasks')
    } finally {
      setLoadingSubtasks(false)
    }
  }

  // Load attachments when component mounts or task changes
  useEffect(() => {
    const loadAttachments = async () => {
      if (!companyId || !task.id) return

      try {
        setLoadingAttachments(true)
        const taskAttachments = await getTaskAttachments(task.id, companyId, groupId ?? undefined)
        setAttachments(taskAttachments)

        // Update task with attachments
        if (taskAttachments.length > 0) {
          setTask(prev => ({ ...prev, attachments: taskAttachments }))
        }
      } catch (error) {
        console.error('Error loading attachments:', error)
      } finally {
        setLoadingAttachments(false)
      }
    }

    loadAttachments()
  }, [companyId, task.id])

  // Track recently viewed task
  useEffect(() => {
    if (companyId && task.id && currentUser?.id && project) {
      RecentlyViewedService.trackView(companyId, currentUser.id, {
        id: task.id,
        taskNumber: (task.taskNumber || 0).toString(),
        projectCode: project.projectCode || '',
        projectId: task.projectId,
        title: task.title
      }, groupId ?? undefined).catch((err: any) => {
        console.error('Error tracking recently viewed task:', err)
      })
    }
  }, [companyId, task.id, currentUser?.id, project])

  // Track task "seen" status
  useEffect(() => {
    if (companyId && task.id && currentUser?.id) {
      TaskTemplateService.recordTaskSeen(companyId, task.id, currentUser.id, groupId ?? undefined)
        .catch(err => console.error('Error recording task seen:', err))
    }
  }, [companyId, task.id, currentUser?.id, groupId])

  // Auto-save function for right sidebar fields
  const handleFieldChange = async (field: string, value: any) => {
    if (!companyId || !task.id) return

    if (!canEditTask) {
      toast.error('You do not have permission to edit this task')
      return
    }

    // Capture old value BEFORE update for activity logging
    const oldValue = (task as any)[field]

    try {
      setIsSavingField(field)
      const updates: any = {
        [field]: value,
        updatedAt: new Date().toISOString(),
      }

      // Sync dates for consistency between WBS Gantt and task page
      // WBS uses endDate, so we always keep endDate and dueDate in sync
      if (field === 'endDate' && value) {
        // When endDate changes, sync dueDate to match (WBS uses endDate)
        updates.dueDate = value
      } else if (field === 'dueDate' && value) {
        // When dueDate changes, sync endDate to match
        updates.endDate = value
      } else if (field === 'startDate') {
        // When startDate changes, validate against endDate/dueDate
        const endDate = task.endDate || task.dueDate
        if (value && endDate && new Date(value) > new Date(endDate)) {
          toast.error('Start date cannot be after end date')
          return
        }
        // If endDate exists and is before new startDate, adjust it
        if (value && task.endDate && new Date(value) > new Date(task.endDate)) {
          updates.endDate = value
          updates.dueDate = value
        }
      }

      await TaskTemplateService.updateTaskStatus(companyId, task.id, task.status, updates, currentUser?.id, undefined, groupId ?? undefined)

      // If escalation policy is being assigned and task is already in_progress, register for escalation
      if (field === 'escalationPolicyId' && value && ['in_progress', 'assigned'].includes(task.status)) {
        try {
          const { TaskEscalationService } = await import('@/lib/services/tasks/task-escalation-service')
          await TaskEscalationService.registerForEscalation(companyId, task.id, groupId ?? undefined)
          toast.success('Escalation monitoring activated')
        } catch (err) {
          console.error('Failed to register escalation:', err)
        }
      }

      const updatedTask = { ...task, [field]: value, ...updates }
      setTask(updatedTask)

      // Also update via onUpdate if available
      if (onUpdate) {
        await onUpdate(updatedTask)
      }

      toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} updated`)

      // --- TASK ACTIVITY LOGGING (fire-and-forget) ---
      // Log field changes to taskActivities collection for the Activity tab
      // Skip system/internal fields
      const fieldsToLog = ['priority', 'dueDate', 'endDate', 'startDate', 'estimatedHours', 'taskType', 'requirementType', 'workflowDefinitionId', 'escalationPolicyId', 'progress']
      if (fieldsToLog.includes(field) && currentUser?.id && oldValue !== value) {
        import('@/lib/services/task-activity-service')
          .then(({ logFieldChanged }) => {
            logFieldChanged(
              companyId,
              task.id,
              task.projectId || '',
              field,
              field, // fieldLabel will be computed by the service
              oldValue,
              value,
              currentUser.id,
              currentUser.name || 'Unknown User',
              groupId ?? undefined
            )
          })
          .catch((err) => console.error('[Activity] Failed to log field change:', err))
      }
    } catch (error) {
      console.error(`Error updating ${field}:`, error)
      toast.error(`Failed to update ${field}`)
    } finally {
      setIsSavingField(null)
    }
  }

  // This handler is called by CustomFieldCell's onValueChange callback for optimistic UI updates.
  // The actual Firestore persistence is handled by CustomFieldCell via useProjectCustomFields.updateTaskValue.
  // This function ONLY updates local state to keep the UI in sync.
  const handleUpdateTaskCustomField = (fieldId: string, value: any) => {
    if (!companyId || !task.id) return

    const newValue = value === null || value === undefined ? null : value

    // Update local state only (Firestore update is handled by CustomFieldCell)
    const updatedCustomFields = { ...task.customFields }
    if (newValue === null) {
      delete updatedCustomFields[fieldId]
    } else {
      updatedCustomFields[fieldId] = newValue
    }

    const updatedTask = { ...task, customFields: updatedCustomFields, updatedAt: new Date().toISOString() }
    setTask(updatedTask)

    // Also update via onUpdate if available (for parent component sync)
    if (onUpdate) {
      onUpdate(updatedTask)
    }
  }

  const handleStatusChange = async (status: GeneratedTask['status'], skipDependencyCheck = false) => {
    if (!companyId || !task.id) return

    if (!canEditTask) {
      toast.error('You do not have permission to edit this task')
      return
    }

    try {
      // Check dependencies if task has any and not skipping check
      if (!skipDependencyCheck && task.dependencies && task.dependencies.length > 0) {
        setIsSavingField('status')
        const validation = await TaskTemplateService.validateDependenciesForStatusChange(
          companyId,
          task.id,
          status,
          groupId ?? undefined
        )

        if (validation.hasBlockingDependencies) {
          // Store the pending status and show warning dialog
          setPendingStatus(status)
          setDependencyValidation(validation)
          setDependencyWarningOpen(true)
          setIsSavingField(null)
          return
        }
      }

      // Proceed with status update
      setIsSavingField('status')
      await TaskTemplateService.updateTaskStatus(companyId, task.id, status, undefined, currentUser?.id, skipDependencyCheck, groupId ?? undefined)

      const updatedTask = { ...task, status, updatedAt: new Date().toISOString() }
      setTask(updatedTask)

      if (onUpdate) {
        await onUpdate(updatedTask)
      }

      // Format status name for display (e.g., "in_progress" -> "In Progress")
      const statusDisplayName = status
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      toast.success(`Status changed to ${statusDisplayName}`)
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    } finally {
      setIsSavingField(null)
    }
  }

  // Handler for when user confirms they want to proceed despite dependency warnings
  const handleDependencyWarningProceed = async () => {
    if (pendingStatus) {
      await handleStatusChange(pendingStatus, true) // Skip dependency check on retry
    }
    setPendingStatus(null)
    setDependencyValidation(null)
  }

  const handleMultipleFieldsChange = async (updates: any) => {
    if (!companyId || !task.id) return

    if (!canEditTask) {
      toast.error('You do not have permission to edit this task')
      return
    }

    // Capture old assignment values for activity logging
    const oldAssignedUserId = task.assignedUserId
    const oldAssignedToName = task.assignedToName

    try {
      const fieldKey = Object.keys(updates)[0]
      setIsSavingField(fieldKey || null)
      const now = new Date().toISOString()
      const finalUpdates = { ...updates, updatedAt: now }

      await TaskTemplateService.updateTaskStatus(companyId, task.id, task.status, finalUpdates, currentUser?.id, undefined, groupId ?? undefined)

      const updatedTask = { ...task, ...finalUpdates }
      setTask(updatedTask)

      if (onUpdate) {
        await onUpdate(updatedTask)
      }

      toast.success('Updated successfully')

      // --- TASK ACTIVITY LOGGING (fire-and-forget) ---
      // Detect assignment change and log it
      if (updates.assignedUserId !== undefined && updates.assignedUserId !== oldAssignedUserId && currentUser?.id) {
        const newAssignedUserId = updates.assignedUserId
        const newAssignedToName = updates.assignedToName || 'Unknown'

        // Determine change type
        let changeType: 'task_assigned' | 'task_reassigned' | 'task_unassigned'
        if (!oldAssignedUserId && newAssignedUserId) {
          changeType = 'task_assigned'
        } else if (oldAssignedUserId && !newAssignedUserId) {
          changeType = 'task_unassigned'
        } else {
          changeType = 'task_reassigned'
        }

        import('@/lib/services/task-activity-service')
          .then(({ logAssignmentChanged }) => {
            logAssignmentChanged(
              companyId,
              task.id,
              task.projectId || '',
              changeType,
              currentUser.id,
              currentUser.name || 'Unknown User',
              {
                fromUserId: oldAssignedUserId,
                fromUserName: oldAssignedToName || 'Unknown',
                toUserId: newAssignedUserId,
                toUserName: newAssignedToName,
              },
              groupId ?? undefined
            )
          })
          .catch((err) => console.error('[Activity] Failed to log assignment change:', err))
      }
    } catch (error) {
      console.error('Error updating task fields:', error)
      toast.error('Failed to update')
    } finally {
      setIsSavingField(null)
    }
  }

  const handlePriorityChange = async (priority: GeneratedTask['priority']) => {
    await handleFieldChange('priority', priority)
  }

  const handleSaveTitle = async () => {
    if (!companyId || !task.id || !editingTitle.trim()) {
      setIsEditingTitle(false)
      setEditingTitle(task.title)
      return
    }

    if (!canEditTask) {
      toast.error('You do not have permission to edit this task')
      setIsEditingTitle(false)
      setEditingTitle(task.title)
      return
    }

    // Capture old title for activity logging
    const oldTitle = task.title

    try {
      setIsSavingTitle(true)
      await TaskTemplateService.updateTaskTitle(companyId, task.id, editingTitle.trim(), currentUser?.id, groupId ?? undefined)
      setTask(prev => ({ ...prev, title: editingTitle.trim() }))
      setIsEditingTitle(false)
      toast.success('Title updated')

      // --- TASK ACTIVITY LOGGING (fire-and-forget) ---
      if (currentUser?.id && oldTitle !== editingTitle.trim()) {
        import('@/lib/services/task-activity-service')
          .then(({ logFieldChanged }) => {
            logFieldChanged(
              companyId,
              task.id,
              task.projectId || '',
              'title',
              'Title',
              oldTitle,
              editingTitle.trim(),
              currentUser.id,
              currentUser.name || 'Unknown User',
              groupId ?? undefined
            )
          })
          .catch((err) => console.error('[Activity] Failed to log title change:', err))
      }

      // Also update via onUpdate if available
      if (onUpdate) {
        await onUpdate({ ...task, title: editingTitle.trim() })
      }
    } catch (error) {
      console.error('Error updating title:', error)
      toast.error('Failed to update title')
      setEditingTitle(task.title)
    } finally {
      setIsSavingTitle(false)
    }
  }

  const handleCancelTitle = () => {
    setEditingTitle(task.title)
    setIsEditingTitle(false)
  }

  const handleSaveDescription = async () => {
    if (!companyId || !task.id) {
      setIsEditingDescription(false)
      setEditingDescription(task.description || '')
      return
    }

    if (!canEditTask) {
      toast.error('You do not have permission to edit this task')
      setIsEditingDescription(false)
      setEditingDescription(task.description || '')
      return
    }

    // Capture old description for activity logging
    const oldDescription = task.description || ''

    try {
      setIsSavingDescription(true)
      await TaskTemplateService.updateTaskDescription(companyId, task.id, editingDescription, groupId ?? undefined)
      setTask(prev => ({ ...prev, description: editingDescription }))
      setIsEditingDescription(false)
      toast.success('Description updated')

      // --- TASK ACTIVITY LOGGING (fire-and-forget) ---
      // Only log if content actually changed
      if (currentUser?.id && oldDescription !== editingDescription) {
        import('@/lib/services/task-activity-service')
          .then(({ logFieldChanged }) => {
            logFieldChanged(
              companyId,
              task.id,
              task.projectId || '',
              'description',
              'Description',
              oldDescription,
              editingDescription,
              currentUser.id,
              currentUser.name || 'Unknown User',
              groupId ?? undefined
            )
          })
          .catch((err) => console.error('[Activity] Failed to log description change:', err))
      }

      // Also update via onUpdate if available
      if (onUpdate) {
        await onUpdate({ ...task, description: editingDescription })
      }
    } catch (error) {
      console.error('Error updating description:', error)
      toast.error('Failed to update description')
      setEditingDescription(task.description || '')
    } finally {
      setIsSavingDescription(false)
    }
  }

  const handleCancelDescription = () => {
    setEditingDescription(task.description || '')
    setIsEditingDescription(false)
  }

  const handleCreateSubtask = async () => {
    if (!companyId || !task.id || !newSubtaskTitle.trim() || !currentUser?.id) {
      return
    }

    try {
      setIsCreatingSubtask(true)

      // ✅ createManualTask now returns the COMPLETE task object (including taskNumber)
      const newSubtask = await TaskTemplateService.createManualTask(
        companyId,
        currentUser.id,
        {
          title: newSubtaskTitle.trim(),
          description: '',
          priority: task.priority,
          estimatedHours: 1,
          dueDate: task.dueDate,
          projectId: task.projectId,
          parentTaskId: task.id,
          reporter: currentUser.id,
          workflowDefinitionId: task.workflowDefinitionId,
          escalationPolicyId: task.escalationPolicyId,
        },
        groupId ?? undefined
      )

      toast.success('Subtask created')
      setNewSubtaskTitle('')
      setIsCreatingSubtask(false)

      // ✅ CRITICAL FIX: Dispatch the COMPLETE task object with taskNumber and projectCode
      // This ensures the parent task list immediately shows the expand arrow
      const subtaskWithProjectCode = {
        ...newSubtask,
        projectCode: project?.projectCode || project?.name?.substring(0, 4).toUpperCase() || 'TASK'
      }

      window.dispatchEvent(new CustomEvent('taskCreated', {
        detail: {
          projectId: task.projectId,
          task: subtaskWithProjectCode
        }
      }))

      // Reload subtasks locally to show in the subtasks table
      await loadSubtasks()
    } catch (error) {
      console.error('Error creating subtask:', error)
      toast.error('Failed to create subtask')
      setIsCreatingSubtask(false)
    }
  }

  const handleTaskNavigate = (taskId: string, targetProjectId?: string) => {
    if (!taskId) return
    const finalProjectId = targetProjectId || project?.id || task.projectId
    router.push(`/projects/${finalProjectId}/tasks/${taskId}`)
  }

  const handleSubtaskClick = (subtask: GeneratedTask) => {
    handleTaskNavigate(subtask.id, subtask.projectId)
  }

  const handleBackToParent = async () => {
    if (!parentTask || !companyId) return

    try {
      setIsLoadingSubtask(true)

      // Reload parent task to get latest data
      const parentTaskData = await TaskTemplateService.getTask(companyId, parentTask.id, groupId ?? undefined)

      if (parentTaskData) {
        // Restore parent task
        setTask(parentTaskData)
        setEditingTitle(parentTaskData.title)
        setEditingDescription(parentTaskData.description || '')
        setAttachments(parentTaskData.attachments || [])
        setParentTask(null)

        // Don't update URL - keep it on the same page
        // Subtasks will be reloaded automatically by useEffect when task.id changes
      }
    } catch (error) {
      console.error('Error loading parent task:', error)
      toast.error('Failed to load parent task')
    } finally {
      setIsLoadingSubtask(false)
    }
  }

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      router.back()
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-sky-100 text-sky-700 border-sky-300'
      case 'assigned':
        return 'bg-blue-100 text-blue-700 border-blue-300'
      case 'in_progress':
        return 'bg-amber-100 text-amber-700 border-amber-300'
      case 'on_hold':
        return 'bg-orange-100 text-orange-700 border-orange-300'
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 border-emerald-300'
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-300'
      case 'escalated':
        return 'bg-purple-100 text-purple-700 border-purple-300'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive'
      case 'high':
        return 'default'
      case 'medium':
        return 'secondary'
      case 'low':
        return 'outline'
      default:
        return 'outline'
    }
  }


  const formatDateForInput = (dateVal: string | Date | undefined | null) => {
    if (!dateVal) return ''
    const date = new Date(dateVal)
    if (isNaN(date.getTime())) return ''
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getUserName = (userId: string | undefined) => {
    if (!userId) return 'Unknown User'
    const user = users.find(u => u.id === userId)
    return user?.name || userId
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Premium Task Detail Header */}
      <div className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-20 px-8 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 min-w-0">
            {/* Breadcrumbs with Project / Task ID */}
            <TaskBreadcrumb
              task={task}
              parentTask={parentTask}
              project={project}
              companyId={companyId ?? undefined}
              companyDomain={currentCompany?.domain ?? undefined}
              onBack={handleBack}
              onNavigateToParent={() => {
                if (parentTask) {
                  router.push(`/projects/${project?.id}/tasks/${parentTask.id}`)
                }
              }}
            />

            {/* Combined Task Title - Large & Bold as per reference */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {isEditingTitle ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Input
                    ref={titleInputRef}
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSaveTitle()
                      } else if (e.key === 'Escape') {
                        handleCancelTitle()
                      }
                    }}
                    className="text-2xl font-bold flex-1 bg-slate-50 border-slate-200"
                    placeholder="Task title..."
                    disabled={isSavingTitle}
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveTitle}
                    disabled={isSavingTitle || !editingTitle.trim()}
                  >
                    {isSavingTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelTitle}
                    disabled={isSavingTitle}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h2
                    className={cn(
                      "text-2xl font-bold text-slate-900 truncate tracking-tight py-1 px-2 rounded-lg transition-colors",
                      canEditTask ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"
                    )}
                    onClick={() => canEditTask && setIsEditingTitle(true)}
                    title={canEditTask ? "Click to edit title" : "Title (Read Only)"}
                  >
                    {task.metadata?.isRecurring && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] h-4 px-1.5 uppercase font-bold shrink-0 inline-flex align-middle mr-2 mb-1">
                        Rec
                      </Badge>
                    )}
                    {task.title}
                  </h2>
                  <StarButton
                    isStarred={isStarred('task', task.id || '')}
                    onToggle={() => task.id && toggleStarred('task', task.id)}
                    size="md"
                  />
                  <TaskLastSeenAvatars
                    lastSeenBy={task.lastSeenBy || {}}
                    users={users}
                    currentUserId={currentUser?.id}
                  />
                </div>
              )}

              {task.isMilestone && (
                <Badge className={cn(
                  "flex items-center gap-1.5 px-3 py-1 font-bold text-[10px] uppercase tracking-wider",
                  getStatusColor(task.status)
                )}>
                  <Flag className="w-3 h-3" />
                  Milestone
                </Badge>
              )}

              {task.approvalStatus === 'pending' && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1.5 px-3 py-1 font-bold text-[10px] uppercase tracking-wider animate-pulse">
                  <ShieldCheck className="w-3 h-3" />
                  Pending Approval
                </Badge>
              )}

              {task.approvalStatus === 'approved' && (
                <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1.5 px-3 py-1 font-bold text-[10px] uppercase tracking-wider">
                  <CheckCircle className="w-3 h-3" />
                  Approved
                </Badge>
              )}

              {task.approvalStatus === 'rejected' && (
                <Badge className="bg-red-100 text-red-800 border-red-200 flex items-center gap-1.5 px-3 py-1 font-bold text-[10px] uppercase tracking-wider">
                  <AlertCircle className="w-3 h-3" />
                  Rejected
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Action buttons removed from header for cleaner UI */}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-ultrathin">
        <div className="mx-auto py-6 px-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Side - Main Content */}
            <div className="flex-1 min-w-0">
              <div className="bg-card rounded-lg border shadow-sm p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="details">
                      <FileText className="h-4 w-4 mr-2" />
                      Details
                    </TabsTrigger>
                    <TabsTrigger value="comments">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Comments
                    </TabsTrigger>
                    <TabsTrigger value="activity">
                      <Clock className="h-4 w-4 mr-2" />
                      Activity
                    </TabsTrigger>

                    <TabsTrigger value="attachments">
                      <Paperclip className="h-4 w-4 mr-2" />
                      Attachments
                      {attachments.length > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-muted rounded-full">
                          {attachments.length}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-6 mt-0">
                    {/* Rejection Alert Panel */}
                    {task.approvalStatus === 'rejected' && (() => {
                      // Find the approver who rejected
                      let rejectorInfo: { name: string; position: string; comments: string; date: string } | null = null
                      let isReporterRejection = false

                      // Check if this is a reporter approval rejection
                      const isReporterApproval = isSystemReporterApprovalLine(task.workflowDefinitionId) || task.requiresReporterApproval

                      if (isReporterApproval && task.reporterApprovalHistory?.length) {
                        // Get the last rejection from reporter approval history
                        const lastRejection = [...task.reporterApprovalHistory]
                          .reverse()
                          .find(h => h.decision === 'rejected')
                        if (lastRejection) {
                          isReporterRejection = true
                          rejectorInfo = {
                            name: task.reporterName || 'Reporter',
                            position: 'Task Reporter',
                            comments: lastRejection.comments || '',
                            date: lastRejection.decidedAt || ''
                          }
                        }
                      } else if (approvalInstance?.stageInstances) {
                        // Standard approval rejection - find from stage instances
                        for (const stage of approvalInstance.stageInstances) {
                          if (stage.status === 'rejected' && stage.assignedApprovers) {
                            const rejector = stage.assignedApprovers.find(
                              (a: any) => a.status === 'rejected' || a.decision === 'rejected'
                            )
                            if (rejector) {
                              rejectorInfo = {
                                name: rejector.userName || 'Unknown',
                                position: rejector.positionTitle || 'Unknown Position',
                                comments: rejector.comments || stage.decisionReason || '',
                                date: rejector.respondedAt || stage.completedAt || ''
                              }
                              break
                            }
                          }
                        }
                      }

                      // Check for system auto-rejection
                      const isSystemRejection = approvalInstance?.finalDecisionBy === 'system_escalation'

                      return (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-red-800">Task Approval Rejected</h4>
                              <p className="text-sm text-red-700 mt-1">
                                {rejectorInfo?.comments || task.approvalNotes || approvalInstance?.finalComments || 'No rejection reason provided.'}
                              </p>
                              <div className="mt-3 p-3 bg-red-100/50 rounded-md">
                                {isSystemRejection ? (
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-red-600" />
                                    <div>
                                      <p className="text-sm font-medium text-red-800">System (Auto-Rejected via Escalation)</p>
                                      <p className="text-xs text-red-600">Automatically rejected due to escalation timeout</p>
                                    </div>
                                  </div>
                                ) : rejectorInfo ? (
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-red-600" />
                                    <div>
                                      <p className="text-sm font-medium text-red-800">{rejectorInfo.name}</p>
                                      <p className="text-xs text-red-600">{rejectorInfo.position}</p>
                                    </div>
                                    {rejectorInfo.date && (
                                      <span className="ml-auto text-xs text-red-500">
                                        {formatDateTime(rejectorInfo.date)}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-red-600">Decision maker information unavailable</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 pt-2 border-t border-red-200">
                            <Button
                              onClick={handleResubmitForApproval}
                              disabled={isResubmitting || (!task.workflowDefinitionId && !task.requiresReporterApproval)}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              {isResubmitting ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Resubmitting...
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Resubmit for Approval
                                </>
                              )}
                            </Button>
                            <span className="text-xs text-red-600">
                              Click to start a new approval process
                            </span>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Approval Success Alert */}
                    {task.approvalStatus === 'approved' && (() => {
                      // Find the final approver from stage instances
                      let approverInfo: { name: string; position: string; comments: string; date: string } | null = null

                      if (approvalInstance?.stageInstances) {
                        // Get the last approved stage
                        const approvedStages = approvalInstance.stageInstances.filter((s: any) => s.status === 'approved')
                        const lastApprovedStage = approvedStages[approvedStages.length - 1]

                        if (lastApprovedStage?.assignedApprovers) {
                          const approver = lastApprovedStage.assignedApprovers.find(
                            (a: any) => a.status === 'approved' || a.decision === 'approved'
                          )
                          if (approver) {
                            approverInfo = {
                              name: approver.userName || 'Unknown',
                              position: approver.positionTitle || 'Unknown Position',
                              comments: approver.comments || '',
                              date: approver.respondedAt || lastApprovedStage.completedAt || ''
                            }
                          }
                        }
                      }

                      // Check for system auto-approval
                      const isSystemApproval = approvalInstance?.finalDecisionBy === 'system_escalation' || task.approvedBy === 'system_escalation'

                      return (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-green-800">Task Approved</h4>
                              <p className="text-sm text-green-700 mt-1">
                                {approverInfo?.comments || task.approvalNotes || 'This task has been approved.'}
                              </p>
                              <div className="mt-3 p-3 bg-green-100/50 rounded-md">
                                {isSystemApproval ? (
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-green-600" />
                                    <div>
                                      <p className="text-sm font-medium text-green-800">System (Auto-Approved via Escalation)</p>
                                      <p className="text-xs text-green-600">Automatically approved due to escalation timeout</p>
                                    </div>
                                  </div>
                                ) : approverInfo ? (
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-green-600" />
                                    <div>
                                      <p className="text-sm font-medium text-green-800">{approverInfo.name}</p>
                                      <p className="text-xs text-green-600">{approverInfo.position}</p>
                                    </div>
                                    {approverInfo.date && (
                                      <span className="ml-auto text-xs text-green-500">
                                        {formatDateTime(approverInfo.date)}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-green-600">Approval confirmed</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Approval History Section - Only show if there are multiple attempts */}
                    {approvalHistory.length > 1 && (
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setShowApprovalHistory(!showApprovalHistory)}
                          className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-slate-500" />
                            <span className="text-sm font-medium text-slate-700">
                              Approval History ({approvalHistory.length} attempts)
                            </span>
                          </div>
                          {showApprovalHistory ? (
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          )}
                        </button>

                        {showApprovalHistory && (
                          <div className="p-3 space-y-3 bg-white">
                            {approvalHistory.map((instance, index) => {
                              // Find the decision maker from stage instances
                              let decisionMaker: { name: string; position: string; date: string } | null = null
                              if (instance.stageInstances) {
                                for (const stage of instance.stageInstances) {
                                  if ((stage.status === 'approved' || stage.status === 'rejected') && stage.assignedApprovers) {
                                    const decider = stage.assignedApprovers.find(
                                      (a: any) => a.status === 'approved' || a.status === 'rejected' || a.decision
                                    )
                                    if (decider) {
                                      decisionMaker = {
                                        name: decider.userName || 'Unknown',
                                        position: decider.positionTitle || 'Unknown Position',
                                        date: decider.respondedAt || stage.completedAt || ''
                                      }
                                    }
                                  }
                                }
                              }

                              const isSystemDecision = instance.finalDecisionBy === 'system_escalation'
                              const isCurrentVersion = instance.id === task.approvalInstanceId

                              return (
                                <div
                                  key={instance.id}
                                  className={cn(
                                    "p-3 rounded-lg border",
                                    instance.status === 'approved' ? "bg-green-50/50 border-green-200" :
                                      instance.status === 'rejected' ? "bg-red-50/50 border-red-200" :
                                        instance.status === 'in_progress' ? "bg-blue-50/50 border-blue-200" :
                                          "bg-slate-50 border-slate-200",
                                    isCurrentVersion && "ring-2 ring-primary/30"
                                  )}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-[10px] font-bold">
                                        V{index + 1}
                                      </Badge>
                                      <Badge
                                        className={cn(
                                          "text-[10px] uppercase",
                                          instance.status === 'approved' ? "bg-green-500 text-white" :
                                            instance.status === 'rejected' ? "bg-red-500 text-white" :
                                              instance.status === 'in_progress' ? "bg-blue-500 text-white" :
                                                "bg-slate-500 text-white"
                                        )}
                                      >
                                        {instance.status.replace('_', ' ')}
                                      </Badge>
                                      {isCurrentVersion && (
                                        <Badge variant="outline" className="text-[10px] text-primary border-primary">
                                          Current
                                        </Badge>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-slate-500">
                                      {formatDateTime(instance.createdAt)}
                                    </span>
                                  </div>

                                  {/* Decision Maker Info */}
                                  {(instance.status === 'approved' || instance.status === 'rejected') && (
                                    <div className="flex items-center gap-2 text-xs mt-2">
                                      {isSystemDecision ? (
                                        <>
                                          <Clock className="w-3 h-3 text-slate-500" />
                                          <span className="text-slate-600">System (Auto-{instance.status} via Escalation)</span>
                                        </>
                                      ) : decisionMaker ? (
                                        <>
                                          <User className="w-3 h-3 text-slate-500" />
                                          <span className="font-medium text-slate-700">{decisionMaker.name}</span>
                                          <span className="text-slate-400">•</span>
                                          <span className="text-slate-500">{decisionMaker.position}</span>
                                        </>
                                      ) : null}
                                    </div>
                                  )}

                                  {/* Comments if any */}
                                  {instance.finalComments && (
                                    <p className="text-xs text-slate-600 mt-2 italic">
                                      "{instance.finalComments}"
                                    </p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Description */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-900">Description</h3>
                        {(!isEditingDescription && canEditTask) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditingDescription(true)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        )}
                      </div>
                      {isEditingDescription ? (
                        <div className="space-y-2">
                          <Textarea
                            ref={descriptionTextareaRef}
                            value={editingDescription}
                            onChange={(e) => setEditingDescription(e.target.value)}
                            className="min-h-[200px] font-normal"
                            placeholder="Add a description..."
                            disabled={isSavingDescription}
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={handleSaveDescription}
                              disabled={isSavingDescription}
                            >
                              {isSavingDescription ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4 mr-2" />
                                  Save
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelDescription}
                              disabled={isSavingDescription}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "text-sm text-gray-600 whitespace-pre-wrap min-h-[100px] p-4 bg-gray-50 rounded-md border",
                            canEditTask ? "cursor-pointer hover:bg-gray-100 transition-colors" : "cursor-default"
                          )}
                          onClick={() => canEditTask && setIsEditingDescription(true)}
                          title={canEditTask ? "Click to edit" : "Description (Read Only)"}
                        >
                          {task.description || 'No description provided.'}
                        </div>
                      )}
                    </div>

                    {/* Details - Simplified without category check */}
                    <div className="border-t pt-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4">Details</h3>
                      <div className="grid grid-cols-3 gap-4 text-sm">


                        {/* Estimated Hours */}
                        <div className="col-span-1">
                          <label className="text-gray-500 block mb-2">Estimated Hours:</label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={task.estimatedHours}
                              onChange={(e) => handleFieldChange('estimatedHours', Number(e.target.value))}
                              disabled={isSavingField === 'estimatedHours' || !canEditTask}
                              className="w-full"
                            />
                            {isSavingField === 'estimatedHours' && (
                              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                            )}
                          </div>
                        </div>

                        {/* Progress */}
                        {task.progress !== undefined && (
                          <div className="col-span-2">
                            <label className="text-gray-500 block mb-2">Progress:</label>
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="5"
                                  value={task.progress}
                                  onChange={(e) => handleFieldChange('progress', Number(e.target.value))}
                                  disabled={isSavingField === 'progress' || !canEditTask}
                                  className="w-24"
                                />
                                <span className="text-sm font-medium">{task.progress}%</span>
                                {isSavingField === 'progress' && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all"
                                  style={{ width: `${task.progress}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>


                    {/* Project Custom Fields */}
                    {projectFields && projectFields.length > 0 && (
                      <div className="border-t pt-6">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Custom Fields</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                          {projectFields.map((field) => {
                            // Use task value if set, otherwise fall back to project's default value
                            const taskValue = task.customFields?.[field.id]
                            const effectiveValue = (taskValue !== undefined && taskValue !== null && taskValue !== '')
                              ? taskValue
                              : project?.customFields?.[field.id]
                            return (
                              <div key={field.id} className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-gray-500 uppercase flex items-center justify-between">
                                  {field.definition.name}
                                  {isSavingField === field.id && (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  )}
                                </label>
                                <div className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-md px-3 py-1.5 transition-colors">
                                  <CustomFieldCell
                                    taskId={task.id}
                                    field={field.definition}
                                    value={effectiveValue}
                                    companyId={companyId || ''}
                                    projectId={task.projectId}
                                    task={task}
                                    allFields={projectFields}
                                    onValueChange={(value) => handleUpdateTaskCustomField(field.id, value)}
                                    disabled={!canEditTask}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Subtasks - Only show for main tasks, not subtasks */}
                    {!task.parentTaskId && (
                      <div className="border-t pt-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-gray-900">Subtasks</h3>
                          {canCreateSubtask && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setImportWizardOpen(true)}
                              className="text-xs flex items-center gap-2 h-7"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              Import Subtasks
                            </Button>
                          )}
                        </div>

                        {/* Create Subtask */}
                        {canCreateSubtask && (
                          <div className="mb-4">
                            <div className="flex items-center gap-2">
                              <Input
                                value={newSubtaskTitle}
                                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                                    handleCreateSubtask()
                                  }
                                }}
                                placeholder="Add a subtask..."
                                disabled={isCreatingSubtask || !canEditTask}
                                className="flex-1"
                              />
                              <Button
                                size="sm"
                                onClick={handleCreateSubtask}
                                disabled={!newSubtaskTitle.trim() || isCreatingSubtask || !canEditTask}
                              >
                                {isCreatingSubtask ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Plus className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Subtasks Table */}
                        {loadingSubtasks ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                          </div>
                        ) : subtasks.length > 0 ? (
                          <div className="border rounded-md">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Title</TableHead>
                                  <TableHead className="w-32">Assignee</TableHead>
                                  <TableHead className="w-32">Status</TableHead>
                                  <TableHead className="w-32">Priority</TableHead>
                                  <TableHead className="w-32">Due Date</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {subtasks.map((subtask) => {
                                  const assignee = users.find(u => u.id === subtask.assignedUserId)
                                  return (
                                    <TableRow
                                      key={subtask.id}
                                      className="cursor-pointer hover:bg-gray-50"
                                      onClick={() => handleSubtaskClick(subtask)}
                                    >
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-muted-foreground font-mono font-medium">
                                            {formatTaskId(subtask, project, companyId ?? undefined)}
                                          </span>
                                          <StarButton
                                            isStarred={isStarred('task', subtask.id)}
                                            onToggle={() => toggleStarred('task', subtask.id)}
                                            size="sm"
                                          />
                                          <p className={`text-sm font-medium ${subtask.status === 'completed'
                                            ? 'line-through text-gray-500'
                                            : 'text-gray-900'
                                            }`}>
                                            {subtask.title}
                                          </p>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        {assignee ? (
                                          <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
                                              {(assignee.name || assignee.id).charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-sm truncate max-w-[100px]">
                                              {assignee.name || assignee.id}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-sm text-muted-foreground">Unassigned</span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          {subtask.status.replace('_', ' ')}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        {subtask.priority && (
                                          <Badge
                                            variant={getPriorityColor(subtask.priority)}
                                            className="text-xs"
                                          >
                                            {subtask.priority}
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <span className="text-sm text-gray-600">
                                          {formatDate(subtask.dueDate)}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 py-4 text-center">
                            No subtasks yet. Create one above.
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="comments" className="mt-0">
                    {companyId && currentUser && (
                      <TaskComments
                        companyId={companyId}
                        taskId={task.id}
                        groupId={groupId}
                        currentUserId={currentUser.id}
                        currentUserName={currentUser.name || currentUser.email}
                        currentUserEmail={currentUser.email}
                        currentUserAvatar={currentUser.avatar}
                        project={project}
                        reporterId={task.reporter}
                        workspaceMembers={workspace?.members}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="activity" className="mt-0">
                    {/* Simple Activity Timeline */}
                    {companyId && (
                      <SimpleActivityTimeline
                        companyId={companyId}
                        taskId={task.id}
                        task={task}
                        getUserName={getUserName}
                        groupId={groupId}
                      />
                    )}
                  </TabsContent>



                  <TabsContent value="attachments" className="mt-0">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Upload Attachments</h3>
                        {companyId && currentUser?.id && (
                          <TaskAttachmentUpload
                            taskId={task.id}
                            companyId={companyId}
                            projectId={project?.id || task.projectId}
                            userId={currentUser.id}
                            groupId={groupId}
                            onUploadComplete={(newAttachments) => {
                              setAttachments(prev => [...prev, ...newAttachments])
                              setTask(prev => ({
                                ...prev,
                                attachments: [...(prev.attachments || []), ...newAttachments]
                              }))
                            }}
                          />
                        )}
                      </div>

                      <div className="border-t pt-6">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">
                          Attachments ({attachments.length})
                        </h3>
                        {loadingAttachments ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                            <p className="text-sm">Loading attachments...</p>
                          </div>
                        ) : companyId ? (
                          <TaskAttachmentsList
                            attachments={attachments}
                            taskId={task.id}
                            companyId={companyId}
                            onDelete={(deletedAttachment) => {
                              if (!canEditTask) {
                                toast.error('You do not have permission to delete attachments on this task')
                                return
                              }
                              setAttachments(prev => prev.filter(att => att.id !== deletedAttachment.id))
                              setTask(prev => ({
                                ...prev,
                                attachments: (prev.attachments || []).filter(att => att.id !== deletedAttachment.id)
                              }))
                            }}
                          />
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Company ID not available</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* Right Side - Metadata */}
            <div className="w-full lg:w-80 flex-shrink-0">
              <div className="bg-card rounded-lg border shadow-sm p-6 sticky top-24">
                <div className="space-y-6">
                  {/* Status */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                      Status
                      {isSavingField === 'status' && (
                        <Loader2 className="h-3 w-3 ml-2 inline animate-spin" />
                      )}
                    </label>
                    <div className="space-y-2">
                      <Select
                        value={task.status}
                        onValueChange={(newStatus) => {
                          handleStatusChange(newStatus as GeneratedTask['status'])
                        }}
                        disabled={isSavingField === 'status' || task.approvalStatus === 'pending'}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="assigned">Assigned</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          {/* Only show Approval Required when reporter approval is enabled */}
                          {(isSystemReporterApprovalLine(task.workflowDefinitionId) || task.requiresReporterApproval) && (
                            <SelectItem value="approval_required">
                              Approval Required
                            </SelectItem>
                          )}
                          <SelectItem value="completed" disabled={task.status === 'assigned'}>Completed</SelectItem>
                          <SelectItem value="cancelled" disabled={task.status === 'assigned'}>Cancelled</SelectItem>
                        </SelectContent>
                      </Select>

                      {task.approvalStatus === 'pending' && (
                        <div className="flex items-center gap-1.5 text-[10px] text-blue-600 font-medium bg-blue-50 p-2 rounded-md border border-blue-100 italic">
                          <ShieldCheck className="w-3 h-3" />
                          Approval process active. Status locked.
                        </div>
                      )}

                      {/* Start Task Button - Only show when status is 'assigned' */}
                      {task.status === 'assigned' && (
                        <Button
                          size="sm"
                          className="w-full bg-primary hover:bg-primary/90"
                          onClick={() => handleStatusChange('in_progress')}
                          disabled={isSavingField === 'status' || task.approvalStatus === 'pending'}
                        >
                          <Play className="h-3 w-3 mr-2" />
                          Start Task
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                      Priority
                      {isSavingField === 'priority' && (
                        <Loader2 className="h-3 w-3 ml-2 inline animate-spin" />
                      )}
                    </label>
                    <Select
                      value={task.priority}
                      onValueChange={handlePriorityChange}
                      disabled={isSavingField === 'priority' || !canEditTask}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent side="bottom" sideOffset={4} avoidCollisions={false}>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assignee */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                      Assignee
                      {isSavingField === 'assignedUserId' && (
                        <Loader2 className="h-3 w-3 ml-2 inline animate-spin" />
                      )}
                    </label>
                    <MemberSelect
                      value={assigneeSelection}
                      onValueChange={(selected) => {
                        setAssigneeSelection(selected)
                        if (!selected) {
                          handleMultipleFieldsChange({
                            assignedUserId: null,
                            assignedTo: null,
                            assignedPositionId: null,
                            assignedToName: null
                          })
                          return
                        }

                        if (selected.type === 'position') {
                          handleMultipleFieldsChange({
                            assignedPositionId: selected.id,
                            assignedUserId: selected.userId,
                            assignedTo: selected.userId,
                            assignedToName: selected.label
                          })
                        } else {
                          handleMultipleFieldsChange({
                            assignedUserId: selected.id,
                            assignedTo: selected.id,
                            assignedPositionId: null,
                            assignedToName: selected.label
                          })
                        }
                      }}
                      className="w-full"
                      placeholder="Select assignee..."
                      includePositions={false}
                      allowedUserIds={project ? Array.from(new Set([
                        ...(project.manager ? [project.manager] : []),
                        ...(project.createdBy ? [project.createdBy] : []),
                        ...(project.team || []),
                        ...(project.projectType === 'rft' ? (workspace?.members || []) : [])
                      ])) : undefined}
                      includeUsers={true}
                      disabled={isSavingField === 'assignedUserId' || !canEditTask}
                    />
                  </div>

                  {/* Reporter */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                      Reporter
                      {isSavingField === 'reporter' && (
                        <Loader2 className="h-3 w-3 ml-2 inline animate-spin" />
                      )}
                    </label>
                    <MemberSelect
                      value={reporterSelection}
                      onValueChange={(selected) => {
                        setReporterSelection(selected)
                        if (!selected) {
                          handleMultipleFieldsChange({
                            reporter: null,
                            reporterPositionId: null
                          })
                          return
                        }

                        if (selected.type === 'position') {
                          handleMultipleFieldsChange({
                            reporterPositionId: selected.id,
                            reporter: selected.userId
                          })
                        } else {
                          handleMultipleFieldsChange({
                            reporter: selected.id,
                            reporterPositionId: null
                          })
                        }
                      }}
                      className="w-full"
                      placeholder="Select reporter..."
                      includePositions={false}
                      allowedUserIds={project ? Array.from(new Set([
                        ...(project.manager ? [project.manager] : []),
                        ...(project.createdBy ? [project.createdBy] : []),
                        ...(project.team || [])
                      ])) : undefined}
                      includeUsers={true}
                      disabled={isSavingField === 'reporter' || !canEditTask}
                    />
                  </div>

                  {/* Start Date */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                      Start Date
                      {isSavingField === 'startDate' && (
                        <Loader2 className="h-3 w-3 ml-2 inline animate-spin" />
                      )}
                      <span className="text-xs text-muted-foreground font-normal ml-1 normal-case">(Optional)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={formatDateForInput(task.startDate)}
                        onChange={(e) => handleFieldChange('startDate', e.target.value || null)}
                        disabled={isSavingField === 'startDate' || !canEditTask}
                        max={formatDateForInput(task.endDate || task.dueDate)}
                        className="flex-1"
                      />
                      {task.startDate && (
                        <button
                          type="button"
                          onClick={() => handleFieldChange('startDate', null)}
                          className="text-xs text-muted-foreground hover:text-destructive"
                          disabled={isSavingField === 'startDate' || !canEditTask}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* End Date / Due Date - Show endDate if available (matches WBS), otherwise dueDate */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                      {task.endDate ? 'End Date' : 'Due Date'}
                      {isSavingField === 'dueDate' || isSavingField === 'endDate' ? (
                        <Loader2 className="h-3 w-3 ml-2 inline animate-spin" />
                      ) : null}
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={formatDateForInput(task.endDate || task.dueDate)}
                        onChange={(e) => {
                          const newValue = e.target.value
                          // Update both endDate and dueDate to keep them in sync
                          handleFieldChange('endDate', newValue)
                        }}
                        disabled={(isSavingField === 'dueDate' || isSavingField === 'endDate') || !canEditTask}
                        min={formatDateForInput(task.startDate)}
                        className="flex-1"
                      />
                    </div>
                    {((task.endDate || task.dueDate) && new Date(task.endDate || task.dueDate!) < new Date() && task.status !== 'completed') && (
                      <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        <span>Overdue</span>
                      </div>
                    )}
                  </div>

                  {/* Actual Dates Section - Read-only display */}
                  {(task.actualStartDate || task.actualEndDate) && (
                    <div className="border-t pt-4">
                      <label className="text-xs font-semibold text-gray-500 uppercase mb-3 block">
                        Actual Dates
                      </label>
                      <div className="space-y-3 text-sm">
                        {/* Actual Start Date */}
                        {task.actualStartDate && (
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <Play className="h-3 w-3 text-blue-600" />
                            </div>
                            <div>
                              <span className="text-gray-500 block text-xs">Started</span>
                              <span className="font-medium text-gray-900">
                                {new Date(task.actualStartDate).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false
                                })}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Actual End Date */}
                        {task.actualEndDate && (
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            </div>
                            <div>
                              <span className="text-gray-500 block text-xs">Completed</span>
                              <span className="font-medium text-gray-900">
                                {new Date(task.actualEndDate).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false
                                })}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="col-span-2 border-t pt-4 mt-2">
                          <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                            Approval Line
                            {isSystemReporterApprovalLine(task.workflowDefinitionId) && (
                              <Badge variant="secondary" className="ml-2 text-[9px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-200">
                                System
                              </Badge>
                            )}
                          </label>
                          {/* Approval line is READ-ONLY after task creation */}
                          <div className={cn(
                            "flex items-center gap-2 px-3 py-2 border rounded-md text-sm",
                            isSystemReporterApprovalLine(task.workflowDefinitionId)
                              ? "bg-purple-50 border-purple-200 text-purple-700"
                              : "bg-slate-100 border-slate-200 text-slate-700"
                          )}>
                            {task.workflowDefinitionId ? (
                              isSystemReporterApprovalLine(task.workflowDefinitionId)
                                ? 'Reporter Approval'
                                : (approvalLines.find(l => l.id === task.workflowDefinitionId)?.name || 'Unknown')
                            ) : (
                              <span className="text-slate-500">None (Direct Complete)</span>
                            )}
                          </div>
                        </div>

                        <div className="col-span-2 border-t pt-3 mt-1">
                          <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                            Escalation Policy
                          </label>
                          {/* Escalation policy is READ-ONLY after task creation */}
                          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-sm text-slate-700">
                            {task.escalationPolicyId ? (
                              escalationPaths.find(p => p.id === task.escalationPolicyId)?.name || 'Unknown'
                            ) : (
                              <span className="text-slate-500">None</span>
                            )}
                          </div>
                          {/* Escalation Status - Compact version for sidebar */}
                          {task.escalationPolicyId && companyId && (
                            <div className="mt-3">
                              <EscalationStatusDisplay
                                companyId={companyId}
                                taskId={task.id}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Time Tracking */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                      Time Tracking
                    </label>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Estimated:</span>
                        <span className="font-medium">{task.estimatedHours}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Logged:</span>
                        <span className="font-medium">{task.actualHours || 0}h</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, ((task.actualHours || 0) / (task.estimatedHours || 1)) * 100)}%`
                          }}
                        />
                      </div>

                      <ShadcnTooltipProvider>
                        <ShadcnTooltip>
                          <ShadcnTooltipTrigger asChild>
                            <div className="w-full">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full mt-2"
                                disabled={!['open', 'assigned', 'in_progress'].includes(task.status)}
                                onClick={() => setIsLogTimeDrawerOpen(true)}
                              >
                                <Clock className="h-3 w-3 mr-2" />
                                Log Time
                              </Button>
                            </div>
                          </ShadcnTooltipTrigger>
                          {!['open', 'assigned', 'in_progress'].includes(task.status) && (
                            <ShadcnTooltipContent>
                              <p>Time can't be logged because this task is {task.status}.</p>
                            </ShadcnTooltipContent>
                          )}
                        </ShadcnTooltip>
                      </ShadcnTooltipProvider>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase">
                        Dependencies
                      </label>
                      {isSavingField === 'dependencies' && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                    </div>

                    {task.dependencies && task.dependencies.length > 0 ? (
                      <div className="space-y-2 mb-3 max-h-[300px] overflow-y-auto scrollbar-ultrathin pr-1">
                        {(task.dependencies || []).map((dep, idx) => {
                          const tTask = projectTasksState.find(t => t.id === dep.targetTaskId)
                          const lagDisplay = dep.lag > 0 ? `+${dep.lag}d` : dep.lag < 0 ? `${dep.lag}d` : '0d'
                          const taskDate = tTask?.startDate ? formatDate(tTask.startDate) : '---'

                          return (
                            <div
                              key={idx}
                              className="group flex flex-col gap-1 text-xs bg-gray-50/50 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                              onClick={() => handleTaskNavigate(dep.targetTaskId, tTask?.projectId)}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-blue-600 font-bold text-[10px] font-mono px-1.5 py-0.5 bg-blue-50 border border-blue-100 rounded">
                                  {formatTaskId((tTask || { id: dep.targetTaskId }) as any, project, companyId ?? undefined, currentCompany?.domain ?? undefined)}
                                </span>
                                <span className="text-gray-900 font-medium truncate flex-1" title={tTask?.title || 'Unknown Task'}>
                                  {tTask?.title || 'Unknown Task'}
                                </span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setEditingDependencyId(dep.targetTaskId)
                                      setIsDependencyDialogOpen(true)
                                    }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    className="p-1 text-slate-400 hover:text-destructive hover:bg-red-50 rounded transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const newDeps = (task.dependencies || []).filter(d => d.targetTaskId !== dep.targetTaskId)
                                      handleFieldChange('dependencies', newDeps)
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between px-0.5">
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                  <LinkIcon className="h-2.5 w-2.5" />
                                  <span className="font-medium text-slate-600">{DEP_TYPE_LABELS[dep.type] || dep.type}</span>
                                  <span className="text-slate-300">•</span>
                                  <span className={cn("px-1 rounded", dep.lag !== 0 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500")}>
                                    {lagDisplay} Lag
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 italic">{taskDate}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="py-4 text-center border-2 border-dashed border-slate-100 rounded-lg mb-3">
                        <p className="text-xs text-slate-400">No dependencies linked</p>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs font-medium border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600"
                      onClick={() => setIsDependencyDialogOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add Dependency
                    </Button>
                  </div>

                  <DependencyDialog
                    isOpen={isDependencyDialogOpen}
                    onClose={() => {
                      setIsDependencyDialogOpen(false)
                      setEditingDependencyId(null)
                    }}
                    sourceTask={task}
                    project={project}
                    availableTasks={projectTasksState}
                    initialEditTaskId={editingDependencyId}
                    companyId={companyId ?? undefined}
                    companyDomain={currentCompany?.domain ?? undefined}
                    onSave={(targetId, type, lag, originalTargetId) => {
                      const newDeps = [...(task.dependencies || [])];
                      const searchId = originalTargetId || targetId
                      const index = newDeps.findIndex(d => d.targetTaskId === searchId);

                      if (index >= 0) {
                        newDeps[index] = { targetTaskId: targetId, type, lag };
                      } else {
                        // Check for duplicates if adding new
                        if (newDeps.some(d => d.targetTaskId === targetId)) {
                          // Already exists, maybe update it?
                          // For safety, let's just update the existing one if it matches targetId
                          const existingIndex = newDeps.findIndex(d => d.targetTaskId === targetId);
                          newDeps[existingIndex] = { targetTaskId: targetId, type, lag };
                        } else {
                          newDeps.push({ targetTaskId: targetId, type, lag });
                        }
                      }
                      handleFieldChange('dependencies', newDeps);
                    }}
                    onDelete={(targetId) => {
                      if (!canEditTask) {
                        toast.error('You do not have permission to modify dependencies on this task')
                        return
                      }
                      const newDeps = (task.dependencies || []).filter(d => d.targetTaskId !== targetId);
                      handleFieldChange('dependencies', newDeps);
                    }}
                  />

                  {/* Dependency Warning Dialog - shown when status change blocked by dependencies */}
                  <DependencyWarningDialog
                    isOpen={dependencyWarningOpen}
                    onClose={() => {
                      setDependencyWarningOpen(false)
                      setPendingStatus(null)
                      setDependencyValidation(null)
                    }}
                    onProceed={handleDependencyWarningProceed}
                    validationResult={dependencyValidation}
                    taskTitle={task.title}
                    targetStatus={pendingStatus || ''}
                  />

                  {/* Linked Work Items (Interlinking) */}
                  <div className="border-t pt-4">
                    <LinkedWorkItemsList
                      taskId={task.id}
                      sourceProjectId={task.projectId}
                      companyId={companyId || ''}
                      groupId={groupId}
                      companyDomain={currentCompany?.domain ?? undefined}
                      userId={currentUser?.id || ''}
                      isGlobalAdmin={
                        ['admin', 'owner', 'manager'].includes(currentUser?.role?.toLowerCase() || '') ||
                        project?.manager === currentUser?.id
                      }
                      onTaskClick={(tid, pid) => handleTaskNavigate(tid, pid)}
                    />
                  </div>
                  {/* Created */}
                  <div className="border-t pt-4">
                    <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                      Created
                    </label>
                    <p className="text-sm">{formatDate(task.createdAt || new Date().toISOString())}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ImportWizard
          isOpen={importWizardOpen}
          onClose={() => setImportWizardOpen(false)}
          importType="subtasks"
          context={{
            companyId: companyId || '',
            projectId: task.projectId,
            userId: currentUser?.id || '',
            workspaceId: project?.workspaceId || ''
          }}
          onImported={() => {
            loadSubtasks();
          }}
        />
        {/* Redundant dialog removed - managed by LinkedWorkItemsList internally */}
        <LogTimeDrawer
          task={task}
          isOpen={isLogTimeDrawerOpen}
          onClose={() => setIsLogTimeDrawerOpen(false)}
          onSaveSuccess={async () => {
            const updated = await TaskTemplateService.getTask(companyId!, task.id, groupId ?? undefined)
            if (updated) setTask(updated)
            if (onUpdate) await onUpdate(updated as GeneratedTask)
          }}
        />
      </div>
    </div>
  )
}

// ============================================================================
// SIMPLE ACTIVITY TIMELINE - Clean, minimal design
// ============================================================================

interface SimpleActivityTimelineProps {
  companyId: string
  taskId: string
  task: GeneratedTask
  getUserName: (userId: string | undefined) => string
  groupId?: string | null
}

function SimpleActivityTimeline({ companyId, taskId, task, getUserName, groupId }: SimpleActivityTimelineProps) {
  const [activities, setActivities] = useState<TaskActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId || !taskId) return

    const unsubscribe = subscribeToTaskActivities(companyId, taskId, (newActivities) => {
      setActivities(newActivities)
      setLoading(false)
    }, groupId ?? undefined)

    return () => unsubscribe()
  }, [companyId, taskId, groupId])

  // Format date nicely
  const formatActivityDate = (dateStr: string) => {
    return formatDateTime(dateStr)
  }

  // Get icon and color for activity type
  const getActivityIcon = (activity: TaskActivity) => {
    switch (activity.type) {
      case 'task_created':
        return { icon: <CheckCircle className="h-3 w-3 text-green-600" />, bg: 'bg-green-100' }
      case 'task_started':
        return { icon: <Play className="h-3 w-3 text-blue-600" />, bg: 'bg-blue-100' }
      case 'task_completed':
        return { icon: <CheckCircle className="h-3 w-3 text-green-600" />, bg: 'bg-green-100' }
      case 'time_logged':
        return { icon: <Clock className="h-3 w-3 text-blue-600" />, bg: 'bg-blue-100' }
      case 'approval_workflow_started':
        return { icon: <Clock className="h-3 w-3 text-amber-600" />, bg: 'bg-amber-100' }
      case 'approval_stage_entered':
        return { icon: <Clock className="h-3 w-3 text-blue-600" />, bg: 'bg-blue-100' }
      case 'approval_decision':
        const isApproved = activity.approvalData?.decision === 'approved'
        return {
          icon: isApproved ? <CheckCircle className="h-3 w-3 text-green-600" /> : <AlertCircle className="h-3 w-3 text-red-600" />,
          bg: isApproved ? 'bg-green-100' : 'bg-red-100'
        }
      case 'approval_workflow_completed':
        return { icon: <CheckCircle className="h-3 w-3 text-green-600" />, bg: 'bg-green-100' }
      case 'approval_workflow_rejected':
        return { icon: <AlertCircle className="h-3 w-3 text-red-600" />, bg: 'bg-red-100' }
      // Escalation events
      case 'escalation_started':
        return { icon: <Clock className="h-3 w-3 text-orange-600" />, bg: 'bg-orange-100' }
      case 'escalation_level_entered':
        return { icon: <AlertCircle className="h-3 w-3 text-orange-600" />, bg: 'bg-orange-100' }
      case 'escalation_notification_sent':
        return { icon: <AlertCircle className="h-3 w-3 text-amber-600" />, bg: 'bg-amber-100' }
      case 'escalation_reassign':
        return { icon: <User className="h-3 w-3 text-orange-600" />, bg: 'bg-orange-100' }
      case 'escalation_auto_approve':
        return { icon: <CheckCircle className="h-3 w-3 text-green-600" />, bg: 'bg-green-100' }
      case 'escalation_auto_reject':
        return { icon: <AlertCircle className="h-3 w-3 text-red-600" />, bg: 'bg-red-100' }
      default:
        return { icon: <Clock className="h-3 w-3 text-gray-600" />, bg: 'bg-gray-100' }
    }
  }

  // Format activity description for simple display
  const getActivityText = (activity: TaskActivity): { actor: string; action: string } => {
    // For most activities, just use the description from the activity itself
    // This ensures consistency with what's stored in the database
    switch (activity.type) {
      case 'task_created':
      case 'task_started':
      case 'task_completed':
      case 'task_cancelled':
      case 'status_changed':
      case 'field_changed':
      case 'task_assigned':
      case 'task_reassigned':
      case 'task_unassigned':
        return { actor: activity.actorName || 'User', action: activity.description || 'performed an action' }
      case 'time_logged':
        return { actor: activity.actorName || 'User', action: activity.description || 'logged time' }
      case 'approval_workflow_started':
        return { actor: 'System', action: `started approval workflow "${activity.approvalData?.workflowName || 'Approval'}"` }
      case 'approval_stage_entered':
        const stageNum = activity.approvalData?.currentStageNumber || 0
        const stageName = activity.approvalData?.stageName || 'Stage'
        const pendingApprover = activity.approvalData?.pendingApproverName || 'approver'
        return { actor: 'System', action: `Stage ${stageNum}: ${stageName} - waiting for ${pendingApprover}` }
      case 'approval_decision':
        const isSystemApproval = activity.approvalData?.isSystemApproval ||
          activity.approvalData?.workflowId === '__SYSTEM_REPORTER_APPROVAL__' ||
          activity.approvalData?.stageName === 'Reporter Review'
        const decision = activity.approvalData?.decision === 'approved' ? 'APPROVED' : 'REJECTED'
        const comments = activity.approvalData?.comments
        if (isSystemApproval) {
          // Simplified message for reporter approval (no stage info)
          const actionText = comments
            ? `${decision} the task: "${comments}"`
            : `${decision} the task`
          return { actor: activity.actorName || 'Reporter', action: actionText }
        }
        const stageInfo = `Stage ${activity.approvalData?.currentStageNumber}: ${activity.approvalData?.stageName}`
        const actionWithComments = comments
          ? `${decision} - ${stageInfo}: "${comments}"`
          : `${decision} - ${stageInfo}`
        return { actor: activity.actorName || 'Approver', action: actionWithComments }
      case 'approval_workflow_completed':
        return { actor: 'System', action: 'All approval stages completed successfully' }
      case 'approval_workflow_rejected':
        return { actor: activity.actorName || 'Approver', action: `rejected at Stage ${activity.approvalData?.currentStageNumber}` }
      // Escalation events
      case 'escalation_started':
        return { actor: 'System', action: `started escalation "${activity.escalationData?.pathName || 'Escalation'}"` }
      case 'escalation_level_entered':
        return { actor: 'System', action: `escalation Level ${activity.escalationData?.currentLevelNumber}: ${activity.escalationData?.levelName}` }
      case 'escalation_notification_sent':
        return { actor: 'System', action: `Escalation notification sent to ${activity.escalationData?.targetUserName || 'user'}` }
      case 'escalation_reassign':
        const fromUser = activity.escalationData?.fromUserName || 'previous assignee'
        const toUser = activity.escalationData?.targetUserName || 'new assignee'
        return { actor: 'System', action: `Task reassigned: ${fromUser} → ${toUser}` }
      case 'escalation_auto_approve':
        return { actor: 'System', action: 'Task auto-approved via escalation' }
      case 'escalation_auto_reject':
        return { actor: 'System', action: 'Task auto-rejected via escalation' }
      default:
        return { actor: activity.actorName || 'System', action: activity.description || 'activity' }
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3">
            <div className="w-6 h-6 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Combine hardcoded lifecycle events with actual activities
  // Filter out duplicates and sort chronologically
  const allActivities = [...activities].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  // If no activities from Firestore, show basic lifecycle based on task state
  const hasActivities = allActivities.length > 0

  return (
    <div className="space-y-3">
      {/* If no activities from DB, show basic lifecycle */}
      {!hasActivities && (
        <>
          <div className="flex gap-3">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Play className="h-3 w-3 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm">
                <span className="font-medium">{task.reporterName || 'User'}</span>{' '}
                created task{task.assignedToName ? ` and assigned to ${task.assignedToName}` : ''}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatActivityDate(task.createdAt || new Date().toISOString())}
              </p>
            </div>
          </div>

          {task.status !== 'assigned' && (
            <div className="flex gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Play className="h-3 w-3 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-medium">{getUserName(task.assignedUserId)}</span> started working on this task
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Recently</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Real activities from Firestore */}
      {allActivities.map((activity) => {
        const { icon, bg } = getActivityIcon(activity)
        const { actor, action } = getActivityText(activity)

        return (
          <div key={activity.id} className="flex gap-3">
            <div className={`w-6 h-6 ${bg} rounded-full flex items-center justify-center flex-shrink-0`}>
              {icon}
            </div>
            <div className="flex-1">
              <p className="text-sm">
                <span className="font-medium">{actor}</span>{' '}
                <span className="text-gray-600">{action}</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatActivityDate(activity.createdAt)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
