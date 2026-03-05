/**
 * Unit Tests: TaskForm - Start Date Feature
 * 
 * Stage 2: TaskForm UI Tests
 * Tests for Start Date picker visibility, optionality, and form submission
 * 
 * @see START_DATE_COMPLETE_IMPLEMENTATION.md
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TaskForm, TaskFormData } from '../TaskForm'

// Mock dependencies
jest.mock('@/contexts/CompanyContext', () => ({
    useCompany: () => ({ companyId: 'test-company' }),
}))

jest.mock('@/store/authStore', () => ({
    useAuthStore: () => ({
        user: { id: 'test-user', name: 'Test User' }
    }),
}))

jest.mock('@/lib/services', () => ({
    UserService: {
        getUsers: jest.fn().mockResolvedValue([
            { id: 'test-user', name: 'Test User' }
        ]),
    },
    ProjectService: {
        getProjects: jest.fn().mockResolvedValue([
            { id: 'project-1', name: 'Test Project', status: 'active' }
        ]),
    },
    TaskMasterDataService: {
        getTaskTypes: jest.fn().mockResolvedValue([]),
        getRequirementTypes: jest.fn().mockResolvedValue([]),
    },
}))

jest.mock('@/lib/services/org/org-services', () => ({
    getOrgUnits: jest.fn().mockResolvedValue([]),
}))

// Mock UI components that might cause issues in JSDOM
jest.mock('@/components/ui/drawer', () => ({
    Drawer: ({ children, open }: any) => open ? <div>{children}</div> : null,
    DrawerContent: ({ children }: any) => <div>{children}</div>,
    DrawerFooter: ({ children }: any) => <div>{children}</div>,
}))

describe('TaskForm - Start Date Feature', () => {
    const defaultProps = {
        isOpen: true,
        onClose: jest.fn(),
        onSubmit: jest.fn(),
        mode: 'create' as const,
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('renders start date input', async () => {
        render(<TaskForm {...defaultProps} />)
        expect(screen.getByText(/start date/i)).toBeInTheDocument()
        expect(screen.getByTestId('start-date-input')).toBeInTheDocument()
    })

    test('start date is marked as optional', async () => {
        render(<TaskForm {...defaultProps} />)
        expect(screen.getByText(/optional/i)).toBeInTheDocument()
    })

    test('can clear start date', async () => {
        render(<TaskForm {...defaultProps} />)

        const startDateInput = screen.getByTestId('start-date-input')

        // Set a date
        fireEvent.change(startDateInput, { target: { value: '2025-12-10' } })
        expect(startDateInput).toHaveValue('2025-12-10')

        // Clear button should appear
        const clearButton = screen.getByTestId('clear-start-date')
        fireEvent.click(clearButton)

        // Verify cleared
        expect(startDateInput).toHaveValue('')
    })

    test('form submits with startDate when set', async () => {
        const onSubmit = jest.fn()
        render(<TaskForm {...defaultProps} onSubmit={onSubmit} />)

        // Fill required fields
        fireEvent.change(screen.getByPlaceholderText(/enter task title/i), { target: { value: 'Test Task' } })

        // Set start date
        fireEvent.change(screen.getByTestId('start-date-input'), { target: { value: '2025-12-10' } })

        // Set due date
        fireEvent.change(screen.getByTestId('due-date-input'), { target: { value: '2025-12-15' } })

        // Submit
        const submitButton = screen.getByText('Create Task')
        expect(submitButton).not.toBeDisabled()
        fireEvent.click(submitButton)

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Test Task',
                    startDate: '2025-12-10',
                    dueDate: '2025-12-15',
                })
            )
        })
    })

    test('form submits without startDate when not set', async () => {
        const onSubmit = jest.fn()
        render(<TaskForm {...defaultProps} onSubmit={onSubmit} />)

        // Fill required fields
        fireEvent.change(screen.getByPlaceholderText(/enter task title/i), { target: { value: 'Test Task' } })

        // Set due date only
        fireEvent.change(screen.getByTestId('due-date-input'), { target: { value: '2025-12-15' } })

        // Submit
        fireEvent.click(screen.getByText('Create Task'))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Test Task',
                    startDate: '', // Should be empty string as initialized
                    dueDate: '2025-12-15',
                })
            )
        })
    })

    test('populates startDate in edit mode', async () => {
        const mockTask = {
            id: 'task-1',
            title: 'Existing Task',
            status: 'assigned',
            priority: 'medium',
            dueDate: '2025-12-15T00:00:00.000Z',
            startDate: '2025-12-10T00:00:00.000Z',
            projectId: 'project-1',
            estimatedHours: 2,
            category: 'task',
            createdAt: '',
            updatedAt: '',
            assignmentType: 'manual',
            assignmentReason: '',
            assignedBy: 'user-1',
            assignedUserId: 'user-1',
            progress: 0,
            definitionOfDone: []
        } as any

        render(<TaskForm {...defaultProps} mode="edit" task={mockTask} />)

        const startDateInput = screen.getByTestId('start-date-input')
        expect(startDateInput).toHaveValue('2025-12-10')
    })
})
