import { render, screen } from '@testing-library/react'
import { BlockerAnalysis } from '../BlockerAnalysis'
import { BlockerInfo } from '@/lib/services/dashboard/analytics'

jest.mock('../../theme/DashboardThemeWrapper', () => ({
  useDashboardTheme: jest.fn(() => ({
    card: 'rounded-xl shadow-sm border border-border bg-card p-6',
    header: 'text-2xl font-bold',
    table: 'w-full border-separate border-spacing-0'
  }))
}))

describe('BlockerAnalysis', () => {
  it('renders empty state when no blockers', () => {
    render(<BlockerAnalysis blockers={[]} totalActiveTasks={10} />)
    expect(screen.getByText('No active blockers.')).toBeInTheDocument()
  })

  it('calculates percentage correctly', () => {
    const blockers: BlockerInfo[] = [
      { taskId: '1', taskTitle: 'Task 1', reason: 'explicit_status', blockerDetails: 'Escalated', ageInDays: 2 }
    ]

    render(<BlockerAnalysis blockers={blockers} totalActiveTasks={10} />)
    
    // 1 blocked out of 10 = 10%
    expect(screen.getByText('10%')).toBeInTheDocument()
    expect(screen.getByText('1 / 10')).toBeInTheDocument()
  })

  it('handles 0 total tasks gracefully (no NaN)', () => {
    render(<BlockerAnalysis blockers={[]} totalActiveTasks={0} />)
    
    // Should show 0% not NaN
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})
