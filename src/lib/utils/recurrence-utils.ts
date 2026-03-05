/**
 * Recurrence Utilities - Pure Schedule Calculation Engine
 * Master Plan v6.2 - Stage 2
 * 
 * Philosophy: Pure mathematical functions with ZERO side effects
 * No database, no API calls, no mutations - just calculations
 * 
 * Supports: Daily, Weekly, Monthly, Quarterly, Yearly frequencies
 */

import {
    addDays,
    addWeeks,
    addMonths,
    addYears,
    setDay,
    getDay,
    getDaysInMonth,
    getMonth,
    setMonth,
    getYear,
    setYear,
    parseISO,
    formatISO,
    isAfter,
    isBefore,
    format,
    startOfDay,
} from 'date-fns'
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz'
import type { RecurrenceSchedule } from '../../types/recurring-task-schema'

// ============================================
// CORE CALCULATION FUNCTIONS
// ============================================

/**
 * Calculate the next run date based on schedule configuration
 * @param schedule - Recurrence configuration
 * @param fromDate - Calculate from this date (defaults to now)
 * @returns ISO timestamp for next run, or null if schedule has expired
 */
export function calculateNextRun(
    schedule: RecurrenceSchedule,
    fromDate: Date = new Date()
): string | null {
    // 0. Check if schedule has expired
    if (schedule.endCondition.type === 'on_date' && schedule.endCondition.endDate) {
        const endDate = parseISO(schedule.endCondition.endDate)
        if (isAfter(fromDate, endDate)) {
            return null // Schedule expired
        }
    }

    // 1. Respect startDate if it exists
    const startDate = parseISO(schedule.startDate)
    let nextDate: Date

    if (isBefore(fromDate, startDate)) {
        // If we're before start date, the first ever run should be the start date
        nextDate = new Date(startDate)
    } else {
        nextDate = new Date(fromDate)

        // Apply frequency-specific logic (increment from fromDate)
        switch (schedule.frequency) {
            case 'daily':
                // Check if we can run today (if time hasn't passed)
                const todayRun = applyTimeOfDay(nextDate, schedule.timeOfDay, schedule.timezone)
                if (isAfter(todayRun, fromDate)) {
                    // We can run today, keep nextDate as is
                } else {
                    nextDate = addDays(nextDate, schedule.interval)
                }
                break
            case 'weekly':
                // Check if today matches requirements and time is future
                const currentDay = getDay(nextDate)
                const isTodayValidDay = schedule.weekDays?.includes(currentDay)
                const todayWeeklyRun = applyTimeOfDay(nextDate, schedule.timeOfDay, schedule.timezone)

                if (isTodayValidDay && isAfter(todayWeeklyRun, fromDate)) {
                    // We can run today!
                } else {
                    nextDate = calculateNextWeeklyOccurrence(nextDate, schedule)
                }
                break
            case 'monthly':
                // Try current month first
                let monthlyCandidate: Date
                if (schedule.isLastDayOfMonth) {
                    monthlyCandidate = setDateToLastDayOfMonth(nextDate)
                } else if (schedule.monthDay) {
                    monthlyCandidate = setDateClampedToMonth(nextDate, schedule.monthDay)
                } else if (schedule.monthPosition) {
                    monthlyCandidate = applyMonthPosition(nextDate, schedule.monthPosition)
                } else {
                    monthlyCandidate = new Date(nextDate)
                }

                const monthlyRun = applyTimeOfDay(monthlyCandidate, schedule.timeOfDay, schedule.timezone)
                if (isAfter(monthlyRun, fromDate)) {
                    nextDate = monthlyCandidate
                } else {
                    nextDate = calculateNextMonthlyOccurrence(nextDate, schedule)
                }
                break
            case 'quarterly':
                // Try current quarter first
                const quarterlyCandidate = calculateQuarterlyCandidate(nextDate, schedule)
                const quarterlyRun = applyTimeOfDay(quarterlyCandidate, schedule.timeOfDay, schedule.timezone)
                if (isAfter(quarterlyRun, fromDate)) {
                    nextDate = quarterlyCandidate
                } else {
                    nextDate = calculateNextQuarterlyOccurrence(nextDate, schedule)
                }
                break
            case 'yearly':
                // Get month and day for yearly
                let yearlyCandidate = setMonth(new Date(nextDate), schedule.yearlyMonth ?? 0)
                if (schedule.isLastDayOfMonth) {
                    yearlyCandidate = setDateToLastDayOfMonth(yearlyCandidate)
                } else if (schedule.monthDay) {
                    yearlyCandidate = setDateClampedToMonth(yearlyCandidate, schedule.monthDay)
                } else {
                    // Default to same day of start date if nothing specified
                    yearlyCandidate = setDateClampedToMonth(yearlyCandidate, new Date(startDate).getDate())
                }

                const yearlyRun = applyTimeOfDay(yearlyCandidate, schedule.timeOfDay, schedule.timezone)
                if (isAfter(yearlyRun, fromDate)) {
                    nextDate = yearlyCandidate
                } else {
                    nextDate = calculateNextYearlyOccurrence(nextDate, schedule)
                }
                break
            case 'custom':
                // For custom, we calculate from the most recent run (or fromDate)
                // We'll treat common units as jumps
                const customRun = applyTimeOfDay(nextDate, schedule.timeOfDay, schedule.timezone)
                if (isAfter(customRun, fromDate)) {
                    // It can run today but only if it's the right day of week/month etc.
                    // For simplicity, custom jumps often start from startDate.
                    // But to keep it consistent with other frequencies:
                    nextDate = nextDate
                } else {
                    nextDate = calculateNextCustomOccurrence(nextDate, schedule)
                }
                break
            default:
                throw new Error(`Unsupported frequency: ${schedule.frequency}`)
        }
    }

    // Apply time of day
    nextDate = applyTimeOfDay(nextDate, schedule.timeOfDay, schedule.timezone)

    // Convert to UTC ISO string (MUST be Z-suffix for consistent DB queries)
    return nextDate.toISOString()
}

