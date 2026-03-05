/**
 * BPMN Service Interfaces
 *
 * Contract definitions for all BPMN-related services.
 * These interfaces define the expected behavior without implementation.
 *
 * @module types/bpmn-service-interfaces
 * @version 1.0.0
 * @since Stage 1 - Foundation & Contracts
 */

import type {
  FlowableWebhookEvent,
  FlowableEventType,
  WebhookProcessingResult,
  BpmnOutboxEvent,
  BpmnOutboxEventType,
  BpmnWorkflowInstance,
  BpmnWorkflowStepInstance,
  TaskEventPayload,
  ProcessEventPayload
} from './bpmn-events'

// =============================================================================
// WEBHOOK HANDLER SERVICE
// =============================================================================

/**
 * Interface for the Webhook Handler Service
 *
 * Responsible for:
 * - Receiving Flowable webhook events
 * - Validating and deduplicating events
 * - Routing events to appropriate handlers
 * - Maintaining audit trail
 */
export interface IBpmnWebhookService {
  /**
   * Process a webhook event from Flowable
   *
   * @param event - The webhook event
   * @param correlationId - Correlation ID for tracing
   * @returns Processing result
   */
  processWebhookEvent(
    event: FlowableWebhookEvent,
    correlationId: string
  ): Promise<WebhookProcessingResult>

  /**
   * Check if an event has already been processed (idempotency)
   *
   * @param companyId - Company ID
   * @param eventId - Event ID
   * @returns Whether the event is a duplicate
   */
  isDuplicateEvent(
    companyId: string,
    eventId: string
  ): Promise<boolean>

  /**
   * Log event for audit trail
   *
   * @param companyId - Company ID
   * @param event - The event to log
   * @param correlationId - Correlation ID
   */
  logEvent(
    companyId: string,
    event: FlowableWebhookEvent,
    correlationId: string
  ): Promise<void>

  /**
   * Mark event as processed
   *
   * @param companyId - Company ID
   * @param eventId - Event ID
   * @param result - Processing result
   */
  markEventProcessed(
    companyId: string,
    eventId: string,
    result: WebhookProcessingResult
  ): Promise<void>
}

/**
 * Event handler function signature
 */
export type WebhookEventHandler = (
  companyId: string,
  event: FlowableWebhookEvent,
  correlationId: string
) => Promise<WebhookProcessingResult>

/**
 * Registry of event handlers by event type
 */
export type WebhookEventHandlerRegistry = Partial<Record<FlowableEventType, WebhookEventHandler>>

// =============================================================================
// TASK CREATED HANDLER
// =============================================================================

/**
 * Interface for handling TASK_CREATED events
 */
export interface IBpmnTaskCreatedHandler {
  /**
   * Handle a TASK_CREATED event from Flowable
   *
   * Creates a generatedTask in Firestore linked to the Flowable task
   *
   * @param companyId - Company ID
   * @param payload - Task event payload
   * @param correlationId - Correlation ID
   */
  handleTaskCreated(
    companyId: string,
    payload: TaskEventPayload,
    correlationId: string
  ): Promise<{
    success: boolean
    taskId?: string
    error?: string
  }>

  /**
   * Resolve assignees for a task
   *
   * @param companyId - Company ID
   * @param payload - Task event payload
   * @param workflowInstance - Workflow instance
   */
  resolveAssignees(
    companyId: string,
    payload: TaskEventPayload,
    workflowInstance: BpmnWorkflowInstance
  ): Promise<{
    primaryUserId?: string
    positionId?: string
    candidateUserIds: string[]
  }>
}

// =============================================================================
// TASK COMPLETION SERVICE
// =============================================================================

/**
 * Options for completing a BPMN task
 */
export interface BpmnTaskCompletionOptions {
  /** Variables to pass to the next step */
  variables?: Record<string, any>
  /** Completion comments */
  comments?: string
  /** Whether to skip Flowable sync (for testing) */
  skipFlowableSync?: boolean
}

