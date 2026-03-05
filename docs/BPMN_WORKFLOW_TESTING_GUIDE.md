# BPMN Workflow Testing Guide

Complete step-by-step testing guide for the BPMN Workflow Implementation.

**Total Tests:** 303 tests across 8 test suites
**Test Coverage:** Stages 1-9 of BPMN Implementation

---

## Table of Contents

1. [Test Architecture Overview](#test-architecture-overview)
2. [Stage 1: Base Outbox Pattern Tests](#stage-1-base-outbox-pattern-tests)
3. [Stage 2: Flowable Integration Tests](#stage-2-flowable-integration-tests)
4. [Stage 3: Task Synchronization Tests](#stage-3-task-synchronization-tests)
5. [Stage 4: Escalation Scheduler Tests](#stage-4-escalation-scheduler-tests)
6. [Stage 5: Variable & Condition Engine Tests](#stage-5-variable--condition-engine-tests)
7. [Stage 6: Notification Integration Tests](#stage-6-notification-integration-tests)
8. [Stage 7: Error Recovery & Resilience Tests](#stage-7-error-recovery--resilience-tests)
9. [Stage 8: Monitoring & Observability Tests](#stage-8-monitoring--observability-tests)
10. [Stage 9: End-to-End Integration Tests](#stage-9-end-to-end-integration-tests)
11. [Running Tests](#running-tests)
12. [Test Utilities Reference](#test-utilities-reference)

---

## Test Architecture Overview

### Directory Structure

```
apps/pms/src/__tests__/bpmn/
├── stage-1-outbox.test.ts              # Base outbox pattern tests (30 tests)
├── stage-2-flowable.test.ts            # Flowable integration tests (36 tests)
├── stage-3-task-sync.test.ts           # Task synchronization tests (18 tests)
├── stage-4-escalation.test.ts          # Escalation scheduler tests (36 tests)
├── stage-5-variable-engine.test.ts     # Variable engine tests (62 tests)
├── stage-6-notification.test.ts        # Notification tests (33 tests)
├── stage-7-resilience.test.ts          # Resilience tests (42 tests)
├── stage-8-monitoring.test.ts          # Monitoring tests (36 tests)
├── bpmn-test-utils.ts                  # Shared test utilities
└── integration/
    ├── bpmn-integration-utils.ts       # Integration test utilities
    └── stage-9-integration.test.ts     # E2E integration tests (44 tests)
```

### Test Design Principles

1. **Isolation**: Each test runs in isolation with mocked dependencies
2. **No Production Impact**: All tests use mocks - zero impact on existing Direct Execution
3. **Comprehensive Coverage**: Tests cover happy paths, edge cases, and error scenarios
4. **Self-Documenting**: Test descriptions clearly explain what's being tested

---

## Stage 1: Base Outbox Pattern Tests

**File:** `src/__tests__/bpmn/stage-1-outbox.test.ts`
**Tests:** 30
**Service:** `src/lib/services/bpmn-outbox-service.ts`

### Purpose
Tests the foundational transactional outbox pattern that ensures reliable event delivery between PMS and Flowable.

### Test Groups

#### 1.1 Event Creation (6 tests)
```typescript
describe('Event Creation', () => {
  test('should create outbox event with correct structure')
  test('should generate unique event IDs')
  test('should set correct initial status')
  test('should serialize payload correctly')
  test('should set companyId for tenant isolation')
  test('should include correlation ID')
})
```

**What's Tested:**
- Event ID generation using UUID
- Payload serialization to JSON
- Tenant isolation via companyId
- Correlation ID for tracing
- Initial status set to 'pending'

#### 1.2 Event Types (6 tests)
```typescript
describe('Event Types', () => {
  test('should handle START_PROCESS event type')
  test('should handle COMPLETE_TASK event type')
  test('should handle CLAIM_TASK event type')
  test('should handle SET_VARIABLE event type')
  test('should handle SIGNAL_EVENT event type')
  test('should reject invalid event type')
})
```

**What's Tested:**
- All supported BPMN event types
- Type validation
- Type-specific payload requirements

#### 1.3 Event Processing (8 tests)
```typescript
describe('Event Processing', () => {
  test('should mark event as processing')
  test('should mark event as completed on success')
  test('should mark event as failed on error')
  test('should increment retry count on failure')
  test('should move to dead letter after max retries')
  test('should maintain event order')
  test('should handle concurrent processing')
  test('should apply exponential backoff')
})
```

**What's Tested:**
- Status transitions (pending -> processing -> completed/failed)
- Retry mechanism with count tracking
- Dead letter queue for exhausted retries
- FIFO ordering guarantee
- Concurrent processing safety
- Exponential backoff timing

#### 1.4 Event Querying (5 tests)
```typescript
describe('Event Querying', () => {
  test('should query pending events')
  test('should query events by status')
  test('should query events by type')
  test('should filter by company')
  test('should paginate results')
})
```

#### 1.5 Batch Operations (5 tests)
```typescript
describe('Batch Operations', () => {
  test('should create multiple events atomically')
  test('should rollback on batch failure')
  test('should process events in batch')
  test('should handle partial batch failures')
  test('should limit batch size')
})
```

---

## Stage 2: Flowable Integration Tests

**File:** `src/__tests__/bpmn/stage-2-flowable.test.ts`
**Tests:** 36
**Service:** `functions/src/workflow/bpmn/flowableService.ts`

### Purpose
Tests the integration between the outbox processor and Flowable REST API.

### Test Groups

#### 2.1 Process Operations (9 tests)
```typescript
describe('Process Operations', () => {
  test('should start process instance')
  test('should start process with business key')
  test('should start process with variables')
  test('should get process instance by ID')
  test('should get active process instances')
  test('should delete process instance')
  test('should suspend process instance')
  test('should activate suspended process')
  test('should handle process not found')
})
```

**What's Tested:**
- Process lifecycle management
- Variable passing at start
- Business key assignment
- Process state management
- Error handling for missing processes

#### 2.2 Task Operations (10 tests)
```typescript
describe('Task Operations', () => {
  test('should get task by ID')
  test('should get tasks for process instance')
  test('should get tasks by assignee')
  test('should complete task')
  test('should complete task with variables')
  test('should claim task')
  test('should unclaim task')
  test('should delegate task')
  test('should set task due date')
  test('should handle task not found')
})
```

**What's Tested:**
- Task retrieval methods
- Task completion with output variables
- Task assignment operations
- Due date management

#### 2.3 Variable Operations (6 tests)
```typescript
describe('Variable Operations', () => {
  test('should get process variables')
  test('should get single variable')
  test('should set process variable')
  test('should set multiple variables')
  test('should delete variable')
  test('should handle variable not found')
})
```

#### 2.4 Authentication (5 tests)
```typescript
describe('Authentication', () => {
  test('should include auth header in requests')
  test('should refresh token on 401')
  test('should handle invalid credentials')
  test('should use correct base URL')
  test('should timeout on slow responses')
})
```

#### 2.5 Error Handling (6 tests)
```typescript
describe('Error Handling', () => {
  test('should handle network errors')
  test('should handle 400 bad request')
  test('should handle 403 forbidden')
  test('should handle 404 not found')
  test('should handle 500 server error')
  test('should map Flowable errors to domain errors')
})
```

---

## Stage 3: Task Synchronization Tests

**File:** `src/__tests__/bpmn/stage-3-task-sync.test.ts`
**Tests:** 18
**Service:** `src/lib/services/bpmn-task-sync-service.ts`

### Purpose
Tests bidirectional synchronization between PMS tasks and Flowable tasks.

### Test Groups

#### 3.1 PMS to Flowable Sync (6 tests)
```typescript
describe('PMS to Flowable Sync', () => {
  test('should sync task creation to Flowable')
  test('should sync task completion to Flowable')
  test('should sync assignee changes')
  test('should sync due date updates')
  test('should sync priority changes')
  test('should handle sync failures gracefully')
})
```

**What's Tested:**
- Task creation triggers Flowable sync
- Task updates propagate to Flowable
- Assignment changes sync correctly
- Graceful handling of sync failures

#### 3.2 Flowable to PMS Sync (6 tests)
```typescript
describe('Flowable to PMS Sync', () => {
  test('should sync Flowable task creation')
  test('should sync Flowable task completion')
  test('should sync form data from Flowable')
  test('should sync candidate groups')
  test('should handle missing PMS task')
  test('should create PMS task for new Flowable task')
})
```

**What's Tested:**
- Webhook-triggered task creation
- Flowable completion updates PMS
- Form data synchronization
- Candidate group mapping

#### 3.3 Conflict Resolution (6 tests)
```typescript
describe('Conflict Resolution', () => {
  test('should use last-write-wins for concurrent updates')
  test('should detect conflicts via version')
  test('should queue conflicting updates')
  test('should log conflicts for analysis')
  test('should prefer Flowable state for BPMN tasks')
  test('should prefer PMS state for direct tasks')
})
```

**What's Tested:**
- Concurrent update handling
- Version-based conflict detection
- Source-of-truth determination

---

## Stage 4: Escalation Scheduler Tests

**File:** `src/__tests__/bpmn/stage-4-escalation.test.ts`
**Tests:** 36
**Service:** `src/lib/services/bpmn-escalation-service.ts`

### Purpose
Tests the escalation engine that handles overdue tasks and SLA breaches.

### Test Groups

#### 4.1 Timer Evaluation (8 tests)
```typescript
describe('Timer Evaluation', () => {
  test('should identify overdue tasks')
  test('should calculate time remaining')
  test('should handle different time units')
  test('should support ISO duration format')
  test('should respect business hours')
  test('should exclude weekends')
  test('should handle timezone correctly')
  test('should evaluate multiple timers')
})
```

**What's Tested:**
- Overdue detection algorithm
- Time calculation precision
- Multiple timer format support
- Business calendar integration

#### 4.2 Escalation Actions (10 tests)
```typescript
describe('Escalation Actions', () => {
  test('should send notification on level 1')
  test('should send reminder on level 2')
  test('should escalate to supervisor on level 3')
  test('should reassign task on level 4')
  test('should auto-approve overdue task')
  test('should auto-reject overdue task')
  test('should execute custom escalation action')
  test('should chain multiple actions')
  test('should skip completed tasks')
  test('should respect escalation policy')
})
```

**What's Tested:**
- All escalation action types
- Multi-level escalation
- Policy-based action selection
- Completed task filtering

#### 4.3 Scheduler Execution (8 tests)
```typescript
describe('Scheduler Execution', () => {
  test('should run on schedule')
  test('should process multiple tasks')
  test('should batch process efficiently')
  test('should handle scheduler errors')
  test('should track last run time')
  test('should prevent duplicate runs')
  test('should log scheduler activity')
  test('should respect rate limits')
})
```

#### 4.4 Escalation History (5 tests)
```typescript
describe('Escalation History', () => {
  test('should record escalation event')
  test('should include triggering rule')
  test('should track escalation level')
  test('should record target user')
  test('should prevent duplicate escalations')
})
```

#### 4.5 Policy Configuration (5 tests)
```typescript
describe('Policy Configuration', () => {
  test('should load policy from workflow')
  test('should validate policy structure')
  test('should merge with default policy')
  test('should support conditional rules')
  test('should handle missing policy')
})
```

---

## Stage 5: Variable & Condition Engine Tests

**File:** `src/__tests__/bpmn/stage-5-variable-engine.test.ts`
**Tests:** 62
**Service:** `src/lib/services/bpmn-variable-service.ts`

### Purpose
Tests the variable management and condition evaluation engine for gateways.

### Test Groups

#### 5.1 Variable Storage (10 tests)
```typescript
describe('Variable Storage', () => {
  test('should set process variable')
  test('should get process variable')
  test('should update existing variable')
  test('should delete process variable')
  test('should handle variable types: string')
  test('should handle variable types: number')
  test('should handle variable types: boolean')
  test('should handle variable types: object')
  test('should handle variable types: array')
  test('should handle variable types: date')
})
```

**What's Tested:**
- CRUD operations for variables
- All supported data types
- Type preservation

#### 5.2 Task Variables (8 tests)
```typescript
describe('Task Variables', () => {
  test('should set task local variable')
  test('should get task variable')
  test('should inherit process variables')
  test('should override with local variable')
  test('should propagate on completion')
  test('should clear local variables after task')
  test('should handle form field mapping')
  test('should validate required variables')
})
```

**What's Tested:**
- Task-scoped variables
- Variable inheritance
- Form field binding
- Required variable validation

#### 5.3 Expression Lexer (12 tests)
```typescript
describe('Expression Lexer', () => {
  test('should tokenize identifiers')
  test('should tokenize numbers')
  test('should tokenize strings')
  test('should tokenize operators: ==')
  test('should tokenize operators: !=')
  test('should tokenize operators: >')
  test('should tokenize operators: <')
  test('should tokenize operators: >=')
  test('should tokenize operators: <=')
  test('should tokenize boolean operators: &&')
  test('should tokenize boolean operators: ||')
  test('should handle whitespace')
})
```

**What's Tested:**
- Token recognition for all operators
- Identifier parsing
- Literal value parsing
- Whitespace handling

#### 5.4 Expression Parser (14 tests)
```typescript
describe('Expression Parser', () => {
  test('should parse simple comparison')
  test('should parse boolean AND')
  test('should parse boolean OR')
  test('should handle operator precedence')
  test('should parse parentheses')
  test('should parse nested expressions')
  test('should parse property access: obj.prop')
  test('should parse ${variable} syntax')
  test('should handle null values')
  test('should handle undefined values')
  test('should return false for invalid expression')
  test('should parse string comparisons')
  test('should parse numeric comparisons')
  test('should parse boolean literals')
})
```

**What's Tested:**
- Full expression parsing
- Operator precedence
- BPMN variable syntax
- Edge case handling

#### 5.5 Gateway Condition Evaluation (10 tests)
```typescript
describe('Gateway Condition Evaluation', () => {
  test('should evaluate single condition')
  test('should select first matching condition')
  test('should use default when no match')
  test('should handle exclusive gateway')
  test('should handle inclusive gateway')
  test('should return evaluation result with details')
  test('should capture errors in result')
  test('should validate condition syntax')
  test('should support complex conditions')
  test('should handle missing variables')
})
```

**What's Tested:**
- Condition matching logic
- Default path selection
- Gateway type handling
- Error capture in results

#### 5.6 Safe Evaluation (8 tests)
```typescript
describe('Safe Evaluation', () => {
  test('should prevent code injection')
  test('should block function calls')
  test('should block constructor access')
  test('should handle infinite loops')
  test('should limit recursion depth')
  test('should sandbox evaluation context')
  test('should prevent prototype pollution')
  test('should handle malformed expressions')
})
```

**What's Tested:**
- Security against injection
- Safe evaluation sandbox
- Resource limits

---

## Stage 6: Notification Integration Tests

**File:** `src/__tests__/bpmn/stage-6-notification.test.ts`
**Tests:** 33
**Service:** `src/lib/services/bpmn-notification-service.ts`

### Purpose
Tests the notification system integration for BPMN workflow events.

### Test Groups

#### 6.1 Notification Types (17 tests)
```typescript
describe('Notification Types', () => {
  test('should send TASK_ASSIGNED notification')
  test('should send TASK_COMPLETED notification')
  test('should send TASK_DUE_SOON notification')
  test('should send TASK_OVERDUE notification')
  test('should send TASK_ESCALATED notification')
  test('should send TASK_COMMENT_ADDED notification')
  test('should send TASK_REASSIGNED notification')
  test('should send PROCESS_STARTED notification')
  test('should send PROCESS_COMPLETED notification')
  test('should send PROCESS_FAILED notification')
  test('should send APPROVAL_REQUESTED notification')
  test('should send APPROVAL_APPROVED notification')
  test('should send APPROVAL_REJECTED notification')
  test('should send ESCALATION_WARNING notification')
  test('should send SLA_BREACH notification')
  test('should send WORKFLOW_ERROR notification')
  test('should send VARIABLE_CHANGED notification')
})
```

**What's Tested:**
- All 17 BPMN notification types
- Correct type mapping
- Required metadata for each type

#### 6.2 Template Rendering (8 tests)
```typescript
describe('Template Rendering', () => {
  test('should render simple variable: {{variable}}')
  test('should render nested variable: {{obj.prop}}')
  test('should render conditional: {{#if condition}}')
  test('should render else block: {{else}}')
  test('should handle missing variables')
  test('should escape HTML in variables')
  test('should support date formatting')
  test('should support number formatting')
})
```

**What's Tested:**
- Variable interpolation
- Conditional blocks
- Missing variable handling
- XSS prevention

#### 6.3 Recipient Resolution (4 tests)
```typescript
describe('Recipient Resolution', () => {
  test('should resolve user by ID')
  test('should resolve group members')
  test('should resolve process initiator')
  test('should deduplicate recipients')
})
```

#### 6.4 Integration (4 tests)
```typescript
describe('Integration with Existing System', () => {
  test('should use NotificationService.createNotification')
  test('should include BPMN metadata')
  test('should respect user preferences')
  test('should handle notification failures')
})
```

---

## Stage 7: Error Recovery & Resilience Tests

**File:** `src/__tests__/bpmn/stage-7-resilience.test.ts`
**Tests:** 42
**Service:** `src/lib/services/bpmn-resilience-service.ts`

### Purpose
Tests error recovery mechanisms including retry, circuit breaker, and dead letter queue.

### Test Groups

#### 7.1 Retry Mechanism (12 tests)
```typescript
describe('Retry Mechanism', () => {
  test('should retry on transient failure')
  test('should apply exponential backoff')
  test('should add jitter to backoff')
  test('should respect max retries')
  test('should stop on non-retryable error')
  test('should calculate correct delays')
  test('should track retry count')
  test('should preserve original error')
  test('should retry different error types')
  test('should handle timeout errors')
  test('should succeed after retries')
  test('should exhaust retries and fail')
})
```

**What's Tested:**
- Exponential backoff algorithm
- Jitter application
- Retry limit enforcement
- Transient vs permanent error distinction

#### 7.2 Circuit Breaker (14 tests)
```typescript
describe('Circuit Breaker', () => {
  test('should start in closed state')
  test('should track failure count')
  test('should open after threshold')
  test('should reject requests when open')
  test('should transition to half-open')
  test('should close on success in half-open')
  test('should reopen on failure in half-open')
  test('should reset failure count on success')
  test('should calculate failure rate')
  test('should respect reset timeout')
  test('should allow probe request in half-open')
  test('should emit state change events')
  test('should support manual reset')
  test('should handle concurrent requests')
})
```

**What's Tested:**
- State machine transitions
- Failure threshold tracking
- Half-open probing
- Concurrent request handling

#### 7.3 Dead Letter Queue (10 tests)
```typescript
describe('Dead Letter Queue', () => {
  test('should move failed event to DLQ')
  test('should preserve original event data')
  test('should record failure reason')
  test('should track failure count')
  test('should support manual retry')
  test('should list DLQ events')
  test('should filter DLQ by error type')
  test('should purge old DLQ events')
  test('should alert on DLQ threshold')
  test('should provide DLQ statistics')
})
```

**What's Tested:**
- Event preservation
- Failure tracking
- Manual retry capability
- DLQ management

#### 7.4 Resilience Service Integration (6 tests)
```typescript
describe('Resilience Service', () => {
  test('should combine retry and circuit breaker')
  test('should respect circuit breaker before retry')
  test('should update circuit breaker after retry exhaustion')
  test('should move to DLQ after all retries')
  test('should provide health status')
  test('should emit resilience events')
})
```

**What's Tested:**
- Combined retry + circuit breaker flow
- Correct ordering of mechanisms
- Health reporting

---

## Stage 8: Monitoring & Observability Tests

**File:** `src/__tests__/bpmn/stage-8-monitoring.test.ts`
**Tests:** 36
**Service:** `src/lib/services/bpmn-monitoring-service.ts`

### Purpose
Tests the monitoring, logging, and metrics collection for BPMN operations.

### Test Groups

#### 8.1 Structured Logging (10 tests)
```typescript
describe('Structured Logging', () => {
  test('should log with correlation ID')
  test('should include timestamp')
  test('should include log level')
  test('should include context data')
  test('should log DEBUG level')
  test('should log INFO level')
  test('should log WARN level')
  test('should log ERROR level')
  test('should format error objects')
  test('should respect log level filter')
})
```

**What's Tested:**
- Structured log format
- Correlation ID propagation
- Log level filtering
- Error formatting

#### 8.2 Metrics Collection (12 tests)
```typescript
describe('Metrics Collection', () => {
  test('should record counter metric')
  test('should record gauge metric')
  test('should record histogram metric')
  test('should record timer metric')
  test('should aggregate metrics')
  test('should reset metrics on flush')
  test('should calculate percentiles')
  test('should track metric labels')
  test('should handle concurrent updates')
  test('should export metrics format')
  test('should calculate rate metrics')
  test('should track uptime')
})
```

**What's Tested:**
- All metric types
- Aggregation algorithms
- Percentile calculation
- Concurrent safety

#### 8.3 Dashboard Data (6 tests)
```typescript
describe('Dashboard Data', () => {
  test('should get workflow metrics')
  test('should get task metrics')
  test('should get error metrics')
  test('should get latency metrics')
  test('should filter by time range')
  test('should filter by workflow')
})
```

#### 8.4 Health Checks (4 tests)
```typescript
describe('Health Checks', () => {
  test('should check Flowable connectivity')
  test('should check outbox queue depth')
  test('should check DLQ depth')
  test('should aggregate health status')
})
```

#### 8.5 Alerting (4 tests)
```typescript
describe('Alerting', () => {
  test('should check alert thresholds')
  test('should trigger alert on threshold breach')
  test('should include alert context')
  test('should support multiple alert channels')
})
```

---

## Stage 9: End-to-End Integration Tests

**File:** `src/__tests__/bpmn/integration/stage-9-integration.test.ts`
**Tests:** 44
**Utilities:** `src/__tests__/bpmn/integration/bpmn-integration-utils.ts`

### Purpose
Comprehensive end-to-end tests simulating complete workflow scenarios.

### Test Groups

#### 9.1 Simple Workflow Execution (4 tests)
```typescript
describe('Simple Workflow Execution', () => {
  test('should deploy and execute a simple workflow')
  test('should pass variables when starting process')
  test('should generate outbox events on task completion')
  test('should create task with Flowable sync status')
})
```

**What's Tested:**
- Complete workflow lifecycle
- Variable passing
- Event generation
- Sync status tracking

#### 9.2 Multi-Step Approval Workflow (3 tests)
```typescript
describe('Multi-Step Approval Workflow', () => {
  test('should execute three-step approval workflow')
  test('should track task completion history')
  test('should preserve variables across steps')
})
```

**What's Tested:**
- Sequential step execution
- Completion tracking
- Variable preservation

#### 9.3 Gateway Routing (4 tests)
```typescript
describe('Gateway Routing', () => {
  test('should route to approved end when approved')
  test('should route to rejected end when rejected')
  test('should use default path when no conditions match')
  test('should evaluate conditions with various operators')
})
```

**What's Tested:**
- Conditional routing
- Default path selection
- Operator evaluation

#### 9.4 Escalation Handling (5 tests)
```typescript
describe('Escalation Handling', () => {
  test('should trigger escalation when task is overdue')
  test('should trigger multiple escalation levels')
  test('should not re-trigger same escalation level')
  test('should skip escalation for completed tasks')
  test('should record escalation target user')
})
```

**What's Tested:**
- Time-based escalation
- Multi-level escalation
- Duplicate prevention

#### 9.5 Parallel Task Execution (2 tests)
```typescript
describe('Parallel Task Execution', () => {
  test('should create parallel tasks')
  test('should handle parallel workflow definition')
})
```

#### 9.6 Error Handling and Retry (4 tests)
```typescript
describe('Error Handling and Retry', () => {
  test('should retry failed Flowable operations')
  test('should move to dead letter queue after max retries')
  test('should track retry count in outbox events')
  test('should handle transient errors gracefully')
})
```

**What's Tested:**
- Retry mechanism
- DLQ handling
- Transient error recovery

#### 9.7 Backward Compatibility (4 tests)
```typescript
describe('Backward Compatibility - Direct Execution', () => {
  test('should create direct tasks without workflow')
  test('should coexist with BPMN tasks')
  test('should identify direct tasks by missing workflow definition')
  test('should not affect BPMN workflows when creating direct tasks')
})
```

**What's Tested:**
- Direct task creation still works
- BPMN and direct tasks coexist
- No interference between modes

#### 9.8 Complex Integration Scenarios (3 tests)
```typescript
describe('Complex Integration Scenarios', () => {
  test('should handle multiple concurrent workflow instances')
  test('should handle workflow with all features combined')
  test('should maintain data integrity across workflow lifecycle')
})
```

**What's Tested:**
- Concurrent instances
- Combined features
- Data integrity

#### 9.9 Time-Based Scenarios (2 tests)
```typescript
describe('Time-Based Scenarios', () => {
  test('should track due dates correctly')
  test('should handle time advancement for escalations')
})
```

#### 9.10 Edge Cases (6 tests)
```typescript
describe('Edge Cases', () => {
  test('should handle workflow with single task')
  test('should handle empty variables')
  test('should handle rapid task completions')
  test('should throw error for non-existent workflow')
  test('should throw error for non-existent task')
  test('should throw error for non-existent instance')
})
```

#### 9.11 Assertion Utilities (5 tests)
```typescript
describe('Assertion Utilities', () => {
  test('assertWorkflowCompleted should pass for completed workflow')
  test('assertWorkflowCompleted should fail for running workflow')
  test('assertWorkflowFailed should pass for rejected workflow')
  test('assertTaskStatus should verify task status correctly')
  test('assertEscalationOccurred should verify escalation')
})
```

#### 9.12 Wait For Task (2 tests)
```typescript
describe('Wait For Task', () => {
  test('should return task when available')
  test('should timeout when task not found')
})
```

---

## Running Tests

### Run All BPMN Tests

```bash
cd apps/pms
npx jest -c tests/jest.config.js "__tests__/bpmn" --no-coverage
```

### Run Specific Stage

```bash
# Stage 1 - Outbox
npx jest -c tests/jest.config.js "stage-1-outbox"

# Stage 2 - Flowable
npx jest -c tests/jest.config.js "stage-2-flowable"

# Stage 3 - Task Sync
npx jest -c tests/jest.config.js "stage-3-task-sync"

# Stage 4 - Escalation
npx jest -c tests/jest.config.js "stage-4-escalation"

# Stage 5 - Variables
npx jest -c tests/jest.config.js "stage-5-variable"

# Stage 6 - Notifications
npx jest -c tests/jest.config.js "stage-6-notification"

# Stage 7 - Resilience
npx jest -c tests/jest.config.js "stage-7-resilience"

# Stage 8 - Monitoring
npx jest -c tests/jest.config.js "stage-8-monitoring"

# Stage 9 - Integration
npx jest -c tests/jest.config.js "stage-9-integration"
```

### Run with Coverage

```bash
npx jest -c tests/jest.config.js "__tests__/bpmn" --coverage
```

### Run in Watch Mode

```bash
npx jest -c tests/jest.config.js "__tests__/bpmn" --watch
```

---

## Test Utilities Reference

### Shared Test Utilities

**File:** `src/__tests__/bpmn/bpmn-test-utils.ts`

```typescript
// Mock Factories
createMockOutboxEvent(overrides?: Partial<OutboxEvent>): OutboxEvent
createMockFlowableTask(overrides?: Partial<FlowableTask>): FlowableTask
createMockEscalationPolicy(overrides?: Partial<EscalationPolicy>): EscalationPolicy
createMockNotification(overrides?: Partial<BpmnNotification>): BpmnNotification

// Mock Services
createMockFlowableService(): MockFlowableService
createMockOutboxService(): MockOutboxService
createMockNotificationService(): MockNotificationService

// Time Utilities
advanceTimers(ms: number): void
mockDateNow(timestamp: number): void
resetDateMock(): void

// Assertion Helpers
expectEventType(event: OutboxEvent, type: string): void
expectTaskStatus(task: Task, status: string): void
```

### Integration Test Utilities

**File:** `src/__tests__/bpmn/integration/bpmn-integration-utils.ts`

```typescript
// Workflow Deployment
deployTestWorkflow(definition: TestWorkflowDefinition | string): Promise<string>

// Process Execution
startProcess(workflowId: string, options?: StartProcessOptions): Promise<string>
completeTask(instanceId: string, stepId: string, options?: CompleteTaskOptions): Promise<void>
waitForTask(instanceId: string, stepId: string, timeout?: number): Promise<TestTask>

// Query Functions
getWorkflowInstance(instanceId: string): Promise<TestWorkflowInstance | null>
getTasksForInstance(instanceId: string): Promise<TestTask[]>
getEscalationHistory(taskId: string): Promise<TestEscalationEvent[]>
getOutboxEvents(): Promise<any[]>
getDeadLetterEvents(): Promise<any[]>

// Mock Utilities
mockFlowableFailures(count: number): void
resetFlowableMock(): void

// Time Utilities
advanceTime(ms: number): Promise<void>
getCurrentTime(): Date
resetTime(): void

// Escalation
runEscalationScheduler(): Promise<void>

// Assertions
assertWorkflowCompleted(instanceId: string): Promise<void>
assertWorkflowFailed(instanceId: string): Promise<void>
assertTaskStatus(taskId: string, status: string): Promise<void>
assertEscalationOccurred(taskId: string, action: string): Promise<void>

// Cleanup
resetTestData(): void
```

### Prebuilt Test Workflows

```typescript
// Available via deployTestWorkflow('workflow-name')
'simple-workflow'           // Single task workflow
'three-step-approval'       // Three sequential approval steps
'approval-with-rejection'   // Approval with gateway to approve/reject ends
'workflow-with-escalation'  // Workflow with escalation policy
'parallel-tasks'            // Workflow with parallel tasks
```

---

## Test Coverage Summary

| Stage | Tests | Coverage Area |
|-------|-------|---------------|
| 1 | 30 | Outbox Pattern |
| 2 | 36 | Flowable Integration |
| 3 | 18 | Task Synchronization |
| 4 | 36 | Escalation Scheduler |
| 5 | 62 | Variable & Condition Engine |
| 6 | 33 | Notification Integration |
| 7 | 42 | Error Recovery & Resilience |
| 8 | 36 | Monitoring & Observability |
| 9 | 44 | End-to-End Integration |
| **Total** | **303** | **Full BPMN Coverage** |

---

## Verification Checklist

Before deploying BPMN functionality:

- [ ] All 303 tests pass
- [ ] No impact on existing Direct Execution tests
- [ ] Integration tests cover all workflow patterns
- [ ] Error scenarios properly handled
- [ ] Escalation timing verified
- [ ] Gateway routing correct
- [ ] Variable preservation verified
- [ ] Notifications sent correctly
- [ ] Metrics collected properly
- [ ] DLQ handling works

Run full verification:
```bash
cd apps/pms
npx jest -c tests/jest.config.js "__tests__/bpmn" --no-coverage --verbose
```

---

**Document Version:** 1.0.0
**Last Updated:** Stage 9 Completion
**Test Framework:** Jest + @testing-library/react