/**
 * Check if a schedule should run on a specific date
 * @param schedule - Recurrence configuration
 * @param checkDate - Date to check
 * @returns true if task should run on this date
 */
export function shouldRunOnDate(
    schedule: RecurrenceSchedule,
    checkDate: Date
): boolean {
    // For weekly: check if day matches weekDays
    if (schedule.frequency === 'weekly') {
        const dayOfWeek = getDay(checkDate)
        return schedule.weekDays?.includes(dayOfWeek) ?? false
    }

    // For monthly with specific day: check if it matches
    if (schedule.frequency === 'monthly' && schedule.monthDay) {
        const dateOfMonth = checkDate.getDate()
        const daysInMonth = getDaysInMonth(checkDate)
        const targetDay = Math.min(schedule.monthDay, daysInMonth)
        return dateOfMonth === targetDay
    }

    // For quarterly: complex logic
    if (schedule.frequency === 'quarterly') {
        return isQuarterlyMatch(checkDate, schedule)
    }

    return true
}

/**
 * Validate a schedule configuration
 * @param schedule - Schedule to validate
 * @returns Array of error messages (empty if valid)
 */
export function validateSchedule(schedule: RecurrenceSchedule): string[] {
    const errors: string[] = []

    if (schedule.dueDays !== undefined && (schedule.dueDays < 0 || schedule.dueDays > 365)) {
        errors.push('Due days must be between 0 and 365')
    }

    if (schedule.frequency === 'weekly') {
        if (!schedule.weekDays || schedule.weekDays.length === 0) {
            errors.push('Weekly frequency requires at least one weekday')
        }
        if (schedule.weekDays?.some((day) => day < 0 || day > 6)) {
            errors.push('Week days must be between 0 (Sunday) and 6 (Saturday)')
        }
    }

    if (schedule.frequency === 'monthly') {
        if (schedule.monthDay && (schedule.monthDay < 1 || schedule.monthDay > 31)) {
            errors.push('Month day must be between 1 and 31')
        }
        if (schedule.monthPosition) {
            const { weekday } = schedule.monthPosition
            if (weekday < 0 || weekday > 6) {
                errors.push('Weekday must be between 0 (Sunday) and 6 (Saturday)')
            }
        }
    }

    if (schedule.frequency === 'quarterly') {
        if (schedule.quarterMonth && ![1, 2, 3].includes(schedule.quarterMonth)) {
            errors.push('Quarter month must be 1, 2, or 3')
        }
    }

    if (schedule.endCondition.type === 'after_count') {
        if (!schedule.endCondition.occurrenceCount || schedule.endCondition.occurrenceCount < 1) {
            errors.push('Occurrence count must be at least 1')
        }
        if (schedule.endCondition.occurrenceCount && schedule.endCondition.occurrenceCount > 1000) {
            errors.push('Occurrence count cannot exceed 1000')
        }
    }

    return errors
}

