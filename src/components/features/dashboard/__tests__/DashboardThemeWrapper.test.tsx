import { render, screen } from '@testing-library/react'
import { DashboardThemeWrapper } from '../theme/DashboardThemeWrapper'
import { THEME_STYLES } from '../theme/theme-config'
import { useUIStore } from '@/store/uiStore'

// Mock the store
jest.mock('@/store/uiStore', () => ({
  useUIStore: jest.fn()
}))

describe('DashboardThemeWrapper', () => {
  it('applies modern theme styles by default', () => {
    (useUIStore as unknown as jest.Mock).mockReturnValue({ dashboardTheme: 'modern' })
    
    render(
      <DashboardThemeWrapper>
        <div data-testid="child">Child</div>
      </DashboardThemeWrapper>
    )

    // Check if the container class from config is applied (roughly)
    // Note: The wrapper applies the container class to the div it renders
    // We need to check the parent div of the child
    const child = screen.getByTestId('child')
    const wrapperDiv = child.parentElement
    
    expect(wrapperDiv).toHaveClass('space-y-6')
    expect(wrapperDiv).toHaveClass('p-6')
  })

  it('switches to compact theme styles', () => {
    (useUIStore as unknown as jest.Mock).mockReturnValue({ dashboardTheme: 'compact' })
    
    render(
      <DashboardThemeWrapper>
        <div data-testid="child">Child</div>
      </DashboardThemeWrapper>
    )

    const child = screen.getByTestId('child')
    const wrapperDiv = child.parentElement
    
    expect(wrapperDiv).toHaveClass('space-y-4') // Compact spacing
    expect(wrapperDiv).toHaveClass('p-4')
  })
})


