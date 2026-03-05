'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
    ChevronLeft,
    ChevronRight,
    Search,
    Filter,
    Calendar,
    CalendarDays,
    X,
    Settings,
    ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UseCalendarStateReturn, ViewMode } from './useCalendarState'

// ============================================================================
// Types
// ============================================================================

interface CalendarHeaderProps {
    calendarState: UseCalendarStateReturn
}

// ============================================================================
// Component
// ============================================================================

export function CalendarHeader({ calendarState }: CalendarHeaderProps) {
    const {
        headerText,
        viewMode,
        setViewMode,
        filters,
        updateFilter,
        goToToday,
        goToPrevious,
        goToNext,
        toggleAssignedToMe,
        toggleDueThisWeek,
        toggleShowCompleted,
        resetFilters,
    } = calendarState

    const hasActiveFilters =
        filters.assignedToMe ||
        filters.dueThisWeek ||
        !filters.showCompleted ||
        filters.search.length > 0 ||
        filters.dateRangeStart !== null ||
        filters.dateRangeEnd !== null

    return (
        <div
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-2 px-3 bg-card border rounded-lg shadow-sm"
            data-testid="calendar-header"
        >
            {/* ================================================================== */}
            {/* Left Side: Search & Filter */}
            {/* ================================================================== */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Search Input */}
                <div className="relative flex-1 sm:flex-initial sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search calendar..."
                        value={filters.search}
                        onChange={(e) => updateFilter('search', e.target.value)}
                        className="pl-9 pr-8 h-10 bg-background"
                        data-testid="calendar-search"
                    />
                    {filters.search && (
                        <button
                            onClick={() => updateFilter('search', '')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Clear search"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Filter Popover */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={hasActiveFilters ? 'default' : 'outline'}
                            size="sm"
                            className={cn(
                                'h-10 gap-2 px-3',
                                hasActiveFilters && 'bg-primary text-primary-foreground'
                            )}
                            data-testid="filter-button"
                        >
                            <Filter className="h-4 w-4" />
                            <span className="hidden sm:inline">Filter</span>
                            {hasActiveFilters && (
                                <span className="ml-1 rounded-full bg-primary-foreground/20 text-xs px-1.5 py-0.5 font-medium">
                                    ✓
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="start">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-sm">Filters</h4>
                                {hasActiveFilters && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={resetFilters}
                                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        Clear all
                                    </Button>
                                )}
                            </div>

                            <Separator />

                            {/* Quick Filters */}
                            <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="assigned-to-me"
                                        checked={filters.assignedToMe}
                                        onCheckedChange={toggleAssignedToMe}
                                        data-testid="filter-assigned-to-me"
                                    />
                                    <Label
                                        htmlFor="assigned-to-me"
                                        className="text-sm cursor-pointer flex items-center gap-2"
                                    >
                                        <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs">
                                            👤
                                        </span>
                                        Assigned to me
                                    </Label>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="due-this-week"
                                        checked={filters.dueThisWeek}
                                        onCheckedChange={toggleDueThisWeek}
                                        data-testid="filter-due-this-week"
                                    />
                                    <Label
                                        htmlFor="due-this-week"
                                        className="text-sm cursor-pointer flex items-center gap-2"
                                    >
                                        <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs">
                                            📅
                                        </span>
                                        Due this week
                                    </Label>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="show-completed"
                                        checked={filters.showCompleted}
                                        onCheckedChange={toggleShowCompleted}
                                        data-testid="filter-show-completed"
                                    />
                                    <Label
                                        htmlFor="show-completed"
                                        className="text-sm cursor-pointer flex items-center gap-2"
                                    >
                                        <span className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs">
                                            ✓
                                        </span>
                                        Show completed
                                    </Label>
                                </div>
                            </div>

                            <Separator />

                            {/* Date Range Filter */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                        Date Range
                                    </h5>
                                    {(filters.dateRangeStart || filters.dateRangeEnd) && (
                                        <button
                                            onClick={calendarState.clearDateRange}
                                            className="text-xs text-muted-foreground hover:text-foreground"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <Label htmlFor="start-date" className="text-xs text-muted-foreground mb-1 block">
                                            Start date
                                        </Label>
                                        <Input
                                            type="date"
                                            id="start-date"
                                            value={filters.dateRangeStart || ''}
                                            onChange={(e) => calendarState.setDateRange(
                                                e.target.value || null,
                                                filters.dateRangeEnd
                                            )}
                                            className="h-9 text-sm"
                                            data-testid="filter-start-date"
                                        />
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground mt-5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <Label htmlFor="end-date" className="text-xs text-muted-foreground mb-1 block">
                                            Due date
                                        </Label>
                                        <Input
                                            type="date"
                                            id="end-date"
                                            value={filters.dateRangeEnd || ''}
                                            onChange={(e) => calendarState.setDateRange(
                                                filters.dateRangeStart,
                                                e.target.value || null
                                            )}
                                            className="h-9 text-sm"
                                            data-testid="filter-end-date"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* ================================================================== */}
            {/* Right Side: Navigation & View Toggle */}
            {/* ================================================================== */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                {/* Today Button */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={goToToday}
                    className="h-10 px-4 font-medium"
                    data-testid="calendar-today"
                >
                    Today
                </Button>

                {/* Month/Week/Day Navigation */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={goToPrevious}
                        className="h-8 w-8 rounded-md hover:bg-background"
                        data-testid="calendar-prev"
                        aria-label="Previous"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div
                        className="px-3 py-1.5 min-w-[160px] text-center font-semibold text-sm select-none"
                        data-testid="calendar-header-text"
                    >
                        {headerText}
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={goToNext}
                        className="h-8 w-8 rounded-md hover:bg-background"
                        data-testid="calendar-next"
                        aria-label="Next"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center bg-muted/50 rounded-lg p-1">
                    <ViewToggleButton
                        active={viewMode === 'month'}
                        onClick={() => setViewMode('month')}
                        icon={<Calendar className="h-4 w-4" />}
                        label="Month"
                        testId="view-month"
                    />
                    <ViewToggleButton
                        active={viewMode === 'week'}
                        onClick={() => setViewMode('week')}
                        icon={<CalendarDays className="h-4 w-4" />}
                        label="Week"
                        testId="view-week"
                    />
                </div>

                {/* Settings Popover */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10"
                            data-testid="settings-button"
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72" align="end">
                        <div className="space-y-4">
                            <h4 className="font-semibold text-sm">Calendar Settings</h4>

                            <Separator />

                            {/* Color Legend */}
                            <div className="space-y-2">
                                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Color Legend
                                </h5>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-blue-500" />
                                        <span>To Do</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-amber-500" />
                                        <span>In Progress</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-green-500" />
                                        <span>Completed</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-red-500" />
                                        <span>Overdue</span>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Week Settings */}
                            <div className="space-y-3">
                                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Display Settings
                                </h5>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="show-weekends"
                                        checked={calendarState.settings.showWeekends}
                                        onCheckedChange={calendarState.toggleShowWeekends}
                                        data-testid="show-weekends-toggle"
                                    />
                                    <Label htmlFor="show-weekends" className="text-sm cursor-pointer">
                                        Show weekends
                                    </Label>
                                </div>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    )
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ViewToggleButtonProps {
    active: boolean
    onClick: () => void
    icon: React.ReactNode
    label: string
    testId: string
}

function ViewToggleButton({ active, onClick, icon, label, testId }: ViewToggleButtonProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
            data-testid={testId}
        >
            {icon}
            <span className="hidden md:inline">{label}</span>
        </button>
    )
}
