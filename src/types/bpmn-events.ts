/**
 * BPMN Event Types
 *
 * Type definitions for Flowable webhook events and outbox processing.
 * Based on Flowable REST API documentation.
 *
 * @module types/bpmn-events
 * @version 1.0.0
 * @since Stage 1 - Foundation & Contracts
 */

import { Timestamp } from 'firebase/firestore'

// =============================================================================
// FLOWABLE WEBHOOK EVENT TYPES
// =============================================================================

/**
 * All possible event types from Flowable webhook
 */
export type FlowableEventType =
  // Process lifecycle events
  | 'PROCESS_STARTED'
  | 'PROCESS_COMPLETED'
  | 'PROCESS_CANCELLED'
  | 'PROCESS_SUSPENDED'
  | 'PROCESS_ACTIVATED'
  | 'PROCESS_ERROR'
  // Task lifecycle events
  | 'TASK_CREATED'
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETED'
  | 'TASK_DELETED'
  | 'TASK_OWNER_CHANGED'
  | 'TASK_PRIORITY_CHANGED'
  | 'TASK_DUEDATE_CHANGED'
  // Variable events
  | 'VARIABLE_CREATED'
  | 'VARIABLE_UPDATED'
  | 'VARIABLE_DELETED'
  // Activity events
  | 'ACTIVITY_STARTED'
  | 'ACTIVITY_COMPLETED'
  | 'ACTIVITY_CANCELLED'
  | 'ACTIVITY_ERROR'
  // Gateway events
  | 'GATEWAY_TAKEN'
  | 'SEQUENCEFLOW_TAKEN'
  // Timer events
  | 'TIMER_FIRED'
  | 'TIMER_SCHEDULED'
  | 'TIMER_CANCELLED'
  // Signal/Message events
  | 'SIGNAL_RECEIVED'
  | 'MESSAGE_RECEIVED'
  // Error events
  | 'ERROR_RECEIVED'
  | 'UNCAUGHT_BPMN_ERROR'

/**
 * Base structure for all Flowable webhook events
 */
export interface FlowableWebhookEvent {
  /** Unique event identifier from Flowable */
  eventId: string
  /** Type of the event */
  eventType: FlowableEventType
  /** ISO timestamp when event occurred */
  timestamp: string
  /** Tenant identifier (format: company_{companyId}) */
  tenantId: string
  /** Event-specific payload */
  payload: FlowableEventPayload
  /** Optional correlation ID for tracing */
  correlationId?: string
}

// =============================================================================
// EVENT PAYLOADS
// =============================================================================

/**
 * Process lifecycle event payload
 */
export interface ProcessEventPayload {
  /** Flowable process instance ID */
  processInstanceId: string
  /** Process definition ID (includes version) */
  processDefinitionId: string
  /** Process definition key (without version) */
  processDefinitionKey: string
  /** Business key for correlation */
  businessKey?: string
  /** Process variables at event time */
  variables?: Record<string, any>
  /** Process start time (ISO) */
  startTime?: string
  /** Process end time (ISO) - only for completion/cancellation */
  endTime?: string
  /** Reason for process end */
  endReason?: string
  /** Duration in milliseconds */
  durationInMillis?: number
  /** User who started the process */
  startUserId?: string
  /** Super process instance ID (for call activities) */
  superProcessInstanceId?: string
  /** Delete reason (for cancellation) */
  deleteReason?: string
}

/**
 * Task lifecycle event payload
 */
export interface TaskEventPayload {
  /** Flowable task ID */
  taskId: string
  /** Task definition key in BPMN */
  taskDefinitionKey: string
  /** Human-readable task name */
  taskName: string
  /** Task description */
  description?: string
  /** Parent process instance ID */
  processInstanceId: string
  /** Process definition ID */
  processDefinitionId: string
  /** Process definition key */
  processDefinitionKey?: string
  /** Execution ID within process */
  executionId?: string
  /** Assigned user ID */
  assignee?: string
  /** Previous assignee (for reassignment) */
  previousAssignee?: string
  /** Task owner */
  owner?: string
  /** Candidate users who can claim */
  candidateUsers?: string[]
  /** Candidate groups who can claim */
  candidateGroups?: string[]
  /** Task due date (ISO) */
  dueDate?: string
  /** Task priority (0-100) */
  priority?: number
  /** Task category */
  category?: string
  /** Form key for UI rendering */
  formKey?: string
  /** Task-local variables */
  variables?: Record<string, any>
  /** Task create time (ISO) */
  createTime?: string
  /** Task claim time (ISO) */
  claimTime?: string
  /** Task end time (ISO) */
  endTime?: string
  /** Duration in milliseconds */
  durationInMillis?: number
  /** Parent task ID (for subtasks) */
  parentTaskId?: string
}