/**
 * Result of task completion
 */
export interface BpmnTaskCompletionResult {
  /** Whether completion succeeded */
  success: boolean
  /** Error message if failed */
  error?: string
  /** Outbox event ID (for tracking) */
  outboxEventId?: string
  /** Updated task status */
  taskStatus?: string
}

/**
 * Interface for the BPMN Task Service
 *
 * Responsible for:
 * - Completing BPMN tasks
 * - Claiming/unclaiming tasks
 * - Assigning tasks
 * - Syncing with Flowable
 */
export interface IBpmnTaskService {
  /**
   * Complete a BPMN task
   *
   * Updates Firestore immediately and queues Flowable completion
   *
   * @param companyId - Company ID
   * @param taskId - Task ID
   * @param userId - User completing the task
   * @param options - Completion options
   */
  completeTask(
    companyId: string,
    taskId: string,
    userId: string,
    options?: BpmnTaskCompletionOptions
  ): Promise<BpmnTaskCompletionResult>

  /**
   * Claim a task (assign to self from candidate pool)
   *
   * @param companyId - Company ID
   * @param taskId - Task ID
   * @param userId - User claiming the task
   */
  claimTask(
    companyId: string,
    taskId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }>

  /**
   * Unclaim a task (release back to candidate pool)
   *
   * @param companyId - Company ID
   * @param taskId - Task ID
   * @param userId - User unclaiming the task
   */
  unclaimTask(
    companyId: string,
    taskId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }>

  /**
   * Assign a task to another user
   *
   * @param companyId - Company ID
   * @param taskId - Task ID
   * @param assignerId - User making the assignment
   * @param assigneeId - User being assigned
   */
  assignTask(
    companyId: string,
    taskId: string,
    assignerId: string,
    assigneeId: string
  ): Promise<{ success: boolean; error?: string }>

  /**
   * Check if a task is a BPMN workflow task
   *
   * @param companyId - Company ID
   * @param taskId - Task ID
   */
  isBpmnTask(
    companyId: string,
    taskId: string
  ): Promise<boolean>

  /**
   * Get BPMN task details
   *
   * @param companyId - Company ID
   * @param taskId - Task ID
   */
  getBpmnTaskDetails(
    companyId: string,
    taskId: string
  ): Promise<{
    flowableTaskId?: string
    processInstanceId?: string
    workflowInstanceId?: string
    syncStatus?: string
  } | null>
}

// =============================================================================
// OUTBOX PROCESSOR SERVICE
// =============================================================================

/**
 * Options for processing outbox events
 */
export interface OutboxProcessingOptions {
  /** Maximum events to process in one batch */
  batchSize?: number
  /** Timeout for processing (ms) */
  timeout?: number
  /** Skip Flowable calls (for testing) */
  dryRun?: boolean
}

/**
 * Result of outbox processing
 */
export interface OutboxProcessingResult {
  /** Event ID that was processed */
  eventId: string
  /** Whether processing succeeded */
  success: boolean
  /** Error message if failed */
  error?: string
  /** Whether the event can be retried */
  retryable?: boolean
  /** Processing duration in ms */
  processingTimeMs: number
}

/**
 * Interface for the Outbox Processor Service
 *
 * Responsible for:
 * - Processing pending outbox events
 * - Calling Flowable API
 * - Handling retries
 * - Moving to DLQ on failure
 */
export interface IBpmnOutboxProcessor {
  /**
   * Process a single outbox event
   *
   * @param event - Outbox event to process
   * @param options - Processing options
   */
  processEvent(
    event: BpmnOutboxEvent,
    options?: OutboxProcessingOptions
  ): Promise<OutboxProcessingResult>

  /**
   * Process all pending outbox events for a company
   *
   * @param companyId - Company ID
   * @param options - Processing options
   */
  processPendingEvents(
    companyId: string,
    options?: OutboxProcessingOptions
  ): Promise<{
    processed: number
    failed: number
    results: OutboxProcessingResult[]
  }>

