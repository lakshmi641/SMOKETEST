'use client'

import { useState, useMemo, useCallback } from 'react'
import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    addMonths,
    subMonths,
    addWeeks,
    subWeeks,
    addDays,
    subDays,
    format,
    isSameMonth,
    isSameDay,
    isToday,
} from 'date-fns'

// ============================================================================
// Types
// ============================================================================

export type ViewMode = 'month' | 'week'

export interface CalendarFilters {
    search: string
    assignedToMe: boolean
    dueThisWeek: boolean
    showCompleted: boolean
    assignees: string[]
    statuses: string[]
    dateRangeStart: string | null  // ISO date string
    dateRangeEnd: string | null    // ISO date string
}

export interface CalendarSettings {
    showWeekends: boolean
}

export interface CalendarState {
    currentDate: Date
    viewMode: ViewMode
    selectedDate: Date | null
    filters: CalendarFilters
    quickAddDate: Date | null
    settings: CalendarSettings
}

// ============================================================================
// Initial State
// ============================================================================

const initialFilters: CalendarFilters = {
    search: '',
    assignedToMe: false,
    dueThisWeek: false,
    showCompleted: true,
    assignees: [],
    statuses: [],
    dateRangeStart: null,
    dateRangeEnd: null,
}

const initialSettings: CalendarSettings = {
    showWeekends: true,
}

// ============================================================================
// Hook
// ============================================================================