/**
 * Variable event payload
 */
export interface VariableEventPayload {
  /** Variable name */
  variableName: string
  /** Variable type (string, integer, boolean, json, etc.) */
  variableType: string
  /** Variable value */
  variableValue: any
  /** Previous value (for updates) */
  previousValue?: any
  /** Process instance ID */
  processInstanceId: string
  /** Task ID (if task-scoped variable) */
  taskId?: string
  /** Execution ID */
  executionId?: string
  /** Scope type */
  scopeType: 'process' | 'task' | 'execution'
}

/**
 * Activity event payload
 */
export interface ActivityEventPayload {
  /** Activity ID in BPMN */
  activityId: string
  /** Human-readable activity name */
  activityName: string
  /** Activity type (userTask, serviceTask, gateway, etc.) */
  activityType: string
  /** Process instance ID */
  processInstanceId: string
  /** Process definition ID */
  processDefinitionId: string
  /** Execution ID */
  executionId: string
  /** Start time (ISO) */
  startTime?: string
  /** End time (ISO) */
  endTime?: string
  /** Duration in milliseconds */
  durationInMillis?: number
  /** Sequence flow taken (for gateways) */
  sequenceFlowId?: string
  /** Activity behavior class */
  behaviorClass?: string
}

/**
 * Gateway event payload
 */
export interface GatewayEventPayload {
  /** Gateway ID in BPMN */
  gatewayId: string
  /** Gateway type (exclusive, parallel, inclusive) */
  gatewayType: 'exclusive' | 'parallel' | 'inclusive' | 'eventBased'
  /** Process instance ID */
  processInstanceId: string
  /** Execution ID */
  executionId: string
  /** Sequence flow taken */
  sequenceFlowId: string
  /** Source activity ID */
  sourceActivityId: string
  /** Target activity ID */
  targetActivityId: string
  /** Condition expression (if any) */
  conditionExpression?: string
}

/**
 * Error event payload
 */
export interface ErrorEventPayload {
  /** Error code */
  errorCode: string
  /** Error message */
  errorMessage: string
  /** Process instance ID */
  processInstanceId?: string
  /** Task ID (if task-related error) */
  taskId?: string
  /** Activity ID where error occurred */
  activityId?: string
  /** Execution ID */
  executionId?: string
  /** Stack trace (if available) */
  stackTrace?: string
  /** Error details */
  details?: Record<string, any>
}

/**
 * Timer event payload
 */
export interface TimerEventPayload {
  /** Timer job ID */
  jobId: string
  /** Process instance ID */
  processInstanceId: string
  /** Execution ID */
  executionId: string
  /** Timer definition type */
  timerType: 'date' | 'duration' | 'cycle'
  /** Timer configuration */
  timerConfiguration: string
  /** Due date (ISO) */
  dueDate: string
  /** Retry count */
  retries?: number
  /** Exception message (if failed) */
  exceptionMessage?: string
}

/**
 * Union type for all event payloads
 */
export type FlowableEventPayload =
  | ProcessEventPayload
  | TaskEventPayload
  | VariableEventPayload
  | ActivityEventPayload
  | GatewayEventPayload
  | ErrorEventPayload
  | TimerEventPayload

// =============================================================================
// WEBHOOK PROCESSING
// =============================================================================

/**
 * Result of processing a webhook event
 */
export interface WebhookProcessingResult {
  /** Whether processing succeeded */
  success: boolean
  /** Event ID that was processed */
  eventId: string
  /** Event type that was processed */
  eventType: FlowableEventType
  /** Processing duration in milliseconds */
  processingTimeMs: number
  /** Error message (if failed) */
  error?: string
  /** Whether the event can be retried */
  retryable?: boolean
  /** Actions taken during processing */
  actions?: string[]
}

/**
 * Webhook event status in Firestore
 */
export type WebhookEventStatus =
  | 'received'      // Just received, not yet processed
  | 'processing'    // Currently being processed
  | 'processed'     // Successfully processed
  | 'failed'        // Failed (may retry)
  | 'dead'          // Moved to dead letter queue

/**
 * Webhook event document in Firestore
 */