  /**
   * Handle COMPLETE_TASK event
   */
  handleCompleteTask(
    event: BpmnOutboxEvent,
    companyId: string
  ): Promise<void>

  /**
   * Handle CLAIM_TASK event
   */
  handleClaimTask(
    event: BpmnOutboxEvent,
    companyId: string
  ): Promise<void>

  /**
   * Handle START_PROCESS event
   */
  handleStartProcess(
    event: BpmnOutboxEvent,
    companyId: string
  ): Promise<void>

  /**
   * Move event to dead letter queue
   */
  moveToDeadLetterQueue(
    event: BpmnOutboxEvent,
    error: string
  ): Promise<void>
}

/**
 * Outbox event handler function signature
 */
export type OutboxEventHandler = (
  event: BpmnOutboxEvent,
  companyId: string
) => Promise<void>

/**
 * Registry of outbox handlers by event type
 */
export type OutboxEventHandlerRegistry = Partial<Record<BpmnOutboxEventType, OutboxEventHandler>>

// =============================================================================
// VARIABLE SERVICE
// =============================================================================

/**
 * Variable scope
 */
export type VariableScope = 'process' | 'task' | 'local'

/**
 * Variable type for serialization
 */
export type VariableType =
  | 'string'
  | 'integer'
  | 'long'
  | 'double'
  | 'boolean'
  | 'date'
  | 'json'
  | 'null'

/**
 * Interface for the BPMN Variable Service
 *
 * Responsible for:
 * - Managing process variables
 * - Variable sync between Firestore and Flowable
 * - Condition evaluation
 */
export interface IBpmnVariableService {
  /**
   * Get all variables for a workflow instance
   *
   * @param companyId - Company ID
   * @param workflowInstanceId - Workflow instance ID
   */
  getProcessVariables(
    companyId: string,
    workflowInstanceId: string
  ): Promise<Record<string, any>>

  /**
   * Set a process variable
   *
   * @param companyId - Company ID
   * @param workflowInstanceId - Workflow instance ID
   * @param name - Variable name
   * @param value - Variable value
   * @param type - Variable type (optional)
   */
  setProcessVariable(
    companyId: string,
    workflowInstanceId: string,
    name: string,
    value: any,
    type?: VariableType
  ): Promise<void>

  /**
   * Set multiple process variables
   *
   * @param companyId - Company ID
   * @param workflowInstanceId - Workflow instance ID
   * @param variables - Variables to set
   */
  setProcessVariables(
    companyId: string,
    workflowInstanceId: string,
    variables: Record<string, any>
  ): Promise<void>

  /**
   * Get a task-local variable
   *
   * @param companyId - Company ID
   * @param taskId - Task ID
   * @param name - Variable name
   */
  getTaskVariable(
    companyId: string,
    taskId: string,
    name: string
  ): Promise<any>

  /**
   * Set a task-local variable
   *
   * @param companyId - Company ID
   * @param taskId - Task ID
   * @param name - Variable name
   * @param value - Variable value
   */
  setTaskVariable(
    companyId: string,
    taskId: string,
    name: string,
    value: any
  ): Promise<void>

  /**
   * Evaluate a condition expression
   *
   * @param expression - Condition expression
   * @param variables - Variables for evaluation
   */
  evaluateCondition(
    expression: string,
    variables: Record<string, any>
  ): boolean

  /**
   * Substitute variables in a template string
   *
   * @param template - Template string (e.g., "Hello ${name}")
   * @param variables - Variables for substitution
   */
  substituteVariables(
    template: string,
    variables: Record<string, any>
  ): string
}

// =============================================================================
// ESCALATION SERVICE
// =============================================================================

/**
 * Escalation check result
 */
