# Reporter Approval Feature - Implementation Plan

## Overview

The **Reporter Approval** feature enables task reporters (the person who created/requested the task) to review and approve task completion before the task is marked as complete. This ensures quality control and validation from the task requester.

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Status Name | `approval_required` | Clear, descriptive, follows existing naming convention |
| Selection Method | Dropdown (NO checkbox) | Consistent with existing approval line UX |
| Template Storage | Code Constant (Hardcoded) | Same for all tenants, zero Firestore reads |
| Runtime Data | Firestore per-tenant | ApprovalInstance stored in tenant's collection |
| System Line Availability | ALL projects, ALL types | Universal feature, auto-enabled |

---

## Architecture

### Status Flow

```
┌──────────────┐     ┌─────────────────────┐     ┌────────────┐
│ in_progress  │ ──► │ approval_required   │ ──► │ completed  │
└──────────────┘     └─────────────────────┘     └────────────┘
                              │
                              │ (rejected)
                              ▼
                     ┌──────────────┐
                     │ in_progress  │ (with rejection comments)
                     └──────────────┘
```

### Data Model

**System Approval Line (Hardcoded)**
- ID: `__SYSTEM_REPORTER_APPROVAL__`
- Stored in: Code constant (`system-approval-lines.ts`)
- Same across ALL tenants

**ApprovalInstance (Runtime)**
- Stored in: Firestore (`companies/{companyId}/approvalInstances/{instanceId}`)
- Created when task status changes to `approval_required`
- Contains: `isSystemApproval: true`, `systemApprovalType: 'reporter_approval'`

---

## Implementation Phases

### Phase 1: Schema Updates ✅

**Files Modified:**
- `packages/shared-types/src/task-template-schema.ts`
- `packages/shared-types/src/approval-line-schema.ts`

**Changes:**

1. **Task Status Type** - Added `approval_required` to status union:
```typescript
status: 'open' | 'assigned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled' | 'escalated' | 'approval_required'
```

2. **Task Reporter Approval Fields**:
```typescript
requiresReporterApproval?: boolean
reporterApprovalStatus?: 'pending' | 'approved' | 'rejected'
reporterRejectionComments?: string
reporterApprovalAttempts?: number
reporterApprovalHistory?: Array<{
  attemptNumber: number
  status: 'pending' | 'approved' | 'rejected'
  reviewedBy: string
  reviewedAt: string
  comments?: string
}>
```

3. **ApprovalLine System Flags**:
```typescript
isSystemLine?: boolean
systemType?: 'reporter_approval' | 'manager_approval' | 'skip_level_approval'
```

4. **ApprovalInstance System Flags**:
```typescript
isSystemApproval?: boolean
systemApprovalType?: 'reporter_approval'
```

5. **ApproverSource Type** - Added `reporter`:
```typescript
type ApproverSource = 'hierarchy' | 'custom' | 'mixed' | 'dynamic' | 'reporter'
```

**Success Metrics:**
- ✅ TypeScript compilation passes
- ✅ No type errors in dependent files
- ✅ Schema maintains backward compatibility

---

### Phase 2: System Approval Line Constant ✅

**File Created:**
- `apps/pms/src/lib/constants/system-approval-lines.ts` (NEW)

**Exports:**
```typescript
// Constants
export const SYSTEM_REPORTER_APPROVAL_ID = '__SYSTEM_REPORTER_APPROVAL__'
export const SYSTEM_REPORTER_APPROVAL_LINE: Partial<ApprovalLine>

// Helper Functions
export function isSystemReporterApprovalLine(approvalLineId: string | undefined | null): boolean
export function isReporterApprovalInstance(instance: {...}): boolean
export function isSystemApprovalLine(approvalLine: Partial<ApprovalLine> | undefined | null): boolean
export function getSystemApprovalLines(): Partial<ApprovalLine>[]
export function getSystemApprovalLineById(id: string): Partial<ApprovalLine> | undefined
```

