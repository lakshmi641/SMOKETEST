/**
 * Import Execution Service
 *
 * Stage 4: Final Payload & API Integration
 * - Transforms validated rows into final database format
 * - Handles sequential ID generation per project
 * - Executes high-performance batch writes to Firestore
 * - Handles parent-child relationships for WBS Gantt
 * - Validates dependency integrity (cycle detection)
 */

import {
    db
} from '../../firebase';
import {
    collection,
    doc,
    getDoc,
    updateDoc,
    writeBatch,
    Timestamp
} from 'firebase/firestore';
import {
    ImportType,
    ValidatedRow
} from './types/import-types';
import { generateProjectCode } from '../../utils/project-utils';
import { ExternalNotificationService } from '../external-notifications/external-notification-service';
import { TaskNotificationService } from '../tasks/task-notification-service';
import { detectImportCycles } from '../../wbs-algorithms';
import { companySubcollectionPathSegments } from '../../firestore-paths';
import { parseDate } from '../../utils/excel/date-parser';

export interface ImportExecutionResult {
    success: boolean;
    importedCount: number;
    failedCount: number;
    errors: string[];
}

export class ImportExecutionService {
    /**
     * Execute the import for validated rows
     */
    static async executeImport(
        companyId: string,
        projectId: string, // This becomes the "default" projectId if row doesn't specify one
        rows: ValidatedRow[],
        importType: ImportType,
        userId: string,
        groupId: string, // Required for multi-tenant paths
        context?: { workspaceId?: string; actorName?: string; parentId?: string; importJobId?: string }
    ): Promise<ImportExecutionResult> {
        const validRows = rows.filter(r => r.status !== 'error');
        if (validRows.length === 0) {
            return { success: true, importedCount: 0, failedCount: 0, errors: [] };
        }

        // WBS Import: Check for circular dependencies before proceeding
        if (importType === 'wbs_gantt') {
            const cycleCheck = detectImportCycles(validRows);
            if (cycleCheck.hasCycle) {
                console.error('[Import] Circular dependency detected:', cycleCheck.errorMessage);
                return {
                    success: false,
                    importedCount: 0,
                    failedCount: validRows.length,
                    errors: [
                        cycleCheck.errorMessage ||
                        'Circular dependency detected in task dependencies. Please fix and retry.'
                    ]
                };
            }
        }

        try {
            // 1. Group rows by Project ID
            // If row has resolvedData.projectId, use it. Otherwise use the passed projectId.
            const rowsByProject: Record<string, ValidatedRow[]> = {};
            validRows.forEach(row => {
                const pid = row.resolvedData.projectId || projectId;
                if (!rowsByProject[pid]) rowsByProject[pid] = [];
                rowsByProject[pid].push(row);
            });

            const requestIdMap: Record<string, string> = {};
            let totalImported = 0;
            const errors: string[] = [];

            // 2. Process each project group
            for (const [pid, projectRows] of Object.entries(rowsByProject)) {
                // Get Project Meta (for sequence IDs)
                const projSegs = companySubcollectionPathSegments(groupId, companyId, 'projects');
                const projectRef = doc(db, ...projSegs, pid);
                const projectSnap = await getDoc(projectRef);

                if (!projectSnap.exists()) {
                    errors.push(`Project ${pid} not found. Skipping ${projectRows.length} tasks.`);
                    continue;
                }

                const projectData = projectSnap.data() as any;
                const projectCode = projectData.projectCode || generateProjectCode(projectData.name || '');
                let currentCounter = projectData.taskCounter || 0;
                const workspaceId = projectData.workspaceId || context?.workspaceId || '';

                // Pre-generate IDs for this project's tasks
                projectRows.forEach(row => {
                    const title = (row.data['Task Name'] || row.data['taskName'] || row.data['Task Title'] || row.data['taskTitle'] || '').trim();
                    const taskSegs = companySubcollectionPathSegments(groupId, companyId, 'tasks');
                    const taskRef = doc(collection(db, taskSegs[0], ...taskSegs.slice(1)));

                    if (title) requestIdMap[`batch-${title}`] = taskRef.id;

                    (row as any).generatedId = taskRef.id;
                });

                // Prepare Chunks
                const BATCH_SIZE = 450;
                for (let i = 0; i < projectRows.length; i += BATCH_SIZE) {
                    const chunk = projectRows.slice(i, i + BATCH_SIZE);
                    const batch = writeBatch(db);

                    for (const row of chunk) {
                        currentCounter++;
                        const generatedId = (row as any).generatedId;
                        const subcoll = importType === 'recurring_tasks' ? 'workspaceRecurringConfigs' : 'tasks';
                        const collSegs = companySubcollectionPathSegments(groupId, companyId, subcoll);
                        const docRef = doc(db, collSegs[0], ...collSegs.slice(1), generatedId);

                        const payload = this.transformRowToPayload(
                            row,
                            companyId,
                            pid,
                            workspaceId,
                            projectCode,
                            currentCounter,
                            userId,
                            importType,
                            requestIdMap,
                            context?.parentId,
                            context?.importJobId
                        );

                        batch.set(docRef, payload);

                        // 3. Log Activity for this task (matching manual task behavior)
                        const activity = {
                            companyId,
                            actorId: userId,
                            type: 'task_created' as const,
                            entityId: generatedId,
                            entityType: 'task' as const,
                            entityName: payload.title,
                            recipientId: payload.assignedUserId || null,
                            details: {
                                projectId: pid,
                                workspaceId: workspaceId,
                                importSource: 'excel',
                                taskNumber: currentCounter,
                                priority: payload.priority
                            },
                            timestamp: new Date().toISOString()
                        };

                        const activitySegs = companySubcollectionPathSegments(groupId, companyId, 'activities');
                        const activityRef = doc(collection(db, activitySegs[0], ...activitySegs.slice(1)));
                        batch.set(activityRef, activity);
                    }

                    // Update project counter
                    batch.update(projectRef, {
                        taskCounter: currentCounter,
                        updatedAt: Timestamp.now()
                    });

                    await batch.commit();
                    totalImported += chunk.length;

                    // 4. Trigger Notifications after successful commit
                    const actorName = context?.actorName || 'Teammate';
                    for (const row of chunk) {
                        const payload = this.transformRowToPayload(
                            row,
                            companyId,
                            pid,
                            workspaceId,
                            projectCode,
                            0, // taskNumber doesn't matter for this call
                            userId,
                            importType,
                            requestIdMap,
                            context?.parentId,
                            context?.importJobId
                        );

                        if (payload.assignedUserId && payload.assignedUserId !== userId) {
                            TaskNotificationService.notifyTaskAssigned(
                                companyId,
                                payload.assignedUserId,
                                { id: (row as any).generatedId, ...payload } as any,
                                groupId
                            ).catch((err: any) => console.error('Failed to trigger import notification:', err));
                        }
                    }
                }
            }

            return {
                success: true,
                importedCount: totalImported,
                failedCount: validRows.length - totalImported,
                errors
            };

        } catch (err: any) {
            console.error('Import execution failed:', err);
            return {
                success: false,
                importedCount: 0,
                failedCount: validRows.length,
                errors: [err.message]
            };
        }
    }