/**
 * Generate a human-readable description of the schedule
 * @param schedule - Schedule configuration
 * @returns Human-readable string (e.g., "Every 2 weeks on Mon, Wed, Fri at 9:00 AM")
 */
export function getScheduleDescription(schedule: RecurrenceSchedule): string {
    const parts: string[] = []

    // Frequency prefix
    parts.push(schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1))

    // Due days info
    if (schedule.dueDays && schedule.dueDays > 0) {
        parts.push(`(due in ${schedule.dueDays} days)`)
    }

    // Specific days for weekly
    if (schedule.frequency === 'weekly' && schedule.weekDays) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const selectedDays = schedule.weekDays.map((d) => dayNames[d]).join(', ')
        parts.push(`on ${selectedDays}`)
    }

    // Specific date for monthly
    if (schedule.frequency === 'monthly' && schedule.monthDay) {
        const suffix = getOrdinalSuffix(schedule.monthDay)
        parts.push(`on the ${schedule.monthDay}${suffix}`)
    }

    // Month position for monthly
    if (schedule.frequency === 'monthly' && schedule.monthPosition) {
        const { week, weekday } = schedule.monthPosition
        const weekNames = { first: '1st', second: '2nd', third: '3rd', fourth: '4th', last: 'last' }
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        parts.push(`on the ${weekNames[week]} ${dayNames[weekday]}`)
    }

    // Quarterly details
    if (schedule.frequency === 'quarterly') {
        const monthNames = ['first', 'second', 'third']
        const monthName = monthNames[(schedule.quarterMonth || 1) - 1]
        parts.push(`in the ${monthName} month of each quarter`)
        if (schedule.monthDay) {
            const suffix = getOrdinalSuffix(schedule.monthDay)
            parts.push(`on the ${schedule.monthDay}${suffix}`)
        }
    }

    // Time
    parts.push(`at ${schedule.timeOfDay}`)

    // End condition
    if (schedule.endCondition.type === 'on_date' && schedule.endCondition.endDate) {
        const endDate = parseISO(schedule.endCondition.endDate)
        parts.push(`until ${format(endDate, 'MMM d, yyyy')}`)
    } else if (schedule.endCondition.type === 'after_count' && schedule.endCondition.occurrenceCount) {
        parts.push(`for ${schedule.endCondition.occurrenceCount} occurrences`)
    }

    return parts.join(' ')
}

// ============================================
// FREQUENCY-SPECIFIC CALCULATIONS
// ============================================

function calculateNextWeeklyOccurrence(
    fromDate: Date,
    schedule: RecurrenceSchedule
): Date {
    if (!schedule.weekDays || schedule.weekDays.length === 0) {
        throw new Error('Weekly schedule requires weekDays')
    }

    const currentDay = getDay(fromDate)
    const sortedDays = [...schedule.weekDays].sort((a, b) => a - b)

    // 1. Try to find a later day in the same week
    const nextDayThisWeek = sortedDays.find((day) => day > currentDay)

    if (nextDayThisWeek !== undefined) {
        // Simple case: just move to that day in current week
        return setDay(fromDate, nextDayThisWeek, { weekStartsOn: 0 })
    } else {
        // 2. We've exhausted this week, so we must jump 'interval' weeks
        // IMPORTANT: We calculate from the *start* of the week to ensure clean week jumps
        // Otherwise, adding weeks to a Wednesday might land in the middle of a future week and mess up day setting
        const weeksToAdd = schedule.interval

        // Move to the next valid week
        const nextDate = addWeeks(fromDate, weeksToAdd)

        // In that target week, we want the FIRST available day (since it's a new week)
        const firstDayOfTargetWeek = sortedDays[0]

        // setDay will move to the day within that week (assuming week starts Sunday)
        return setDay(nextDate, firstDayOfTargetWeek || 0, { weekStartsOn: 0 })
    }
}

