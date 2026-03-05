# Project Code Immutability Implementation Plan

## Executive Summary
This plan ensures that Project Codes (Unique Keys) are **auto-generated from project names** and **immutable after creation**. This prevents data integrity issues with task IDs and maintains system consistency.

---

## 1. Problem Statement

### Current Behavior
- Users can manually edit the "Project Code" field during project creation
- Users can edit the "Unique Key" field when editing existing projects
- Project Code serves as the prefix for all task IDs (e.g., `PROJ-101`, `DEMO-42`)

### Risks of Allowing Manual Modification
1. **Task ID Corruption**: Changing a project code after tasks exist invalidates all task ID references
2. **Cross-Reference Breakage**: Reports, exports, and external integrations may fail
3. **User Confusion**: Inconsistent task ID formats across the system
4. **Data Integrity**: Historical audit trails become unreliable

---

## 2. Solution Overview

### Design Principles
1. **Auto-Generation Only**: Project codes are derived algorithmically from project names
2. **Creation Lock**: Field is read-only (but visible) during project creation
3. **Edit Lock**: Field is completely disabled when editing existing projects
4. **Backward Compatibility**: Existing projects with custom codes remain unchanged
5. **Clear UX**: Users understand why the field is locked via tooltips/help text

### User Experience Flow
```
User enters project name → System auto-generates code → User sees code (read-only) → Project created
```

---

## 3. Technical Implementation Plan

### 3.1 File Modifications

#### **File 1: `EditProjectDialog.tsx`**
**Location**: `/apps/pms/src/components/features/projects/EditProjectDialog.tsx`

**Changes**:
- Line 148-156: Make the `projectCode` input field **disabled**
- Add visual indicator (lock icon or muted styling)
- Add tooltip: "Project Key cannot be changed after creation to maintain task ID integrity"

**Rationale**: 
- Prevents modification of existing project codes
- Protects task ID references in the system

**Code Change**:
```tsx
<div className="col-span-1 space-y-2">
  <Label htmlFor="projectCode" className="flex items-center gap-2">
    Unique Key
    <Lock className="w-3 h-3 text-muted-foreground" />
  </Label>
  <Input
    id="projectCode"
    value={projectCode}
    disabled={true}
    placeholder="Auto-generated"
    className="font-mono uppercase bg-muted cursor-not-allowed"
    title="Project Key cannot be changed after creation to maintain task ID integrity"
  />
  <p className="text-xs text-muted-foreground">
    Project Key is locked to protect task ID references
  </p>
</div>
```

---

#### **File 2: `ProjectCreationWizard.tsx`**
**Location**: `/apps/pms/src/components/features/projects/ProjectCreationWizard.tsx`

**Changes**:
- Line 594-602: Make the `projectCode` input field **read-only** (but keep auto-generation active)
- Remove manual `onChange` handler (keep auto-generation in `useEffect`)
- Add visual feedback showing it's auto-generated

**Rationale**:
- Users see the code being generated as they type the project name
- Cannot manually override the algorithm
- Maintains transparency while enforcing consistency

**Code Change**:
```tsx
<div className="space-y-2">
  <Label htmlFor="projectCode" className="flex items-center gap-2">
    Project Code *
    <Badge variant="secondary" className="text-xs">Auto-generated</Badge>
  </Label>
  <Input
    id="projectCode"
    value={values.projectCode}
    readOnly={true}
    placeholder="Auto-generated from project name"
    className={`font-mono uppercase bg-muted/50 ${errors.projectCode ? 'border-red-500' : ''}`}
    title="Automatically generated from project name"
  />
  {errors.projectCode && <p className="text-sm text-red-500">{errors.projectCode}</p>}
  <p className="text-xs text-muted-foreground">
    Generated automatically from project name
  </p>
</div>
```

**Keep Existing Auto-Generation Logic** (Lines 458-477):
```tsx
// Generate project code when name changes
useEffect(() => {
  // Only auto-generate if user hasn't manually edited the code
  if (values.name && !values.projectCode) {
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
}, [values.name, values.projectCode, setValue])
```

---

#### **File 3: `ProjectCreationForm.tsx`**
**Location**: `/apps/pms/src/components/features/projects/ProjectCreationForm.tsx`

**Changes**:
- Line 514-525: Make the `projectCode` input field **read-only**
- Remove the `touchedProjectCode` state tracking (no longer needed)
- Update the auto-generation `useEffect` to always run

**Rationale**:
- Consistent behavior with the Wizard
- Simpler code (no manual override tracking)

**Code Change**:
```tsx
<div className="space-y-2">
  <Label htmlFor="projectCode" className="flex items-center gap-2">
    Project Code *
    <Badge variant="secondary" className="text-xs">Auto-generated</Badge>
  </Label>
  <Input
    id="projectCode"
    value={values.projectCode}
    readOnly={true}
    placeholder="Auto-generated from project name"
    className={`font-mono uppercase bg-muted/50 ${errors.projectCode ? 'border-red-500' : ''}`}
    title="Automatically generated from project name"
  />
  {errors.projectCode && <p className="text-sm text-red-500">{errors.projectCode}</p>}
  <p className="text-xs text-muted-foreground">
    Generated automatically from project name
  </p>
</div>
```

**Update Auto-Generation Logic** (Lines 378-398):
```tsx
// Generate project code when name changes
useEffect(() => {
  // Always auto-generate from name (no manual override)
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
}, [values.name, setValue]) // Removed touchedProjectCode dependency
```