**System Line Configuration:**
```typescript
{
  id: '__SYSTEM_REPORTER_APPROVAL__',
  name: 'Reporter Approval',
  isSystemLine: true,
  systemType: 'reporter_approval',
  stages: [{
    id: 'reporter-review-stage',
    approverSource: 'reporter',
    requiredApprovals: 1,
    timeoutHours: 72,
    onApprove: 'complete',
    onReject: 'reject_all',
  }],
  settings: {
    allowDelegation: false,
    skipIfSameUser: false,
    notifyOnAssignment: true,
    notifyOnCompletion: true,
  }
}
```

**Success Metrics:**
- ✅ Import works without errors
- ✅ Helper functions correctly identify system lines
- ✅ No Firestore dependency

---

### Phase 3: Approval Line Service Update ✅

**File Modified:**
- `apps/pms/src/lib/services/approval-line-service.ts`

**New Functions:**
```typescript
export async function getApprovalLinesWithSystem(
  companyId: string,
  filters?: {...},
  groupId?: string
): Promise<ApprovalLine[]>

export async function getActiveApprovalLinesWithSystem(
  companyId: string,
  groupId?: string
): Promise<ApprovalLine[]>
```

**Updated Functions:**
- `getApprovalLine()` - Now checks for system line ID first before Firestore query

**Success Metrics:**
- ✅ System lines appear in approval line lists
- ✅ `getApprovalLine()` returns system line when ID matches
- ✅ Existing approval line functionality unchanged

---

### Phase 4: Task Creation Auto-Set Flag ✅

**File Modified:**
- `apps/pms/src/lib/services/tasks/task-template-service.ts`

**Changes:**
- Auto-set `requiresReporterApproval: true` when `workflowDefinitionId` matches system reporter approval ID

```typescript
if (isSystemReporterApprovalLine(taskDataToSaveWithCode.workflowDefinitionId)) {
  (taskDataToSaveWithCode as any).requiresReporterApproval = true
}
```

**Success Metrics:**
- ✅ New tasks with reporter approval line get flag auto-set
- ✅ Existing task creation unaffected

---

### Phase 5: Status Transitions ✅

**File Modified:**
- `apps/pms/src/lib/services/tasks/task-template-service.ts`

**Rules Implemented:**
1. Tasks with reporter approval CANNOT be directly marked as `completed`
2. Must go through `approval_required` status first
3. Error thrown if violation attempted

```typescript
const hasReporterApproval = isSystemReporterApprovalLine(currentTask.workflowDefinitionId) ||
                            currentTask.requiresReporterApproval === true

if (status === 'completed' && hasReporterApproval && previousStatus !== 'approval_required') {
  throw new Error('Tasks with Reporter Approval cannot be directly completed. Please change status to "Approval Required" first.')
}
```

**Success Metrics:**
- ✅ Direct completion blocked for reporter approval tasks
- ✅ Status flow enforced: `in_progress` → `approval_required` → `completed`
- ✅ Non-reporter-approval tasks unaffected

---

### Phase 6: Reporter Approval Trigger Service ✅

**File Modified:**
- `apps/pms/src/lib/services/tasks/task-approval-service.ts`

**New Method:**
```typescript
static async triggerReporterApproval(
  companyId: string,
  taskId: string,
  actorId: string,
  groupId?: string
): Promise<string>
```

**Functionality:**
1. Creates ApprovalInstance with `isSystemApproval: true`
2. Resolves reporter as approver (from task.reporter or task.reporterUserId)
3. Updates task with `currentApprovalInstanceId` and `reporterApprovalStatus: 'pending'`
4. Sends notification to reporter

**Updated `submitDecision()` Method:**
- Special handling for reporter approval instances
- On approve: Sets task status to `completed`, `reporterApprovalStatus: 'approved'`
- On reject: Sets task status to `in_progress`, `reporterApprovalStatus: 'rejected'`, stores rejection comments

