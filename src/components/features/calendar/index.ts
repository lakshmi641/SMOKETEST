// ============================================================================
// Calendar View Components
// ============================================================================
// Jira/Asana-style calendar for task management
// Premium UI with drag-and-drop, filtering, and quick task creation

// Main Components
export { CalendarView } from './CalendarView'
export { CalendarHeader } from './CalendarHeader'
export { CalendarGrid } from './CalendarGrid'
export { CalendarWeekView } from './CalendarWeekView'
export { CalendarDayView } from './CalendarDayView'
export { CalendarDayCell } from './CalendarDayCell'
export { CalendarTaskItem, MoreTasksIndicator, CalendarTaskItemSkeleton } from './CalendarTaskItem'
export { QuickAddForm } from './QuickAddForm'

// Unscheduled Sidebar (to be added)
// export { UnscheduledSidebar } from './UnscheduledSidebar'

// State Management
export { useCalendarState } from './useCalendarState'

// Types
export type {
    UseCalendarStateReturn,
    CalendarFilters,
    ViewMode
} from './useCalendarState'