export interface WebhookEventDocument {
  /** Event ID from Flowable */
  eventId: string
  /** Event type */
  eventType: FlowableEventType
  /** Event timestamp from Flowable */
  timestamp: string
  /** Full event payload */
  payload: FlowableEventPayload
  /** Correlation ID for tracing */
  correlationId: string
  /** Processing status */
  status: WebhookEventStatus
  /** When event was received */
  receivedAt: Timestamp
  /** When processing started */
  processingStartedAt?: Timestamp
  /** When processing completed */
  processedAt?: Timestamp
  /** Processing duration in ms */
  processingTimeMs?: number
  /** Error message if failed */
  error?: string
  /** Number of processing attempts */
  attemptCount: number
  /** Whether event was deduplicated */
  isDuplicate?: boolean
}

// =============================================================================
// OUTBOX EVENT TYPES
// =============================================================================

/**
 * All possible outbox event types for Flowable operations
 */
export type BpmnOutboxEventType =
  // Process operations
  | 'START_PROCESS'
  | 'CANCEL_PROCESS'
  | 'SUSPEND_PROCESS'
  | 'ACTIVATE_PROCESS'
  | 'DELETE_PROCESS'
  // Task operations
  | 'COMPLETE_TASK'
  | 'CLAIM_TASK'
  | 'UNCLAIM_TASK'
  | 'ASSIGN_TASK'
  | 'DELEGATE_TASK'
  | 'RESOLVE_TASK'
  // Variable operations
  | 'SET_VARIABLE'
  | 'SET_VARIABLES'
  | 'REMOVE_VARIABLE'
  // Deployment operations
  | 'DEPLOY_WORKFLOW'
  | 'UNDEPLOY_WORKFLOW'
  // Signal/Message operations
  | 'SEND_SIGNAL'
  | 'SEND_MESSAGE'

/**
 * Status of an outbox event
 */
export type OutboxEventStatus =
  | 'pending'       // Waiting to be processed
  | 'processing'    // Currently being processed
  | 'completed'     // Successfully processed
  | 'failed'        // Failed (will retry)
  | 'dead'          // Moved to dead letter queue (max retries exceeded)

/**
 * Outbox event payload for process operations
 */
export interface ProcessOutboxPayload {
  /** Process definition key */
  processDefinitionKey?: string
  /** Business key for correlation */
  businessKey?: string
  /** Process instance ID (for existing processes) */
  processInstanceId?: string
  /** Variables to pass */
  variables?: Record<string, any>
  /** Reason (for cancellation/suspension) */
  reason?: string
  /** User initiating the action */
  userId?: string
}

/**
 * Outbox event payload for task operations
 */
export interface TaskOutboxPayload {
  /** Our Firestore task ID */
  taskId?: string
  /** Flowable task ID */
  flowableTaskId?: string
  /** User performing the action */
  userId?: string
  /** Variables to pass on completion */
  variables?: Record<string, any>
  /** Comments */
  comments?: string
  /** New assignee (for assignment) */
  assignee?: string
  /** Delegate user (for delegation) */
  delegateUser?: string
}

/**
 * Outbox event payload for variable operations
 */
export interface VariableOutboxPayload {
  /** Process instance ID */
  processInstanceId?: string
  /** Task ID (for task-scoped variables) */
  taskId?: string
  /** Variable name */
  variableName?: string
  /** Variable value */
  variableValue?: any
  /** Variable type */
  variableType?: string
  /** Multiple variables (for SET_VARIABLES) */
  variables?: Record<string, any>
}

/**
 * Outbox event payload for deployment operations
 */
export interface DeploymentOutboxPayload {
  /** Workflow definition ID in Firestore */
  workflowId?: string
  /** Deployment name */
  deploymentName?: string
  /** BPMN XML content */
  bpmnXml?: string
  /** Tenant ID */
  tenantId?: string
}

/**
 * Outbox event payload for signal/message operations
 */
export interface SignalMessageOutboxPayload {
  /** Signal or message name */
  name: string
  /** Target process instance ID (optional) */
  processInstanceId?: string
  /** Target execution ID (optional) */
  executionId?: string
  /** Variables to pass */
  variables?: Record<string, any>
  /** Tenant ID */
  tenantId?: string
}

/**
 * Union type for all outbox payloads
 */
export type BpmnOutboxPayload =
  | ProcessOutboxPayload
  | TaskOutboxPayload
  | VariableOutboxPayload
  | DeploymentOutboxPayload
  | SignalMessageOutboxPayload

/**
 * Complete outbox event document
 */