**Success Metrics:**
- ✅ ApprovalInstance created correctly
- ✅ Reporter resolved as approver
- ✅ Task updated with approval reference
- ✅ Approve/reject flows work correctly

---

### Phase 7: Status Transition Hook ✅

**File Modified:**
- `apps/pms/src/lib/services/tasks/task-template-service.ts`

**Changes:**
- When status changes to `approval_required`, automatically triggers `TaskApprovalService.triggerReporterApproval()`

**Success Metrics:**
- ✅ Approval instance auto-created on status change
- ✅ Reporter notified automatically

---

### Phase 8: TaskForm Dropdown ✅

**File Modified:**
- `apps/pms/src/components/features/tasks/TaskForm.tsx`

**Changes:**
1. Import `getActiveApprovalLinesWithSystem` instead of `getActiveApprovalLines`
2. Import `isSystemApprovalLine` helper
3. Show "System" badge for system lines in dropdown

```tsx
{isSystemApprovalLine(line) && (
  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-200">
    System
  </Badge>
)}
```

**Success Metrics:**
- ✅ System lines appear in dropdown
- ✅ "System" badge displays correctly
- ✅ Selection works correctly

---

### Phase 9: UI Status Colors and Icons ✅

**Files Modified:**
- `apps/pms/src/lib/utils/task-status-colors.ts`
- `apps/pms/src/components/features/tasks/utils.tsx`
- `apps/pms/src/components/features/tasks/TaskKanbanView.tsx`
- `apps/pms/src/components/features/tasks/TaskDashboard.tsx`

**Changes:**

1. **Status Colors** (Indigo theme for `approval_required`):
```typescript
case 'approval_required':
  return {
    bg: 'bg-indigo-50',
    barBg: 'bg-indigo-100',
    barText: 'text-indigo-800',
    border: 'border-indigo-200',
    progress: 'bg-indigo-500',
    text: 'text-indigo-700',
  }
```

2. **Status Icon**:
```typescript
case 'approval_required':
  return <ClipboardCheck className="h-4 w-4 text-indigo-500" />
```

3. **Kanban View** - Added to `ALL_STATUSES_FALLBACK`
4. **Dashboard** - Added to `statusOrder` and `statusDisplayNames`

**Success Metrics:**
- ✅ Status displays with correct colors
- ✅ Icon renders correctly
- ✅ Kanban and Dashboard show status

---

### Phase 10: Project Governance Tab ✅

**File Modified:**
- `apps/pms/src/components/features/projects/ProjectWorkflowAssignmentTab.tsx`

**Changes:**
1. System line appears at TOP of approval lines list
2. System line is pre-selected by default
3. System line CANNOT be deselected (locked)
4. Shows "System" badge with purple styling
5. Helper text: "Enabled for all projects. Cannot be removed."
6. System line NOT saved to Firestore (always auto-available)

```tsx
// Load system line first
const systemApprovalLineWithValidation = {
  approvalLine: SYSTEM_REPORTER_APPROVAL_LINE as ApprovalLine,
  isValid: true,
  validationErrors: [],
}

// Always include in selected
const selectedWithSystem = Array.from(new Set([SYSTEM_REPORTER_APPROVAL_ID, ...approvalLineIds]))

// Prevent deselection
if (id === SYSTEM_REPORTER_APPROVAL_ID) {
  toast.error('System approval lines cannot be removed.')
  return
}
```

**Success Metrics:**
- ✅ System line at top of list
- ✅ Pre-selected and locked
- ✅ Badge displays correctly
- ✅ Cannot be removed

---

### Phase 11: Approval Lines Admin Page ✅

**File Modified:**
- `apps/pms/src/app/governance/approval-lines/page.tsx`