function calculateNextMonthlyOccurrence(
    fromDate: Date,
    schedule: RecurrenceSchedule
): Date {
    // Specific month jump based on interval
    let nextDate = addMonths(fromDate, schedule.interval)

    if (schedule.isLastDayOfMonth) {
        nextDate = setDateToLastDayOfMonth(nextDate)
    } else if (schedule.monthDay) {
        nextDate = setDateClampedToMonth(nextDate, schedule.monthDay)
    } else if (schedule.monthPosition) {
        nextDate = applyMonthPosition(nextDate, schedule.monthPosition)
    }

    return nextDate
}

function calculateNextQuarterlyOccurrence(
    fromDate: Date,
    schedule: RecurrenceSchedule
): Date {
    // Jump by interval quarters (3 * interval months)
    const nextDate = addMonths(fromDate, schedule.interval * 3)
    return calculateQuarterlyCandidate(nextDate, schedule)
}

function calculateNextYearlyOccurrence(
    fromDate: Date,
    schedule: RecurrenceSchedule
): Date {
    // Jump by interval years
    let nextDate = addYears(fromDate, schedule.interval)

    // Set to target month
    nextDate = setMonth(nextDate, schedule.yearlyMonth ?? 0)

    if (schedule.isLastDayOfMonth) {
        nextDate = setDateToLastDayOfMonth(nextDate)
    } else if (schedule.monthDay) {
        nextDate = setDateClampedToMonth(nextDate, schedule.monthDay)
    }

    return nextDate
}

/**
 * Helper to find the specific month/day candidate within a given quarter
 */