export interface BpmnOutboxEvent {
  /** Document ID (auto-generated) */
  id?: string
  /** Company ID for multi-tenancy */
  companyId: string
  /** Event type */
  eventType: BpmnOutboxEventType
  /** Event payload */
  payload: BpmnOutboxPayload
  /** Current status */
  status: OutboxEventStatus
  /** Number of retry attempts */
  retryCount: number
  /** Maximum retry attempts */
  maxRetries: number
  /** When event was created */
  createdAt: string
  /** When event started processing */
  processingStartedAt?: string
  /** When event was processed */
  processedAt?: string
  /** Error message if failed */
  error?: string
  /** Correlation ID for tracing */
  correlationId: string
  /** Processing duration in ms */
  processingTimeMs?: number
  /** Next retry time (for failed events) */
  nextRetryAt?: string
}

// =============================================================================
// WORKFLOW INSTANCE TYPES (BPMN-specific)
// =============================================================================

/**
 * Status of a BPMN workflow instance
 */
export type BpmnWorkflowInstanceStatus =
  | 'pending'       // Created but not yet started in Flowable
  | 'running'       // Active in Flowable
  | 'suspended'     // Suspended in Flowable
  | 'completed'     // Successfully completed
  | 'cancelled'     // Cancelled by user
  | 'failed'        // Failed with error
  | 'terminated'    // Terminated by admin

/**
 * BPMN workflow step instance
 */
export interface BpmnWorkflowStepInstance {
  /** Step ID (matches BPMN activity ID) */
  stepId: string
  /** Step order in workflow */
  order: number
  /** Step name */
  name: string
  /** Step type */
  type: 'userTask' | 'serviceTask' | 'scriptTask' | 'gateway' | 'event' | 'subProcess'
  /** Current status */
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'failed'
  /** Assigned users */
  assignedTo?: string[]
  /** When step started */
  startedAt?: string
  /** When step completed */
  completedAt?: string
  /** Step duration in ms */
  durationMs?: number
  /** Step variables */
  variables?: Record<string, any>
  /** Escalation configuration */
  escalationPathId?: string
  /** Current escalation level */
  escalationLevel?: number
  /** Due date for this step */
  dueAt?: string
  /** Linked Firestore task ID */
  firestoreTaskId?: string
  /** Linked Flowable task ID */
  flowableTaskId?: string
}

/**
 * Complete BPMN workflow instance document
 */
export interface BpmnWorkflowInstance {
  /** Document ID */
  id: string
  /** Company ID */
  companyId: string
  /** Workflow definition ID in Firestore */
  workflowDefinitionId: string
  /** Workflow definition key */
  workflowDefinitionKey: string
  /** Workflow version */
  workflowVersion: number
  /** Flowable process instance ID */
  flowableProcessInstanceId?: string
  /** Flowable deployment ID */
  flowableDeploymentId?: string
  /** Business key for correlation */
  businessKey?: string
  /** Resource type (project, task, etc.) */
  resourceType?: string
  /** Resource ID */
  resourceId?: string
  /** Current status */
  status: BpmnWorkflowInstanceStatus
  /** Current step ID */
  currentStepId?: string
  /** Current step key */
  currentStepKey?: string
  /** Current Firestore task ID */
  currentTaskId?: string
  /** Step instances */
  stepInstances: BpmnWorkflowStepInstance[]
  /** Process variables */
  variables: Record<string, any>
  /** When instance was created */
  createdAt: string
  /** Who created the instance */
  createdBy: string
  /** When instance was last updated */
  updatedAt: string
  /** When instance started in Flowable */
  startedAt?: string
  /** When instance completed */
  completedAt?: string
  /** Total duration in ms */
  durationMs?: number
  /** Completion result */
  result?: 'approved' | 'rejected' | 'cancelled' | 'error'
  /** Error message if failed */
  error?: string
  /** Project ID (if applicable) */
  projectId?: string
}

// =============================================================================
// BPMN TASK TYPES
// =============================================================================

/**
 * Sync status for BPMN tasks
 */
export type BpmnTaskSyncStatus =
  | 'pending'       // Waiting to sync with Flowable
  | 'syncing'       // Currently syncing
  | 'synced'        // Successfully synced
  | 'failed'        // Sync failed
  | 'not_applicable' // Not a BPMN task

/**
 * Additional fields for BPMN tasks in tasks collection
 */
