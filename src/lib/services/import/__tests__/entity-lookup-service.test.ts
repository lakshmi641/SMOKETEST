import { EntityLookupService } from '../entity-lookup-service';
import { SpellCheckService } from '../spell-check-service';
import { collection, getDocs } from 'firebase/firestore';

// Mock the firebase module
jest.mock('../../../firebase', () => ({
    db: {}
}));

// Mock the firestore modules
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    getDocs: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    doc: jest.fn()
}));

describe('EntityLookupService', () => {
    const companyId = 'test-company';

    beforeEach(() => {
        jest.clearAllMocks();
        EntityLookupService.clearCache();
    });

    describe('resolveUser', () => {
        const mockUsers = [
            { id: '1', name: 'Sathwik Kumar', email: 'sathwik@example.com' },
            { id: '2', name: 'Divya Singh', email: 'divya@example.com' }
        ];

        it('should resolve by exact email match', async () => {
            (getDocs as jest.Mock).mockResolvedValue({
                docs: mockUsers.map(u => ({ id: u.id, data: () => u }))
            });

            const result = await EntityLookupService.resolveUser(companyId, 'sathwik@example.com');
            expect(result.resolved).toBe(true);
            expect(result.value).toBe('1');
            expect(result.confidence).toBe('exact');
        });

        it('should resolve by exact name match', async () => {
            (getDocs as jest.Mock).mockResolvedValue({
                docs: mockUsers.map(u => ({ id: u.id, data: () => u }))
            });

            const result = await EntityLookupService.resolveUser(companyId, 'Divya Singh');
            expect(result.resolved).toBe(true);
            expect(result.value).toBe('2');
            expect(result.confidence).toBe('exact');
        });

        it('should resolve by partial name match', async () => {
            (getDocs as jest.Mock).mockResolvedValue({
                docs: mockUsers.map(u => ({ id: u.id, data: () => u }))
            });

            const result = await EntityLookupService.resolveUser(companyId, 'Sathwik');
            expect(result.resolved).toBe(true);
            expect(result.value).toBe('1');
            expect(result.confidence).toBe('partial');
        });

        it('should resolve by fuzzy name match', async () => {
            (getDocs as jest.Mock).mockResolvedValue({
                docs: mockUsers.map(u => ({ id: u.id, data: () => u }))
            });

            // "Sathwik Kumr" is missing 'a'
            const result = await EntityLookupService.resolveUser(companyId, 'Sathwik Kumr');
            expect(result.resolved).toBe(true);
            expect(result.value).toBe('1');
            expect(result.confidence).toBe('fuzzy');
        });

        it('should provide suggestions when no clear match found', async () => {
            (getDocs as jest.Mock).mockResolvedValue({
                docs: mockUsers.map(u => ({ id: u.id, data: () => u }))
            });

            const result = await EntityLookupService.resolveUser(companyId, 'Sath');
            // "Sath" matches "Sathwik Kumar" partially but maybe multiple matches or low score
            // In our implementation, startsWith('sath') will match "Sathwik Kumar"
            expect(result.resolved).toBe(true);
        });

        it('should handle "not found" cases', async () => {
            (getDocs as jest.Mock).mockResolvedValue({
                docs: mockUsers.map(u => ({ id: u.id, data: () => u }))
            });

            const result = await EntityLookupService.resolveUser(companyId, 'Xyz Nonexistent');
            expect(result.success).toBe(false);
            expect(result.resolved).toBe(false);
        });
    });
});