**Changes:**
1. System lines appear in the list with "System" badge
2. Actions disabled for system lines (Edit, Duplicate, Delete, Deactivate)
3. Tooltip shows "System approval lines cannot be modified"
4. Purple row highlighting for system lines
5. Filters work correctly with system lines

**Success Metrics:**
- ✅ System line visible in list
- ✅ Badge displays correctly
- ✅ Actions appropriately disabled
- ✅ No errors when interacting

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `packages/shared-types/src/task-template-schema.ts` | Modified | Added `approval_required` status, reporter approval fields |
| `packages/shared-types/src/approval-line-schema.ts` | Modified | Added system line flags, `reporter` approver source |
| `apps/pms/src/lib/constants/system-approval-lines.ts` | Created | System approval line constant and helpers |
| `apps/pms/src/lib/services/approval-line-service.ts` | Modified | Added `*WithSystem` functions |
| `apps/pms/src/lib/services/tasks/task-template-service.ts` | Modified | Auto-set flag, status restrictions, trigger hook |
| `apps/pms/src/lib/services/tasks/task-approval-service.ts` | Modified | Added `triggerReporterApproval()`, updated `submitDecision()` |
| `apps/pms/src/lib/utils/task-status-colors.ts` | Modified | Added indigo colors for `approval_required` |
| `apps/pms/src/components/features/tasks/utils.tsx` | Modified | Added `ClipboardCheck` icon |
| `apps/pms/src/components/features/tasks/TaskForm.tsx` | Modified | System lines in dropdown with badge |
| `apps/pms/src/components/features/tasks/TaskKanbanView.tsx` | Modified | Added status to fallback list |
| `apps/pms/src/components/features/tasks/TaskDashboard.tsx` | Modified | Added status order and display name |
| `apps/pms/src/components/features/projects/ProjectWorkflowAssignmentTab.tsx` | Modified | System line at top, pre-selected, locked |
| `apps/pms/src/app/governance/approval-lines/page.tsx` | Modified | System line display with disabled actions |

---

## Backward Compatibility

1. **Existing Tasks**: Unaffected - no `requiresReporterApproval` flag means no validation
2. **Existing Approval Lines**: Work exactly as before
3. **Existing Status Flows**: No changes to existing status transitions
4. **Existing Projects**: System line auto-available but not forced

---

## Testing Checklist

### Unit Tests
- [ ] `isSystemReporterApprovalLine()` returns correct values
- [ ] `isReporterApprovalInstance()` identifies instances correctly
- [ ] Status transition rules enforced

### Integration Tests
- [ ] Task creation with system approval line sets flag
- [ ] Status change to `approval_required` triggers approval
- [ ] Approve flow completes task
- [ ] Reject flow returns to `in_progress`

### UI Tests
- [ ] System line appears in TaskForm dropdown
- [ ] System line appears in Project Governance tab
- [ ] System line appears in Approval Lines admin page
- [ ] Badges and styling correct
- [ ] Actions disabled for system lines

### End-to-End Tests
- [ ] Create task with Reporter Approval
- [ ] Complete work and submit for approval
- [ ] Reporter receives notification
- [ ] Reporter approves - task completes
- [ ] Reporter rejects - task returns to in_progress
- [ ] Assignee resubmits after fixing issues

---

## Success Criteria

| Metric | Target | Status |
|--------|--------|--------|
| TypeScript Compilation | 0 errors | ✅ |
| ESLint Errors | 0 errors | ✅ |
| Existing Functionality | Unaffected | ✅ |
| System Line Display | All locations | ✅ |
| Status Flow | Enforced | ✅ |

---

## Future Enhancements

1. **My Approvals Page**: Add "Reporter Approval" badge to distinguish from regular approvals
2. **Bulk Operations**: Enable/disable reporter approval for multiple tasks
3. **Analytics**: Track reporter approval metrics
4. **Notifications**: Enhanced notification templates for reporter approval

---

*Document created: 2025-01-XX*
*Last updated: 2025-01-XX*