export interface BpmnTaskFields {
  /** Task category identifier */
  category: 'bpmn_workflow'
  /** Flowable task ID */
  flowableTaskId: string
  /** Flowable process instance ID */
  flowableProcessInstanceId: string
  /** Task definition key in BPMN */
  taskDefinitionKey: string
  /** Workflow instance ID in Firestore */
  workflowInstanceId: string
  /** Workflow definition ID */
  workflowDefinitionId: string
  /** Sync status with Flowable */
  flowableSyncStatus: BpmnTaskSyncStatus
  /** When last synced */
  flowableSyncedAt?: string
  /** Sync error message */
  flowableSyncError?: string
  /** Form key for UI rendering */
  formKey?: string
  /** Candidate user IDs */
  candidateUserIds?: string[]
  /** Candidate group IDs */
  candidateGroupIds?: string[]
  /** Task-local variables */
  taskVariables?: Record<string, any>
  /** Output variables (set on completion) */
  outputVariables?: Record<string, any>
  /** Workflow status */
  workflowStatus: 'active' | 'completed' | 'cancelled'
}

// =============================================================================
// DEAD LETTER QUEUE
// =============================================================================

/**
 * Dead letter queue event
 */
export interface DeadLetterEvent {
  /** Original event ID */
  originalEventId: string
  /** Original event type */
  eventType: BpmnOutboxEventType | FlowableEventType
  /** Original payload */
  payload: any
  /** Original collection (outbox or webhookEvents) */
  originalCollection: 'outbox' | 'webhookEvents'
  /** Company ID */
  companyId: string
  /** Error that caused DLQ */
  error: string
  /** Number of attempts made */
  attemptCount: number
  /** When moved to DLQ */
  movedAt: string
  /** Correlation ID */
  correlationId: string
  /** Whether manually reviewed */
  reviewed: boolean
  /** Review notes */
  reviewNotes?: string
  /** Reviewed by */
  reviewedBy?: string
  /** Reviewed at */
  reviewedAt?: string
  /** Resolution status */
  resolution?: 'retry' | 'skip' | 'manual_fix' | 'ignored'
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Check if event is a process event
 */
export function isProcessEvent(event: FlowableWebhookEvent): event is FlowableWebhookEvent & { payload: ProcessEventPayload } {
  return [
    'PROCESS_STARTED',
    'PROCESS_COMPLETED',
    'PROCESS_CANCELLED',
    'PROCESS_SUSPENDED',
    'PROCESS_ACTIVATED',
    'PROCESS_ERROR'
  ].includes(event.eventType)
}

/**
 * Check if event is a task event
 */
export function isTaskEvent(event: FlowableWebhookEvent): event is FlowableWebhookEvent & { payload: TaskEventPayload } {
  return [
    'TASK_CREATED',
    'TASK_ASSIGNED',
    'TASK_COMPLETED',
    'TASK_DELETED',
    'TASK_OWNER_CHANGED',
    'TASK_PRIORITY_CHANGED',
    'TASK_DUEDATE_CHANGED'
  ].includes(event.eventType)
}

/**
 * Check if event is a variable event
 */
export function isVariableEvent(event: FlowableWebhookEvent): event is FlowableWebhookEvent & { payload: VariableEventPayload } {
  return [
    'VARIABLE_CREATED',
    'VARIABLE_UPDATED',
    'VARIABLE_DELETED'
  ].includes(event.eventType)
}

/**
 * Check if event is an activity event
 */
export function isActivityEvent(event: FlowableWebhookEvent): event is FlowableWebhookEvent & { payload: ActivityEventPayload } {
  return [
    'ACTIVITY_STARTED',
    'ACTIVITY_COMPLETED',
    'ACTIVITY_CANCELLED',
    'ACTIVITY_ERROR'
  ].includes(event.eventType)
}

/**
 * Check if event is an error event
 */
export function isErrorEvent(event: FlowableWebhookEvent): event is FlowableWebhookEvent & { payload: ErrorEventPayload } {
  return [
    'ERROR_RECEIVED',
    'UNCAUGHT_BPMN_ERROR'
  ].includes(event.eventType)
}

/**
 * Extract company ID from Flowable tenant ID
 * Format: company_{companyId} -> companyId
 */
export function extractCompanyIdFromTenant(tenantId: string): string {
  if (tenantId.startsWith('company_')) {
    return tenantId.substring(8)
  }
  return tenantId
}

/**
 * Format company ID as Flowable tenant ID
 * Format: companyId -> company_{companyId}
 */
export function formatCompanyIdAsTenant(companyId: string): string {
  if (companyId.startsWith('company_')) {
    return companyId
  }
  return `company_${companyId}`
}