    /**
     * Transform a validated row into the final Payload (Task or Recurring Config)
     */
    private static transformRowToPayload(
        row: ValidatedRow,
        companyId: string,
        projectId: string,
        workspaceId: string,
        projectCode: string,
        taskNumber: number,
        userId: string,
        importType: ImportType,
        requestIdMap: Record<string, string> = {},
        parentId?: string,
        importJobId?: string
    ): any {
        const { data, resolvedData } = row;
        const now = Timestamp.now();

        if (importType === 'recurring_tasks') {
            return this.transformRowToRecurringConfig(row, companyId, projectId, workspaceId, userId);
        }

        // Format: PRJ-001
        const taskCode = `${projectCode}-${String(taskNumber).padStart(3, '0')}`;

        const baseTask: any = {
            title: data['Task Name'] || data['taskName'] || data['Task Title'] || data['taskTitle'] || 'Untitled Task',
            description: data['Description'] || data['description'] || '',
            priority: (data['Priority'] || data['priority'] || 'medium').toLowerCase(),
            projectId,
            companyId,
            taskNumber,
            taskCode,
            projectCode: projectCode || null,

            // Resolved fields from Stage 2 (matching createManualTask logic)
            assignedUserId: (resolvedData.assignedUserId && resolvedData.assignedUserId.trim() !== '')
                ? resolvedData.assignedUserId
                : userId,
            assignedBy: userId, // Required for Cloud Function trigger
            reporter: (resolvedData.reporterId && resolvedData.reporterId.trim() !== '')
                ? resolvedData.reporterId
                : userId,
            status: (data['Status'] || data['status'] || 'assigned').toLowerCase(),
            departmentId: resolvedData.departmentId || null,
            parentId: resolvedData.parentId && resolvedData.parentId.startsWith('batch-')
                ? (requestIdMap[resolvedData.parentId] || null)
                : (resolvedData.parentId || parentId || null),

            // Date handling - prioritize normalized dates from Stage 2 validation
            dueDate: resolvedData.dueDate || this.parseExcelDate(data['Due Date'] || data['dueDate']),
            startDate: resolvedData.startDate || this.parseExcelDate(data['Start Date'] || data['startDate']),
            endDate: resolvedData.endDate || this.parseExcelDate(data['End Date'] || data['endDate'] || data['Due Date'] || data['dueDate']),

            // Standard fields
            estimatedHours: Number(data['Estimated Hours'] || data['estimatedHours']) || 0,
            actualHours: 0,
            progress: 0,
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: userId,
            importSource: 'excel',
            importType,

            // Import Job tracking (Processing ID) - for audit trail
            importJobId: importJobId || null
        };

        // WBS Specific Fields
        if (importType === 'wbs_gantt') {
            baseTask.isMilestone = String(data['Milestone'] || '').toLowerCase() === 'yes';

            // Handle multiple predecessors from validation stage
            const predecessorIds: string[] = resolvedData.predecessorIds ||
                (resolvedData.predecessorId ? [resolvedData.predecessorId] : []);

            if (predecessorIds.length > 0) {
                baseTask.dependencies = predecessorIds
                    .map(predId => {
                        // Cross-reference resolution for batch tasks (batch-{TaskName} → FirestoreID)
                        let finalId: string | null = predId;
                        if (predId && predId.startsWith('batch-')) {
                            finalId = requestIdMap[predId] || null;
                        }
                        return finalId;
                    })
                    .filter((id): id is string => id !== null) // Type guard to filter out nulls
                    .map(targetTaskId => ({
                        targetTaskId,
                        type: (data['Dep Type'] || data['depType'] || 'FS').toUpperCase(),
                        lag: Number(data['Lag Days'] || data['lagDays'] || 0) // Keep as days (matches UI and CPM algorithm)
                    }));
            }

        }


        return baseTask;
    }

