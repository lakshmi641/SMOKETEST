import { render, screen } from '@testing-library/react'
import { MilestoneBattery } from '../MilestoneBattery'
import { DashboardThemeWrapper } from '../../theme/DashboardThemeWrapper'
import { MilestoneHealth } from '@/lib/services/dashboard/analytics'

// Mock the theme context
jest.mock('../../theme/DashboardThemeWrapper', () => ({
  useDashboardTheme: jest.fn(() => ({
    card: 'rounded-xl shadow-sm border border-border bg-card p-6',
    header: 'text-2xl font-bold',
    progress: 'h-3 rounded-full bg-secondary'
  }))
}))

describe('MilestoneBattery', () => {
  it('renders empty state when no milestones', () => {
    render(<MilestoneBattery milestones={[]} />)
    expect(screen.getByText('No milestones found')).toBeInTheDocument()
  })

  it('renders correct segments for mixed milestones', () => {
    const milestones: MilestoneHealth[] = [
      { id: '1', title: 'M1', date: '2024-01-01', status: 'completed', isCritical: false },
      { id: '2', title: 'M2', date: '2024-01-02', status: 'at_risk', isCritical: true },
      { id: '3', title: 'M3', date: '2024-01-03', status: 'on_track', isCritical: false },
    ]

    render(<MilestoneBattery milestones={milestones} />)
    
    expect(screen.getByText('3')).toBeInTheDocument() // Total
    expect(screen.getByText('1')).toBeInTheDocument() // At Risk count
  })

  it('handles 0 blocked tasks gracefully', () => {
    const milestones: MilestoneHealth[] = [
      { id: '1', title: 'M1', date: '2024-01-01', status: 'completed', isCritical: false },
    ]

    render(<MilestoneBattery milestones={milestones} />)
    
    // Should not crash with NaN
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
