# PMS App – Unused Components & Features Scan

Scan date: 2025-02-08. This report lists components and features in the PMS app that are **never imported or referenced** outside their own file (or only by other unused code).

---

## Unused components

### Root / layout

| File | Notes |
|------|------|
| `src/components/Breadcrumb.tsx` | Generic breadcrumb; never imported. Task/DrillDown breadcrumbs are separate components. |
| `src/components/AsyncErrorBoundary.tsx` | Error boundary class; app uses `ErrorBoundaryWrapper` instead. |
| `src/components/SidebarWithData.tsx` | Async sidebar wrapper; never imported. |
| `src/components/Sidebar.server.tsx` | Server sidebar variant; never imported. Layout uses `Sidebar` → `SidebarClient`. |

### Company / config

| File | Notes |
|------|------|
| `src/components/CompanyConfigDisplay.tsx` | Company config display; never imported. |
| `src/components/CompanySelector.tsx` | Company selector; never imported. Sidebar uses `SidebarCompanySwitcher`. |

### Templates (legacy / duplicate)

| File | Notes |
|------|------|
| `src/components/templates/TemplateBuilder.tsx` | Legacy template builder; never imported. Settings use `TemplateDesignerV3` and `TemplateList`. |
| `src/components/templates/EmailTemplateEditor.tsx` | Only used inside unused `TemplateBuilder`. |
| `src/components/templates/WhatsAppTemplateEditor.tsx` | Only used inside unused `TemplateBuilder`. |

### Data management

| File | Notes |
|------|------|
| `src/components/data-management/DataTable.tsx` | Data table for objectId; never imported. Data-management page uses `FileList`, `PipelineSummary`, `PipelineStatus`, `ImportDataDialog`. |
| `src/components/data-management/FileValidation.tsx` | File validation UI; never imported. (Types and services use `FileValidationResult` / `FileValidationService` elsewhere.) |

### Access control

| File | Notes |
|------|------|
| `src/components/features/access-control/PolicyManagement.tsx` | Policy management screen; never imported. |

### Import (replaced by virtual version)

| File | Notes |
|------|------|
| `src/components/import/review/ImportReviewTable.tsx` | Replaced by `VirtualImportReviewTable` in `ImportWizard`. |

### Notifications (duplicate)

| File | Notes |
|------|------|
| `src/components/features/notifications/UserNotificationSettings.tsx` | Duplicate; app uses `@/components/notifications/UserNotificationSettings`. |

### Other

| File | Notes |
|------|------|
| `src/components/ManufacturingTemplateSeeder.tsx` | Seeder component; never imported (may be script/CLI-only). |

---

## Unused modules / files

### Dynamic imports (entire module unused)

| File | Notes |
|------|------|
| `src/lib/dynamic-imports.tsx` | **Entire file is never imported.** It exports many `Dynamic*` wrappers (`DynamicProjectTable`, `DynamicVirtualizedProjectTable`, `DynamicProjectCreationWizard`, `DynamicProjectCreationForm`, `DynamicOrgChartVisualization`, `DynamicTaskTemplateManagement`, `DynamicPositionTaskAssignmentManagement`, `DynamicMyTasksDashboard`, `DynamicOrgUnitManagement`, `DynamicPositionManagement`, `DynamicAssignmentManagement`, `DynamicDelegationManagement`). The app uses direct imports instead. Safe to remove or refactor if you want to adopt dynamic loading later. |

---

## Dev / debug routes (unlinked)

These pages exist but are not linked from the main app navigation (sidebar/routes):

| Route | File | Notes |
|-------|------|------|
| `/debug-router` | `src/app/debug-router/page.tsx` | Debug routing page; not linked in nav. |
| `/test-workflow` | `src/app/test-workflow/page.tsx` | Workflow test page using `WorkflowModeler`; not linked in nav. |

Consider keeping for dev only, or removing if not needed.

---

## Summary counts

- **Unused components:** 15 files (including 2 only used by unused `TemplateBuilder`, and 1 duplicate).
- **Unused module:** 1 file (`dynamic-imports.tsx` with 12 dynamic exports).
- **Unlinked routes:** 2 (debug/test).

---

## Recommended actions

1. **Remove or repurpose**  
   Delete or archive unused components if there’s no planned use (e.g. `TemplateBuilder`, `Breadcrumb`, `AsyncErrorBoundary`, `SidebarWithData`, `Sidebar.server`, `CompanyConfigDisplay`, `CompanySelector`, `DataTable`, `FileValidation`, `PolicyManagement`, `ImportReviewTable`, `ManufacturingTemplateSeeder`, duplicate `UserNotificationSettings`).

2. **Templates**  
   If you fully rely on `TemplateDesignerV3` and `TemplateList`, you can remove `TemplateBuilder.tsx`, `EmailTemplateEditor.tsx`, and `WhatsAppTemplateEditor.tsx` (or keep the editors only if you plan to reuse them elsewhere).

3. **dynamic-imports.tsx**  
   Either start using it for heavy screens (e.g. project table, org chart) or remove it to avoid dead code.

4. **Dev routes**  
   Keep `debug-router` and `test-workflow` only if you use them; otherwise remove or move behind a feature flag.

5. **Duplicate**  
   Remove `src/components/features/notifications/UserNotificationSettings.tsx` and keep `src/components/notifications/UserNotificationSettings.tsx` as the single source.

---

*Generated by static scan of imports/references within `apps/pms/src`. Re-run after large refactors to refresh.*