    private static transformRowToRecurringConfig(
        row: ValidatedRow,
        companyId: string,
        projectId: string,
        workspaceId: string,
        userId: string
    ): any {
        const { data, resolvedData } = row;

        const freq = (data['Frequency'] || 'weekly').toLowerCase();
        const endTypeRaw = String(data['End Type'] || 'Never').toLowerCase();

        let endCondition: any = { type: 'never' };
        if (endTypeRaw === 'on date' || endTypeRaw === 'on_date') {
            endCondition = {
                type: 'on_date',
                endDate: this.parseExcelDate(data['End Date'])
            };
        } else if (endTypeRaw === 'after count' || endTypeRaw === 'after_count') {
            endCondition = {
                type: 'after_count',
                occurrenceCount: Number(data['End Count'] || 1)
            };
        }

        const weekDaysVal = data['Week Days'] || data['weekDays'];
        let weekDays: number[] = [];
        if (weekDaysVal) {
            const dayMap: Record<string, number> = {
                sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
                sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
            };
            weekDays = String(weekDaysVal).split(',').map(s => {
                const clean = s.trim().toLowerCase();
                if (dayMap[clean] !== undefined) return dayMap[clean];
                const num = parseInt(clean);
                return isNaN(num) ? null : num;
            }).filter(d => d !== null) as number[];
        }

        // Match RecurringConfig schema
        return {
            companyId,
            workspaceId,
            projectId,
            taskDefinition: {
                title: data['Task Name'] || data['taskName'] || 'Untitled Recurring Task',
                description: data['Description'] || data['description'] || '',
                priority: (data['Priority'] || data['priority'] || 'medium').toLowerCase(),

                estimatedHours: Number(data['Estimated Hours'] || 0),
                department: resolvedData.departmentId || null,
                requirementType: resolvedData.requirementTypeId || null,
                taskType: resolvedData.taskTypeId || null
            },
            schedule: {
                frequency: freq,
                interval: Number(data['Interval'] || 1),
                weekDays: weekDays.length > 0 ? weekDays : undefined,
                monthDay: data['Month Day'] ? Number(data['Month Day']) : undefined,
                isLastDayOfMonth: String(data['Last Day of Month']).toLowerCase() === 'yes' || String(data['Last Day of Month']).toLowerCase() === 'true',
                quarterMonth: data['Quarter Month'] ? Number(data['Quarter Month']) : undefined,
                startTime: data['Start Time'] || '09:00',
                timezone: data['Timezone'] || 'Asia/Kolkata',
                startDate: resolvedData.startDate || this.parseExcelDate(data['Start Date']) || new Date().toISOString().split('T')[0],
                dueDays: data['Due Days'] ? Number(data['Due Days']) : 0,
                endCondition
            },
            assignment: {
                type: (data['Assignment Type'] || data['Assignment Strategy']) === 'Position / Role' ? 'position' : 'specific_user',
                value: (data['Assignment Type'] || data['Assignment Strategy']) === 'Position / Role'
                    ? (resolvedData.positionId || resolvedData.departmentId || '')
                    : (resolvedData.assignedUserId || userId)
            },
            status: 'active',
            isActive: true,
            currentVersion: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: userId,
            importSource: 'excel'
        };
    }

    /**
     * Handle Excel date parsing (handles both string and Serial Number)
     */
    private static parseExcelDate(value: any): string | null {
        if (!value) return null;

        // If it's already an ISO string (YYYY-MM-DD or similar)
        if (typeof value === 'string' && value.includes('-')) {
            // Basic validation to ensure it's not a DD-MM-YYYY which might be mistaken for ISO
            if (value.match(/^\d{4}-\d{2}-\d{2}/)) return value;
        }

        // Use the robust utility for parsing
        const normalized = parseDate(String(value));
        if (normalized) return normalized;

        // Fallback for native objects if any
        try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0] || null;
            }
        } catch (e) { }

        return null;
    }
}
