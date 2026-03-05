import { ImportExecutionService } from '../import-execution-service';
import { ValidatedRow } from '../types/import-types';
import {
    writeBatch,
    doc,
    getDoc,
    collection
} from 'firebase/firestore';

// Mock Firebase
jest.mock('../../../firebase', () => ({
    db: {}
}));

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn((...args) => {
        const id = args.length > 2 ? args[2] : (args.length === 2 && typeof args[1] === 'string' ? args[1] : 'mock-id-' + Math.random());
        return { id };
    }),
    getDoc: jest.fn(),
    updateDoc: jest.fn(),
    writeBatch: jest.fn(),
    increment: jest.fn(),
    Timestamp: {
        now: () => ({ toDate: () => new Date() })
    }
}));

describe('ImportExecutionService', () => {
    const companyId = 'test-company';
    const projectId = 'test-project';
    const userId = 'test-user';

    const mockRows: ValidatedRow[] = [
        {
            rowNumber: 2,
            status: 'success',
            data: { 'Task Name': 'Task 1', 'Priority': 'High' },
            resolvedData: { assignedUserId: 'user-1' },
            messages: []
        },
        {
            rowNumber: 3,
            status: 'warning',
            data: { 'Task Name': 'Task 2', 'Priority': 'Low' },
            resolvedData: { assignedUserId: 'user-2' },
            messages: [{ field: 'Assignee', message: 'Fuzzy matched', severity: 'warning' }]
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock project doc
        (getDoc as jest.Mock).mockResolvedValue({
            exists: () => true,
            data: () => ({ projectCode: 'PRJ', taskCounter: 10 })
        });

        // Mock writeBatch
        (writeBatch as jest.Mock).mockReturnValue({
            set: jest.fn(),
            update: jest.fn(),
            commit: jest.fn().mockResolvedValue(true)
        });
    });

    it('should transform rows and execute batch writes', async () => {
        const result = await ImportExecutionService.executeImport(
            companyId,
            projectId,
            mockRows,
            'project_tasks',
            userId
        );

        expect(result.success).toBe(true);
        expect(result.importedCount).toBe(2);
        expect(writeBatch).toHaveBeenCalled();

        // Verifying sequence IDs
        const batch = (writeBatch as jest.Mock).mock.results[0]!.value;
        expect(batch.set).toHaveBeenCalledTimes(2);

        // Task 1 should have taskNumber 11 and taskCode PRJ-011
        const firstTaskData = batch.set.mock.calls[0][1];
        expect(firstTaskData.taskNumber).toBe(11);
        expect(firstTaskData.taskCode).toBe('PRJ-011');
    });

    it('should resolve batch predecessors to generated IDs', async () => {
        const batchRows: ValidatedRow[] = [
            {
                rowNumber: 2,
                status: 'success',
                data: { 'Task Name': 'Parent Task' },
                resolvedData: {},
                messages: []
            },
            {
                rowNumber: 3,
                status: 'success',
                data: { 'Task Name': 'Child Task', 'Dep Type': 'FS' },
                resolvedData: { predecessorId: 'batch-Parent Task' },
                messages: []
            }
        ];

        await ImportExecutionService.executeImport(
            companyId,
            projectId,
            batchRows,
            'wbs_gantt',
            userId
        );

        const batch = (writeBatch as jest.Mock).mock.results[0]!.value;
        const parentTaskSet = batch.set.mock.calls[0];
        const childTaskSet = batch.set.mock.calls[1];

        const parentId = parentTaskSet[0].id;
        const childData = childTaskSet[1];

        expect(childData.dependencies[0].targetTaskId).toBe(parentId);
    });
    it('should resolve batch parent tasks to generated IDs', async () => {
        const batchRows: ValidatedRow[] = [
            {
                rowNumber: 2,
                status: 'success',
                data: { 'Task Name': 'Main Task' },
                resolvedData: {},
                messages: []
            },
            {
                rowNumber: 3,
                status: 'success',
                data: { 'Task Name': 'Sub Task', 'Parent Task': 'Main Task' },
                resolvedData: { parentId: 'batch-Main Task' },
                messages: []
            }
        ];

        await ImportExecutionService.executeImport(
            companyId,
            projectId,
            batchRows,
            'project_tasks',
            userId
        );

        const batch = (writeBatch as jest.Mock).mock.results[0]!.value;
        const mainTaskSet = batch.set.mock.calls[0];
        const subTaskSet = batch.set.mock.calls[1];

        const mainId = mainTaskSet[0].id;
        const subData = subTaskSet[1];

        expect(subData.parentId).toBe(mainId);
    });

    it('should handle recurring tasks import type', async () => {
        const recurringRows: ValidatedRow[] = [
            {
                rowNumber: 2,
                status: 'success',
                data: {
                    'Task Name': 'Weekly Report',
                    'Frequency': 'weekly',
                    'Interval': 1,
                    'Assignment Strategy': 'Specific User'
                },
                resolvedData: { assignedUserId: 'user-1' },
                messages: []
            }
        ];

        const result = await ImportExecutionService.executeImport(
            companyId,
            projectId,
            recurringRows,
            'recurring_tasks',
            userId,
            { workspaceId: 'ws-1' }
        );

        expect(result.success).toBe(true);
        expect(writeBatch).toHaveBeenCalled();

        const batch = (writeBatch as jest.Mock).mock.results[0]!.value;
        const call = batch.set.mock.calls[0];

        // Should use recurring configs collection
        expect(call[0].id).toBeDefined();
        // Schema check
        expect(call[1].taskDefinition.title).toBe('Weekly Report');
        expect(call[1].schedule.frequency).toBe('weekly');
        expect(call[1].assignment.strategy).toBe('static_identity');
        expect(call[1].workspaceId).toBe('ws-1');
    });
});
