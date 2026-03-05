import { SpecificValidationService } from '../specific-validation-service';
import { EntityLookupService } from '../entity-lookup-service';
import { ImportContext } from '../types/import-types';

// Mock the firebase module
jest.mock('../../../firebase', () => ({
    db: {}
}));

// Mock the firestore modules
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    getDocs: jest.fn(),
    query: jest.fn(),
    where: jest.fn()
}));

// Mock the EntityLookupService
jest.mock('../entity-lookup-service');

describe('SpecificValidationService', () => {
    const context: ImportContext = {
        companyId: 'test-company',
        workspaceId: 'test-workspace',
        userId: 'test-user'
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('validateRow', () => {
        it('should resolve assignee name correctly', async () => {
            (EntityLookupService.resolveUser as jest.Mock).mockResolvedValue({
                success: true,
                resolved: true,
                value: 'user-123',
                label: 'Sathwik Kumar',
                confidence: 'exact'
            });

            const row = { 'Task Name': 'Task 1', 'Assignee': 'Sathwik Kumar' };
            const result = await (SpecificValidationService as any).validateRow(row, 2, 'project_tasks', context);

            expect(result.status).toBe('success');
            expect(result.resolvedData.assignedUserId).toBe('user-123');
            expect(result.messages).toHaveLength(0);
        });

        it('should handle fuzzy matches with a warning', async () => {
            (EntityLookupService.resolveUser as jest.Mock).mockResolvedValue({
                success: true,
                resolved: true,
                value: 'user-123',
                label: 'Sathwik Kumar',
                confidence: 'fuzzy'
            });

            const row = { 'Task Name': 'Task 1', 'Assignee': 'Sathwk' };
            const result = await (SpecificValidationService as any).validateRow(row, 2, 'project_tasks', context);

            expect(result.status).toBe('warning');
            expect(result.messages[0]?.severity).toBe('warning');
            expect(result.messages[0]?.message).toContain('Auto-resolved');
        });

        it('should handle resolution failures with an error and suggestion', async () => {
            (EntityLookupService.resolveUser as jest.Mock).mockResolvedValue({
                success: true,
                resolved: false,
                confidence: 'none',
                suggestions: [{ value: 'user-123', label: 'Sathwik Kumar', confidence: 0.8 }]
            });

            const row = { 'Task Name': 'Task 1', 'Assignee': 'Unknown' };
            const result = await (SpecificValidationService as any).validateRow(row, 2, 'project_tasks', context);

            expect(result.status).toBe('error');
            expect(result.messages[0]?.severity).toBe('error');
            expect(result.messages[0]?.suggestion?.label).toBe('Sathwik Kumar');
        });
    });

    describe('validate', () => {
        it('should process multiple rows and provide a summary', async () => {
            (EntityLookupService.resolveUser as jest.Mock).mockResolvedValue({
                success: true,
                resolved: true,
                value: 'user-123',
                label: 'Sathwik Kumar',
                confidence: 'exact'
            });
            (EntityLookupService.resolveDepartment as jest.Mock).mockResolvedValue({
                success: true,
                resolved: true,
                value: 'dept-123',
                label: 'Engineering',
                confidence: 'exact'
            });

            const rows = [
                { 'Task Name': 'Task 1', 'Assignee': 'Sathwik Kumar', 'Department': 'Engineering' },
                { 'Task Name': 'Task 2', 'Assignee': 'Sathwik Kumar', 'Department': 'Engineering' }
            ];

            const result = await SpecificValidationService.validate(rows, 'project_tasks', context);

            expect(result.success).toBe(true);
            expect(result.summary.totalRows).toBe(2);
            expect(result.summary.validRows).toBe(2);
            expect(result.rows[0]?.resolvedData.assignedUserId).toBe('user-123');
            expect(result.rows[0]?.resolvedData.departmentId).toBe('dept-123');
        });
    });
});
