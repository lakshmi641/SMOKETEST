import { analyzeBlockers, analyzeMilestones } from '../analytics'
import type { GeneratedTask } from '@/types/task-template-schema'

// Mock Helper
const createMockTask = (overrides: Partial<GeneratedTask>): GeneratedTask => ({
  id: 't1',
  title: 'Test Task',
  status: 'assigned',
  dueDate: new Date().toISOString(),
  priority: 'medium',
  estimatedHours: 8,
  assignmentType: 'manual',
  assignmentReason: '',
  assignedUserId: 'u1',
  assignedBy: 'u1',
  projectId: 'p1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  progress: 0,
  definitionOfDone: [],
  ...overrides
})

describe('Dashboard Analytics Engine', () => {
  
  describe('analyzeMilestones', () => {
    it('identifies completed milestones', () => {
      const tasks = [
        createMockTask({ 
          id: 'm1', 
          isMilestone: true, 
          status: 'completed',
          targetDate: '2024-01-01' 
        })
      ]
      const result = analyzeMilestones(tasks)
      expect(result[0].status).toBe('completed')
    })

    it('identifies late milestones', () => {
      // Date in past
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 10)
      
      const tasks = [
        createMockTask({ 
          id: 'm1', 
          isMilestone: true, 
          status: 'assigned',
          targetDate: pastDate.toISOString()
        })
      ]
      const result = analyzeMilestones(tasks)
      expect(result[0].status).toBe('late')
    })
  })

  describe('analyzeBlockers', () => {
    it('detects explicit blockers (escalated status)', () => {
      const tasks = [
        createMockTask({ id: 't1', status: 'escalated' })
      ]
      const result = analyzeBlockers(tasks)
      expect(result).toHaveLength(1)
      expect(result[0].reason).toBe('explicit_status')
    })

    it('detects implicit blockers (dependency failure)', () => {
      // Task 1 is overdue
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)

      const tasks = [
        createMockTask({ 
          id: 't1', 
          status: 'in_progress', 
          dueDate: pastDate.toISOString() 
        }),
        createMockTask({ 
          id: 't2', 
          status: 'assigned',
          dependencies: [{ targetTaskId: 't1', type: 'FS', lag: 0 }] 
        })
      ]

      const result = analyzeBlockers(tasks)
      // t2 should be blocked because t1 is overdue
      expect(result).toHaveLength(1)
      expect(result[0].taskId).toBe('t2')
      expect(result[0].reason).toBe('dependency_failure')
    })
  })
})


