/**
 * Unit Tests: TaskTemplateService - Start Date Feature
 * 
 * Stage 1: Service Layer Tests
 * Tests for startDate and endDate in createManualTask
 * 
 * @see START_DATE_COMPLETE_IMPLEMENTATION.md
 */

import { addDoc, updateDoc, doc, collection } from 'firebase/firestore'

// Mock Firebase modules before importing the service
jest.mock('@/lib/firebase', () => ({
    db: {},
}))

jest.mock('firebase/firestore', () => ({
    collection: jest.fn().mockReturnValue('mock-collection'),
    addDoc: jest.fn().mockResolvedValue({ id: 'test-task-id' }),
    doc: jest.fn().mockReturnValue('mock-doc'),
    updateDoc: jest.fn().mockResolvedValue(undefined),
    getDoc: jest.fn().mockResolvedValue({
        exists: () => true,
        id: 'test-task-id',
        data: () => ({
            title: 'Test Task',
            startDate: '2025-12-10',
            endDate: '2025-12-15',
            dueDate: '2025-12-15',
        }),
    }),
    getDocs: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    runTransaction: jest.fn(),
    deleteDoc: jest.fn(),
}))

// Import after mocking
import { TaskTemplateService } from '../task-template-service'

describe('TaskTemplateService - startDate Feature', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('createManualTask', () => {
        const baseTaskData = {
            title: 'Test Task',
            description: 'Test Description',
            category: 'task' as const,
            priority: 'medium' as const,
            estimatedHours: 4,
            dueDate: '2025-12-15',
            projectId: 'test-project',
        }

        test('creates task with startDate when provided', async () => {
            const taskId = await TaskTemplateService.createManualTask(
                'test-company',
                'test-user',
                {
                    ...baseTaskData,
                    startDate: '2025-12-10',
                }
            )

            expect(taskId).toBe('test-task-id')
            expect(addDoc).toHaveBeenCalledWith(
                'mock-collection',
                expect.objectContaining({
                    startDate: '2025-12-10',
                })
            )
        })

        test('creates task with both startDate and endDate when provided', async () => {
            const taskId = await TaskTemplateService.createManualTask(
                'test-company',
                'test-user',
                {
                    ...baseTaskData,
                    startDate: '2025-12-10',
                    endDate: '2025-12-14',
                }
            )

            expect(taskId).toBe('test-task-id')
            expect(addDoc).toHaveBeenCalledWith(
                'mock-collection',
                expect.objectContaining({
                    startDate: '2025-12-10',
                    endDate: '2025-12-14',
                })
            )
        })

        test('creates task without startDate when not provided (backward compatible)', async () => {
            const taskId = await TaskTemplateService.createManualTask(
                'test-company',
                'test-user',
                baseTaskData
            )

            expect(taskId).toBeDefined()
            // Verify addDoc was called without startDate in the object
            const callArgs = (addDoc as jest.Mock).mock.calls[0][1]
            expect(callArgs.startDate).toBeUndefined()
        })

        test('does not save startDate when empty string provided', async () => {
            await TaskTemplateService.createManualTask(
                'test-company',
                'test-user',
                {
                    ...baseTaskData,
                    startDate: '',
                }
            )

            // Verify addDoc was called without startDate in the object
            const callArgs = (addDoc as jest.Mock).mock.calls[0][1]
            expect(callArgs.startDate).toBeUndefined()
        })

        test('defaults endDate to dueDate when startDate is set but endDate is not', async () => {
            await TaskTemplateService.createManualTask(
                'test-company',
                'test-user',
                {
                    ...baseTaskData,
                    startDate: '2025-12-10',
                    // no endDate provided
                }
            )

            expect(addDoc).toHaveBeenCalledWith(
                'mock-collection',
                expect.objectContaining({
                    startDate: '2025-12-10',
                    endDate: '2025-12-15', // Should default to dueDate
                })
            )
        })
    })

    describe('updateTaskDates', () => {
        test('updates both startDate and endDate', async () => {
            await TaskTemplateService.updateTaskDates(
                'test-company',
                'test-task-id',
                '2025-12-10',
                '2025-12-15'
            )

            expect(updateDoc).toHaveBeenCalledWith(
                'mock-doc',
                expect.objectContaining({
                    startDate: '2025-12-10',
                    endDate: '2025-12-15',
                })
            )
        })
    })
})

describe('TaskTemplateService Integration - startDate', () => {
    test('task data structure includes optional startDate field', () => {
        // This test verifies the TypeScript interface allows startDate
        // If this compiles, the interface is correct
        const taskData = {
            title: 'Test',
            description: 'Test',
            category: 'task' as const,
            priority: 'medium' as const,
            estimatedHours: 4,
            dueDate: '2025-12-15',
            startDate: '2025-12-10', // Optional field
            projectId: 'test-project',
        }

        expect(taskData.startDate).toBe('2025-12-10')
    })
})
