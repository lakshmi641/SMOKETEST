import { renderHook, act } from '@testing-library/react'
import { useCalendarState } from '../useCalendarState'

describe('useCalendarState', () => {
    // ============================================================================
    // Initialization Tests
    // ============================================================================

    test('initializes with current date', () => {
        const { result } = renderHook(() => useCalendarState())
        const today = new Date()
        expect(result.current.currentDate.toDateString()).toBe(today.toDateString())
    })

    test('initializes with month view mode', () => {
        const { result } = renderHook(() => useCalendarState())
        expect(result.current.viewMode).toBe('month')
    })

    test('initializes with empty filters', () => {
        const { result } = renderHook(() => useCalendarState())
        expect(result.current.filters.search).toBe('')
        expect(result.current.filters.assignedToMe).toBe(false)
        expect(result.current.filters.showCompleted).toBe(true)
    })

    // ============================================================================
    // Navigation Tests
    // ============================================================================

    test('goToToday sets date to today', () => {
        const { result } = renderHook(() => useCalendarState())

        // Navigate away first
        act(() => result.current.goToNext())
        act(() => result.current.goToNext())

        // Then go to today
        act(() => result.current.goToToday())

        const today = new Date()
        expect(result.current.currentDate.toDateString()).toBe(today.toDateString())
    })

    test('goToPrevious moves to previous month in month view', () => {
        const { result } = renderHook(() => useCalendarState())
        const initialMonth = result.current.currentDate.getMonth()

        act(() => result.current.goToPrevious())

        // Previous month (handle year wrap)
        const expectedMonth = initialMonth === 0 ? 11 : initialMonth - 1
        expect(result.current.currentDate.getMonth()).toBe(expectedMonth)
    })

    test('goToNext moves to next month in month view', () => {
        const { result } = renderHook(() => useCalendarState())
        const initialMonth = result.current.currentDate.getMonth()

        act(() => result.current.goToNext())

        // Next month (handle year wrap)
        const expectedMonth = initialMonth === 11 ? 0 : initialMonth + 1
        expect(result.current.currentDate.getMonth()).toBe(expectedMonth)
    })

    // ============================================================================
    // Calendar Days Tests
    // ============================================================================

    test('calendarDays returns 35-42 days for month view', () => {
        const { result } = renderHook(() => useCalendarState())
        expect(result.current.calendarDays.length).toBeGreaterThanOrEqual(35)
        expect(result.current.calendarDays.length).toBeLessThanOrEqual(42)
    })

    test('calendarDays returns 7 days for week view', () => {
        const { result } = renderHook(() => useCalendarState())

        act(() => result.current.setViewMode('week'))

        expect(result.current.calendarDays.length).toBe(7)
    })

    test('calendarDays returns 1 day for day view', () => {
        const { result } = renderHook(() => useCalendarState())

        act(() => result.current.setViewMode('day'))

        expect(result.current.calendarDays.length).toBe(1)
    })

    test('calendarDays first day is Monday in month view', () => {
        const { result } = renderHook(() => useCalendarState())
        const firstDay = result.current.calendarDays[0]
        expect(firstDay.getDay()).toBe(1) // 1 = Monday
    })

    // ============================================================================
    // View Mode Tests
    // ============================================================================

    test('setViewMode changes between month/week/day', () => {
        const { result } = renderHook(() => useCalendarState())

        act(() => result.current.setViewMode('week'))
        expect(result.current.viewMode).toBe('week')

        act(() => result.current.setViewMode('day'))
        expect(result.current.viewMode).toBe('day')

        act(() => result.current.setViewMode('month'))
        expect(result.current.viewMode).toBe('month')
    })

    // ============================================================================
    // Filter Tests
    // ============================================================================

    test('toggleAssignedToMe toggles filter state', () => {
        const { result } = renderHook(() => useCalendarState())

        expect(result.current.filters.assignedToMe).toBe(false)

        act(() => result.current.toggleAssignedToMe())
        expect(result.current.filters.assignedToMe).toBe(true)

        act(() => result.current.toggleAssignedToMe())
        expect(result.current.filters.assignedToMe).toBe(false)
    })

    test('updateFilter updates specific filter', () => {
        const { result } = renderHook(() => useCalendarState())

        act(() => result.current.updateFilter('search', 'test query'))
        expect(result.current.filters.search).toBe('test query')
    })

    test('resetFilters clears all filters', () => {
        const { result } = renderHook(() => useCalendarState())

        // Set some filters
        act(() => {
            result.current.updateFilter('search', 'test')
            result.current.toggleAssignedToMe()
            result.current.toggleShowCompleted()
        })

        // Reset
        act(() => result.current.resetFilters())

        expect(result.current.filters.search).toBe('')
        expect(result.current.filters.assignedToMe).toBe(false)
        expect(result.current.filters.showCompleted).toBe(true)
    })

    // ============================================================================
    // Quick Add Tests
    // ============================================================================

    test('openQuickAdd sets quickAddDate', () => {
        const { result } = renderHook(() => useCalendarState())
        const testDate = new Date(2025, 11, 15)

        act(() => result.current.openQuickAdd(testDate))

        expect(result.current.quickAddDate?.toDateString()).toBe(testDate.toDateString())
    })

    test('closeQuickAdd clears quickAddDate', () => {
        const { result } = renderHook(() => useCalendarState())
        const testDate = new Date(2025, 11, 15)

        act(() => result.current.openQuickAdd(testDate))
        act(() => result.current.closeQuickAdd())

        expect(result.current.quickAddDate).toBeNull()
    })

    // ============================================================================
    // Header Text Tests
    // ============================================================================

    test('headerText shows month and year in month view', () => {
        const { result } = renderHook(() => useCalendarState())
        // Header should contain year
        expect(result.current.headerText).toMatch(/\d{4}/)
    })

    // ============================================================================
    // Helper Tests
    // ============================================================================

    test('isCurrentMonth returns true for current month dates', () => {
        const { result } = renderHook(() => useCalendarState())
        const currentMonth = result.current.currentDate.getMonth()
        const testDate = new Date(result.current.currentDate)
        testDate.setDate(15) // Middle of month

        expect(result.current.isCurrentMonth(testDate)).toBe(true)
    })

    test('isTodayDate returns true for today', () => {
        const { result } = renderHook(() => useCalendarState())
        expect(result.current.isTodayDate(new Date())).toBe(true)
    })

    test('isTodayDate returns false for other dates', () => {
        const { result } = renderHook(() => useCalendarState())
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        expect(result.current.isTodayDate(tomorrow)).toBe(false)
    })
})