export interface EscalationCheckResult {
  /** Whether escalation should occur */
  shouldEscalate: boolean
  /** Escalation rule that matched */
  matchedRule?: {
    id: string
    action: string
    targetLevel?: number
  }
  /** Time until next escalation (ms) */
  timeUntilNextEscalation?: number
}

/**
 * Interface for BPMN Escalation Service
 *
 * Responsible for:
 * - Checking BPMN tasks for escalation
 * - Executing escalation actions
 * - Recording escalation history
 */
export interface IBpmnEscalationService {
  /**
   * Register a BPMN task for escalation monitoring
   *
   * @param companyId - Company ID
   * @param taskId - Task ID
   * @param escalationPathId - Escalation path to use
   * @param dueDate - Task due date
   */
  registerForEscalation(
    companyId: string,
    taskId: string,
    escalationPathId: string,
    dueDate: string
  ): Promise<void>

  /**
   * Check if a task should be escalated
   *
   * @param companyId - Company ID
   * @param taskId - Task ID
   */
  checkEscalation(
    companyId: string,
    taskId: string
  ): Promise<EscalationCheckResult>

  /**
   * Execute escalation for a task
   *
   * @param companyId - Company ID
   * @param taskId - Task ID
   * @param escalationRule - Rule to execute
   */
  executeEscalation(
    companyId: string,
    taskId: string,
    escalationRule: EscalationCheckResult['matchedRule']
  ): Promise<void>

  /**
   * Cancel escalation monitoring for a task
   *
   * @param companyId - Company ID
   * @param taskId - Task ID
   */
  cancelEscalation(
    companyId: string,
    taskId: string
  ): Promise<void>

  /**
   * Process all pending BPMN escalations for a company
   *
   * @param companyId - Company ID
   */
  processPendingEscalations(
    companyId: string
  ): Promise<{
    checked: number
    escalated: number
  }>
}

// =============================================================================
// WORKFLOW ORCHESTRATOR
// =============================================================================

/**
 * Workflow execution mode
 */
export type WorkflowExecutionMode = 'direct' | 'bpmn'

/**
 * Options for starting a workflow
 */
export interface StartWorkflowOptions {
  /** Business key for correlation */
  businessKey?: string
  /** Initial variables */
  variables?: Record<string, any>
  /** Resource type (project, task, etc.) */
  resourceType?: string
  /** Resource ID */
  resourceId?: string
  /** Force execution mode */
  executionMode?: WorkflowExecutionMode
}

/**
 * Result of starting a workflow
 */
export interface StartWorkflowResult {
  /** Whether start succeeded */
  success: boolean
  /** Workflow instance ID */
  workflowInstanceId?: string
  /** Flowable process instance ID (if BPMN) */
  flowableProcessInstanceId?: string
  /** Execution mode used */
  executionMode: WorkflowExecutionMode
  /** Error message if failed */
  error?: string
}

/**
 * Interface for the Workflow Orchestrator
 *
 * Responsible for:
 * - Determining execution mode (direct vs BPMN)
 * - Starting workflows
 * - Routing to appropriate service
 * - Maintaining backward compatibility
 */
export interface IWorkflowOrchestrator {
  /**
   * Determine execution mode for a workflow
   *
   * @param companyId - Company ID
   * @param workflowDefinitionId - Workflow definition ID
   */
  determineExecutionMode(
    companyId: string,
    workflowDefinitionId: string
  ): Promise<WorkflowExecutionMode>

  /**
   * Start a workflow
   *
   * Routes to Direct or BPMN execution based on workflow type
   *
   * @param companyId - Company ID
   * @param workflowDefinitionId - Workflow definition ID
   * @param userId - User starting the workflow
   * @param options - Start options
   */
  startWorkflow(
    companyId: string,
    workflowDefinitionId: string,
    userId: string,
    options?: StartWorkflowOptions
  ): Promise<StartWorkflowResult>