**Remove Unused State** (Line 197):
```tsx
// DELETE THIS LINE:
// const [touchedProjectCode, setTouchedProjectCode] = useState(false)
```

---

### 3.2 Backend Validation (Optional Enhancement)

#### **File: `project-service.ts`**
**Location**: `/apps/pms/src/lib/services/projects/project-service.ts`

**Optional Safety Check**:
Add server-side validation to prevent projectCode updates via API:

```typescript
async updateProject(companyId: string, projectId: string, updates: Partial<Project>) {
  // Prevent projectCode modification
  if ('projectCode' in updates) {
    delete updates.projectCode
    console.warn('Attempted to update projectCode, which is immutable. Ignoring.')
  }
  
  // Continue with normal update logic
  // ...
}
```

---

## 4. Testing Plan

### 4.1 Unit Tests
- ✅ Verify auto-generation creates correct codes from project names
- ✅ Test single-word names (e.g., "Demo" → "DEM")
- ✅ Test multi-word names (e.g., "Project Asta" → "PA")
- ✅ Test special characters are stripped (e.g., "Test@#123" → "TEST")

### 4.2 Integration Tests
- ✅ Create a new project and verify code is auto-generated
- ✅ Verify task IDs use the correct project code prefix
- ✅ Attempt to edit project code in UI (should be disabled)
- ✅ Verify existing projects with custom codes are unaffected

### 4.3 Regression Tests
- ✅ Existing projects load correctly
- ✅ Task creation still works with legacy project codes
- ✅ Import/Export functionality is unaffected
- ✅ Reports and dashboards display correct task IDs

---

## 5. Edge Cases & Safeguards

### 5.1 Empty Project Name
**Scenario**: User doesn't enter a name yet  
**Behavior**: Code defaults to "PRJ" (as per current logic)  
**Action**: Keep existing fallback logic

### 5.2 Duplicate Project Codes
**Scenario**: Two projects with identical names generate the same code  
**Behavior**: System should append a numeric suffix (e.g., "PROJ-2")  
**Action**: Add collision detection in `createProject` service (future enhancement)

### 5.3 Legacy Projects
**Scenario**: Existing projects have custom codes  
**Behavior**: **No changes** - they retain their codes  
**Action**: Only apply read-only enforcement to new edits

### 5.4 Very Long Names
**Scenario**: Project name is "Industrial Robot Arm Controller System"  
**Behavior**: Code becomes "IRAC" (first 4 letters)  
**Action**: Existing logic already handles this correctly

---

## 6. Rollout Strategy

### Phase 1: Code Changes (This PR)
1. Update UI components to make fields read-only
2. Remove manual override logic
3. Add visual indicators (badges, tooltips)

### Phase 2: Backend Safeguards (Optional Future PR)
1. Add server-side validation in `updateProject`
2. Implement collision detection for duplicate codes
3. Add audit logging for any attempted modifications

### Phase 3: Communication
1. Update user documentation
2. Add release notes explaining the change
3. Monitor support tickets for user confusion

---

## 7. Rollback Plan

If issues arise:
1. **UI Rollback**: Revert commits to restore manual editing capability
2. **Data Integrity**: No data changes are made, so no data rollback needed
3. **Monitoring**: Track task creation rates and error logs for anomalies

---

## 8. Success Criteria

✅ Users cannot manually edit project codes during creation  
✅ Users cannot edit project codes when editing existing projects  
✅ Auto-generation logic produces consistent, readable codes  
✅ Existing projects and tasks are unaffected  
✅ Task IDs continue to display correctly  
✅ No increase in error rates or support tickets  

---

## 9. Implementation Checklist

- [ ] Modify `EditProjectDialog.tsx` - Add disabled state
- [ ] Modify `ProjectCreationWizard.tsx` - Add read-only state
- [ ] Modify `ProjectCreationForm.tsx` - Add read-only state, remove touchedProjectCode
- [ ] Test auto-generation with various project names
- [ ] Verify task ID generation is unaffected
- [ ] Test editing existing projects (code should be locked)
- [ ] Add visual indicators (badges, tooltips)
- [ ] Update validation logic to enforce code requirement
- [ ] Code review and approval
- [ ] Deploy to staging environment
- [ ] User acceptance testing
- [ ] Production deployment
- [ ] Monitor for 48 hours post-deployment

---

## 10. Files Modified Summary

| File Path | Changes | Risk Level |
|-----------|---------|------------|
| `EditProjectDialog.tsx` | Add `disabled` prop to projectCode input | Low |
| `ProjectCreationWizard.tsx` | Add `readOnly` prop, keep auto-gen | Low |
| `ProjectCreationForm.tsx` | Add `readOnly` prop, remove touchedProjectCode | Low |
| `project-service.ts` (optional) | Block projectCode updates in API | Low |

---

## 11. Dependencies & Assumptions

**Assumptions**:
- Auto-generation algorithm is stable and produces clean codes
- Task ID format is `{projectCode}-{sequentialNumber}`
- Users are okay with losing manual override capability
- Existing projects won't need code changes retroactively

**Dependencies**:
- No external API changes required
- No database migrations needed
- No breaking changes to existing functionality

---

## Conclusion

This implementation ensures **data integrity**, **user experience consistency**, and **system reliability** by making project codes immutable. The changes are minimal, low-risk, and maintain full backward compatibility with existing projects.