function calculateQuarterlyCandidate(date: Date, schedule: RecurrenceSchedule): Date {
    const month = getMonth(date)
    const quarter = Math.floor(month / 3)
    const quarterStartMonth = quarter * 3
    const targetMonth = quarterStartMonth + ((schedule.quarterMonth || 1) - 1)

    let candidate = setMonth(new Date(date), targetMonth)
    if (schedule.isLastDayOfMonth) {
        candidate = setDateToLastDayOfMonth(candidate)
    } else if (schedule.monthDay) {
        candidate = setDateClampedToMonth(candidate, schedule.monthDay)
    }
    return candidate
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateNextCustomOccurrence(
    fromDate: Date,
    schedule: RecurrenceSchedule
): Date {
    const unit = schedule.customUnit || 'days'
    const interval = schedule.interval || 1

    switch (unit) {
        case 'days':
            return addDays(fromDate, interval)
        case 'weeks':
            // Logic similar to weekly
            return calculateNextWeeklyOccurrence(fromDate, schedule)
        case 'months':
            return calculateNextMonthlyOccurrence(fromDate, schedule)
        case 'years':
            return calculateNextYearlyOccurrence(fromDate, schedule)
        default:
            return addDays(fromDate, interval)
    }
}

function setDateClampedToMonth(date: Date, targetDay: number): Date {
    const daysInMonth = getDaysInMonth(date)
    const clampedDay = Math.min(targetDay, daysInMonth)

    const newDate = new Date(date)
    newDate.setDate(clampedDay)
    return newDate
}

function setDateToLastDayOfMonth(date: Date): Date {
    const daysInMonth = getDaysInMonth(date)
    const newDate = new Date(date)
    newDate.setDate(daysInMonth)
    return newDate
}

function applyMonthPosition(
    date: Date,
    position: { week: 'first' | 'second' | 'third' | 'fourth' | 'last'; weekday: number }
): Date {
    const { week, weekday } = position
    const year = getYear(date)
    const month = getMonth(date)

    // Get first day of month
    let targetDate = new Date(year, month, 1)

    if (week === 'last') {
        // Start from last day and work backwards
        targetDate = new Date(year, month + 1, 0) // Last day of month
        const lastDayOfWeek = getDay(targetDate)

        // Calculate days to subtract
        const daysToSubtract = (lastDayOfWeek - weekday + 7) % 7
        targetDate = addDays(targetDate, -daysToSubtract)
    } else {
        // Find first occurrence of weekday
        const firstDayOfWeek = getDay(targetDate)
        const daysToAdd = (weekday - firstDayOfWeek + 7) % 7
        targetDate = addDays(targetDate, daysToAdd)

        // Add weeks based on position
        const weekMap = { first: 0, second: 1, third: 2, fourth: 3 }
        targetDate = addWeeks(targetDate, weekMap[week])
    }

    return targetDate
}

function applyTimeOfDay(date: Date, timeOfDay: string, timezone: string): Date {
    const [hours, minutes] = timeOfDay.split(':').map(Number)

    // 1. Get the pure date part (YYYY-MM-DD) from the date object in the target timezone
    // Use formatInTimeZone to get the correct wall-clock date in that timezone
    const dateStr = formatInTimeZone(date, timezone, 'yyyy-MM-dd')

    // 2. Combine with time string
    const dateTimeStr = `${dateStr} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`

    // 3. Parse this as a local time in that timezone to get a proper UTC Date object
    return fromZonedTime(dateTimeStr, timezone)
}

function isQuarterlyMatch(date: Date, schedule: RecurrenceSchedule): boolean {
    const month = getMonth(date) // 0-11
    const quarter = Math.floor(month / 3) // 0-3
    const quarterStartMonth = quarter * 3
    const targetMonth = quarterStartMonth + ((schedule.quarterMonth || 1) - 1)

    if (month !== targetMonth) {
        return false
    }

    if (schedule.monthDay) {
        const dateOfMonth = date.getDate()
        const daysInMonth = getDaysInMonth(date)
        const targetDay = Math.min(schedule.monthDay, daysInMonth)
        return dateOfMonth === targetDay
    }

    return true
}

function getOrdinalSuffix(num: number): string {
    const j = num % 10
    const k = num % 100

    if (j === 1 && k !== 11) return 'st'
    if (j === 2 && k !== 12) return 'nd'
    if (j === 3 && k !== 13) return 'rd'
    return 'th'
}

// ============================================
// PREVIEW GENERATION
// ============================================

/**
 * Generate preview of next N occurrences
 * @param schedule - Recurrence configuration
 * @param count - Number of occurrences to preview
 * @param fromDate - Start date for preview
 * @returns Array of ISO date strings
 */
export function generateOccurrencePreview(
    schedule: RecurrenceSchedule,
    count: number = 5,
    fromDate: Date = new Date()
): string[] {
    const occurrences: string[] = []
    let currentDate = new Date(fromDate)
    let iterations = 0
    const maxIterations = count * 100 // Safety limit

    // Respect occurrence count limit if set
    const maxOccurrences = schedule.endCondition.type === 'after_count'
        ? Math.min(count, schedule.endCondition.occurrenceCount || count)
        : count

    while (occurrences.length < maxOccurrences && iterations < maxIterations) {
        const nextRun = calculateNextRun(schedule, currentDate)

        if (!nextRun) {
            break // Schedule expired
        }

        occurrences.push(nextRun)
        currentDate = parseISO(nextRun)

        iterations++
    }

    return occurrences
}

/**
 * Calculate total number of occurrences for a schedule
 * @param schedule - Recurrence configuration
 * @param fromDate - Start date
 * @param maxDate - Maximum date to calculate (defaults to 2 years from now)
 * @returns Total count of occurrences
 */
export function calculateTotalOccurrences(
    schedule: RecurrenceSchedule,
    fromDate: Date = new Date(),
    maxDate: Date = addYears(new Date(), 2)
): number {
    if (schedule.endCondition.type === 'after_count') {
        return schedule.endCondition.occurrenceCount || 0
    }

    if (schedule.endCondition.type === 'on_date' && schedule.endCondition.endDate) {
        maxDate = parseISO(schedule.endCondition.endDate)
    }

    const occurrences = generateOccurrencePreview(schedule, 10000, fromDate)
    return occurrences.filter((date) => isBefore(parseISO(date), maxDate)).length
}