export function useCalendarState() {
    // Core state
    const [currentDate, setCurrentDate] = useState<Date>(new Date())
    const [viewMode, setViewMode] = useState<ViewMode>('month')
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [filters, setFilters] = useState<CalendarFilters>(initialFilters)
    const [quickAddDate, setQuickAddDate] = useState<Date | null>(null)
    const [settings, setSettings] = useState<CalendarSettings>(initialSettings)

    // ============================================================================
    // Computed: Calendar Days
    // ============================================================================

    const calendarDays = useMemo(() => {
        if (viewMode === 'month') {
            // Month view: Show full month with padding days
            const monthStart = startOfMonth(currentDate)
            const monthEnd = endOfMonth(currentDate)
            const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday start
            const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
            let days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

            // Filter out weekends if setting is off
            if (!settings.showWeekends) {
                days = days.filter(day => {
                    const dayOfWeek = day.getDay()
                    return dayOfWeek !== 0 && dayOfWeek !== 6 // Not Sunday or Saturday
                })
            }
            return days
        } else if (viewMode === 'week') {
            // Week view: Show days of current week
            const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
            const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
            let days = eachDayOfInterval({ start: weekStart, end: weekEnd })

            // Filter out weekends if setting is off
            if (!settings.showWeekends) {
                days = days.filter(day => {
                    const dayOfWeek = day.getDay()
                    return dayOfWeek !== 0 && dayOfWeek !== 6 // Not Sunday or Saturday
                })
            }
            return days
        } else {
            // Day view: Show single day
            return [currentDate]
        }
    }, [currentDate, viewMode, settings.showWeekends])

    // Weekday labels based on settings
    const weekdayLabels = useMemo(() => {
        if (settings.showWeekends) {
            return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        }
        return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    }, [settings.showWeekends])

    // Number of columns for grid
    const gridColumns = useMemo(() => {
        return settings.showWeekends ? 7 : 5
    }, [settings.showWeekends])

    // ============================================================================
    // Navigation Functions
    // ============================================================================

    const goToToday = useCallback(() => {
        setCurrentDate(new Date())
    }, [])

    const goToPrevious = useCallback(() => {
        if (viewMode === 'month') {
            setCurrentDate(prev => subMonths(prev, 1))
        } else if (viewMode === 'week') {
            setCurrentDate(prev => subWeeks(prev, 1))
        } else {
            setCurrentDate(prev => subDays(prev, 1))
        }
    }, [viewMode])

    const goToNext = useCallback(() => {
        if (viewMode === 'month') {
            setCurrentDate(prev => addMonths(prev, 1))
        } else if (viewMode === 'week') {
            setCurrentDate(prev => addWeeks(prev, 1))
        } else {
            setCurrentDate(prev => addDays(prev, 1))
        }
    }, [viewMode])

    const goToDate = useCallback((date: Date) => {
        setCurrentDate(date)
    }, [])

    // ============================================================================
    // Filter Functions
    // ============================================================================

    const updateFilter = useCallback(<K extends keyof CalendarFilters>(
        key: K,
        value: CalendarFilters[K]
    ) => {
        setFilters(prev => ({ ...prev, [key]: value }))
    }, [])

    const resetFilters = useCallback(() => {
        setFilters(initialFilters)
    }, [])

    const toggleAssignedToMe = useCallback(() => {
        setFilters(prev => ({ ...prev, assignedToMe: !prev.assignedToMe }))
    }, [])

    const toggleDueThisWeek = useCallback(() => {
        setFilters(prev => ({ ...prev, dueThisWeek: !prev.dueThisWeek }))
    }, [])

    const toggleShowCompleted = useCallback(() => {
        setFilters(prev => ({ ...prev, showCompleted: !prev.showCompleted }))
    }, [])

    const setDateRange = useCallback((startDate: string | null, endDate: string | null) => {
        setFilters(prev => ({
            ...prev,
            dateRangeStart: startDate,
            dateRangeEnd: endDate
        }))
    }, [])

    const clearDateRange = useCallback(() => {
        setFilters(prev => ({
            ...prev,
            dateRangeStart: null,
            dateRangeEnd: null
        }))
    }, [])

    // ============================================================================
    // Settings Functions
    // ============================================================================

    const toggleShowWeekends = useCallback(() => {
        setSettings(prev => ({ ...prev, showWeekends: !prev.showWeekends }))
    }, [])

    const updateSetting = useCallback(<K extends keyof CalendarSettings>(
        key: K,
        value: CalendarSettings[K]
    ) => {
        setSettings(prev => ({ ...prev, [key]: value }))
    }, [])

    // ============================================================================
    // Quick Add Functions
    // ============================================================================

    const openQuickAdd = useCallback((date: Date) => {
        setQuickAddDate(date)
    }, [])

    const closeQuickAdd = useCallback(() => {
        setQuickAddDate(null)
    }, [])

    // ============================================================================
    // Header Text
    // ============================================================================

    const headerText = useMemo(() => {
        if (viewMode === 'month') {
            return format(currentDate, 'MMMM yyyy')
        } else if (viewMode === 'week') {
            const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
            const weekEnd = settings.showWeekends
                ? endOfWeek(currentDate, { weekStartsOn: 1 })
                : addDays(weekStart, 4) // Friday
            // Check if week spans two months
            if (weekStart.getMonth() !== weekEnd.getMonth()) {
                return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
            }
            return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'd, yyyy')}`
        } else {
            return format(currentDate, 'EEEE, MMMM d, yyyy')
        }
    }, [currentDate, viewMode, settings.showWeekends])

    // ============================================================================
    // Helper Functions
    // ============================================================================

    const isCurrentMonth = useCallback((date: Date) => {
        return isSameMonth(date, currentDate)
    }, [currentDate])

    const isSelected = useCallback((date: Date) => {
        return selectedDate ? isSameDay(date, selectedDate) : false
    }, [selectedDate])

    const isTodayDate = useCallback((date: Date) => {
        return isToday(date)
    }, [])

    const isSameDayAs = useCallback((date1: Date, date2: Date) => {
        return isSameDay(date1, date2)
    }, [])

    // ============================================================================
    // Return
    // ============================================================================

    return {
        // State
        currentDate,
        viewMode,
        selectedDate,
        filters,
        quickAddDate,
        calendarDays,
        headerText,
        settings,
        weekdayLabels,
        gridColumns,

        // Setters
        setCurrentDate,
        setViewMode,
        setSelectedDate,
        setFilters,
        setSettings,

        // Navigation
        goToToday,
        goToPrevious,
        goToNext,
        goToDate,

        // Filters
        updateFilter,
        resetFilters,
        toggleAssignedToMe,
        toggleDueThisWeek,
        toggleShowCompleted,
        setDateRange,
        clearDateRange,

        // Settings
        toggleShowWeekends,
        updateSetting,

        // Quick Add
        openQuickAdd,
        closeQuickAdd,

        // Helpers
        isCurrentMonth,
        isSelected,
        isTodayDate,
        isSameDayAs,
    }
}

// ============================================================================
// Type Export
// ============================================================================

export type UseCalendarStateReturn = ReturnType<typeof useCalendarState>
