# 🔄 Task Import: Move to Server-Side Architecture Plan

> **Document Version:** 1.0
> **Status:** Draft
> **Objective:** Move Excel import processing from Client (Browser) to Server (Cloud Functions) to support large datasets (5000+ rows) and ensure system reliability.

---

# 1. ANALYSIS OF CURRENT SYSTEM (Client-Side)

## Current Flow
1. **Upload:** User selects file in Browser.
2. **Parse:** `PreValidationService` parses Excel using `xlsx` in Main Thread.
3. **Validate:** `SpecificValidationService` iterates rows, calls `EntityLookupService` (Firetore queries) from Client.
4. **Rendering:** `ImportReviewTable` renders all rows (heavy DOM).
5. **Execute:** `ImportExecutionService` batches writes to Firestore directly from Client.

## Performance Bottlenecks & Risks
| Bottleneck | Risk | Limit (Approx) |
|------------|------|----------------|
| **Validation Loop** | Freezes UI during regex/lookups | ~2,000 rows |
| **DOM Rendering** | Sluggish scrolling/editing | ~1,000 rows (without virtualization) |
| **Network (Writes)** | 5k rows = ~12 large batch requests. Partial failure risk. | N/A (Reliability risk) |
| **State** | **NO Processing ID.** Close tab = Lose progress/status. | 0 tolerance |

## ⚠️ Browser Limit Answer
> **Recommended Limit:** **500 rows** for smooth performance.
> **Hard Limit:** **2,000 rows** before significant UI degradation.
> **5,000 rows:** Unsafe for current client-side architecture.

---

# 2. PROPOSED SERVER-SIDE ARCHITECTURE

## 2.1 Core Entities

### 1. `ImportJob` (Firestore Document)
Tracks the lifecycle of an import process.
```typescript
interface ImportJob {
  id: string; // Processing ID
  companyId: string;
  userId: string;
  projectId?: string;
  importType: 'project_tasks' | 'wbs_gantt' | 'recurring';
  status: 'uploading' | 'processing_validation' | 'waiting_for_review' | 'importing' | 'completed' | 'failed';
  fileName: string;
  fileUrl: string; // GCS Path to original file
  validationResultUrl?: string; // GCS Path to JSON validation results (for large datasets)
  stats: {
    total: number;
    valid: number;
    error: number;
    imported: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## 2.2 New Workflow

### Phase 1: Upload & Initialize
1. **Client:** User uploads file.
2. **Client:** Uploads raw file to Firebase Storage: `imports/{companyId}/{jobId}/source.xlsx`.
3. **Client:** Creates `ImportJob` doc in Firestore with status `processing_validation`.

### Phase 2: Server-Side Validation (Cloud Function)
1. **Trigger:** `onDocumentCreated` (ImportJob) OR Http Callable `validateImportJob(jobId)`.
2. **Function:**
   - Downloads file from Storage.
   - Runs `PreValidationService` (Logic reused on Node).
   - Runs `SpecificValidationService` (Logic reused, adapted for Admin SDK).
   - **Performance:** Stream processing for massive files (future proof).
   - Saves `validation_results.json` to Storage (to avoid 1MB Firestore doc limit for 5000 rows).
   - Updates `ImportJob`: status=`waiting_for_review`, sets stats.

### Phase 3: Review & Edit (Client)
1. **Client:** Listens to `ImportJob`. When `waiting_for_review`:
2. **Client:** Downloads `validation_results.json` (signed URL).
3. **UI:** Renders Table. **Virtualization** is mandatory for 5000 rows.
4. **Edit:** User edits a cell. Validates locally first.
   - *Option A (Simple):* Local edit state, send FULL updated JSON on confirm.
   - *Option B (Robust):* Send patch to server for re-validation (Slower).
   - **Decision:** Interactive edits happen locally. On "Confirm", we upload the *corrected* JSON to Storage as `final_payload.json`.

### Phase 4: Execution (Server-Side)
1. **Client:** Uploads `final_payload.json` to Storage.
2. **Client:** Calls function `executeImport(jobId)`.
3. **Function:**
   - Reads `final_payload.json`.
   - Runs `ImportExecutionService` (Adapted for Admin SDK).
   - Uses `Batch writes` (500 limit).
   - Updates `ImportJob`: status=`completed` or `failed`.
   - Adds "Processing ID" (Job ID) to every created task (field: `importJobId`) for audit.

---

# 3. MIGRATION STRATEGY

## Strategy: "Parallel Implementation"
We will build the Server-Side flow alongside the Client-Side flow, verified by feature flags or separate routes, to ensure "My Tasks" and "Project Tasks" (currently working) don't break.

### Step-by-Step Plan

#### Stage 1: Infrastructure & Entities
- [ ] Create `ImportJob` Firestore schema.
- [ ] Create Storage rules for `imports/` bucket.
- [ ] Create `ImportService` (Client) to handle File Upload -> Job Creation.

#### Stage 2: Server-Side Validation Function
- [ ] Port `PreValidationService` to shared lib (or duplicate for functions).
- [ ] Port `SpecificValidationService` to Cloud Functions (Admin SDK for lookups).
- [ ] Create `validateImportJob` Cloud Function.

#### Stage 3: Server-Side Execution Function
- [ ] Port `ImportExecutionService` to Cloud Functions.
- [ ] Ensure `Batch` logic works with Admin SDK.
- [ ] Add `importJobId` field to Task schema.

#### Stage 4: UI Refactor
- [ ] Update `ImportDialog` to support Async flow (Upload -> Wait -> Review -> Confirm -> Wait).
- [ ] Implement `VirtualTable` (React Window) for 5000+ row rendering.

---

# 4. IMPLEMENTATION ORDER (Preserving Functionality)

1. **Refactor Shared Logic:**
    - Extract pure validation logic from `PreValidationService` / `SpecificValidationService` so it can be used by both Client (react) and Server (node).

2. **Backend Foundation:**
    - Implement `validateImport` Cloud Function.
    - Implement `executeImport` Cloud Function.

3. **My Tasks / Project Tasks Migration:**
    - Switch "Project Import" UI to use the new Async Flow.
    - Verify 5000 rows performance.

4. **WBS / Recurring:**
    - Once plumbing is solid, adding these types is just adding their Schema/Validation logic to the server functions.

---

# 5. IMMEDIATE ACTION ITEMS

1. **Create `ImportJob` types** in shared library.
2. **Create `on-import-validate` Cloud Function** skeleton.