  /**
   * Get workflow instance status
   *
   * @param companyId - Company ID
   * @param workflowInstanceId - Workflow instance ID
   */
  getWorkflowStatus(
    companyId: string,
    workflowInstanceId: string
  ): Promise<{
    status: string
    currentStep?: string
    executionMode: WorkflowExecutionMode
  } | null>

  /**
   * Cancel a workflow
   *
   * @param companyId - Company ID
   * @param workflowInstanceId - Workflow instance ID
   * @param userId - User cancelling
   * @param reason - Cancellation reason
   */
  cancelWorkflow(
    companyId: string,
    workflowInstanceId: string,
    userId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }>
}

// =============================================================================
// RESILIENCE INTERFACES
// =============================================================================

/**
 * Retry options
 */
export interface RetryOptions {
  /** Maximum number of retries */
  maxRetries?: number
  /** Base delay between retries (ms) */
  baseDelay?: number
  /** Maximum delay between retries (ms) */
  maxDelay?: number
  /** Backoff multiplier */
  backoffMultiplier?: number
  /** Errors that should not be retried */
  nonRetryableErrors?: string[]
}

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open'

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening */
  failureThreshold?: number
  /** Time to wait before half-opening (ms) */
  resetTimeout?: number
  /** Number of successes needed to close from half-open */
  successThreshold?: number
}

/**
 * Interface for Resilience Service
 */
export interface IResilienceService {
  /**
   * Execute with retry
   *
   * @param operation - Operation to execute
   * @param options - Retry options
   */
  withRetry<T>(
    operation: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T>

  /**
   * Execute with circuit breaker
   *
   * @param name - Circuit breaker name
   * @param operation - Operation to execute
   */
  withCircuitBreaker<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T>

  /**
   * Get circuit breaker state
   *
   * @param name - Circuit breaker name
   */
  getCircuitBreakerState(name: string): CircuitBreakerState

  /**
   * Reset circuit breaker
   *
   * @param name - Circuit breaker name
   */
  resetCircuitBreaker(name: string): void
}

// =============================================================================
// NOTIFICATION INTERFACES
// =============================================================================

/**
 * Notification channel
 */
export type NotificationChannel = 'in_app' | 'email' | 'push' | 'sms'

/**
 * BPMN notification type
 */
export type BpmnNotificationType =
  | 'task_assigned'
  | 'task_completed'
  | 'task_overdue'
  | 'task_escalated'
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'approval_required'
  | 'approval_received'

/**
 * Notification payload
 */
export interface BpmnNotificationPayload {
  /** Notification type */
  type: BpmnNotificationType
  /** Recipient user ID */
  recipientId: string
  /** Notification title */
  title: string
  /** Notification message */
  message: string
  /** Channels to send through */
  channels: NotificationChannel[]
  /** Task ID (if task-related) */
  taskId?: string
  /** Workflow instance ID */
  workflowInstanceId?: string
  /** Action URL */
  actionUrl?: string
  /** Priority */
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  /** Additional data */
  metadata?: Record<string, any>
}

/**
 * Interface for BPMN Notification Service
 */
export interface IBpmnNotificationService {
  /**
   * Send a notification
   *
   * @param companyId - Company ID
   * @param payload - Notification payload
   */
  sendNotification(
    companyId: string,
    payload: BpmnNotificationPayload
  ): Promise<void>

  /**
   * Send notifications to multiple recipients
   *
   * @param companyId - Company ID
   * @param recipientIds - Recipient user IDs
   * @param payload - Notification payload (without recipientId)
   */
  sendBulkNotifications(
    companyId: string,
    recipientIds: string[],
    payload: Omit<BpmnNotificationPayload, 'recipientId'>
  ): Promise<void>

  /**
   * Notify task assignees
   *
   * @param companyId - Company ID
   * @param taskId - Task ID
   * @param type - Notification type
   */
  notifyTaskAssignees(
    companyId: string,
    taskId: string,
    type: BpmnNotificationType
  ): Promise<void>
}
