'use client'

/**
 * Schedule Step - Recurring Task Dialog
 * Refactored to match the exact UI and text from the design screenshots.
 * Restored standard Label weights and specific helper text for Due Days.
 * Reverted Weekly selection to checkbox list as shown in the references.
 */

import React, { useMemo, useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Clock, Calendar, Info, AlertTriangle } from 'lucide-react'
import type { RecurrenceSchedule } from '@/types/recurring-task-schema'
import { generateOccurrencePreview } from '@/lib/utils/recurrence-utils'
import { format, parseISO } from 'date-fns'

interface ScheduleStepProps {
    schedule: RecurrenceSchedule
    onChange: (schedule: RecurrenceSchedule) => void
    errors?: Record<string, string>
}

const WEEKDAYS = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 0, label: 'Sunday' },
]

const MONTH_NAMES = [
    { value: 0, label: 'January' },
    { value: 1, label: 'February' },
    { value: 2, label: 'March' },
    { value: 3, label: 'April' },
    { value: 4, label: 'May' },
    { value: 5, label: 'June' },
    { value: 6, label: 'July' },
    { value: 7, label: 'August' },
    { value: 8, label: 'September' },
    { value: 9, label: 'October' },
    { value: 10, label: 'November' },
    { value: 11, label: 'December' },
]

const WEEK_POSITIONS = [
    { value: 'first', label: 'First' },
    { value: 'second', label: 'Second' },
    { value: 'third', label: 'Third' },
    { value: 'fourth', label: 'Fourth' },
    { value: 'last', label: 'Last' },
] as const

export function ScheduleStep({ schedule, onChange, errors }: ScheduleStepProps) {
    // Local state for numeric inputs to handle typing/empty state smoothly
    const [localMonthDay, setLocalMonthDay] = useState(schedule.monthDay?.toString() || '1')
    const [localDueDays, setLocalDueDays] = useState(schedule.dueDays?.toString() || '0')
    const [localInterval, setLocalInterval] = useState(schedule.interval?.toString() || '1')
    const [localOccCount, setLocalOccCount] = useState(schedule.endCondition.occurrenceCount?.toString() || '1')

    // Sync local state when external schedule changes
    useEffect(() => { if (localMonthDay !== '' || schedule.monthDay) setLocalMonthDay(schedule.monthDay?.toString() || '1') }, [schedule.monthDay])
    useEffect(() => { setLocalDueDays(schedule.dueDays?.toString() || '0') }, [schedule.dueDays])
    useEffect(() => { setLocalInterval(schedule.interval?.toString() || '1') }, [schedule.interval])
    useEffect(() => { setLocalOccCount(schedule.endCondition.occurrenceCount?.toString() || '1') }, [schedule.endCondition.occurrenceCount])

    const updateSchedule = (updates: Partial<RecurrenceSchedule>) => {
        onChange({ ...schedule, ...updates })
    }

    const preview = useMemo(() => {
        try {
            return generateOccurrencePreview(schedule, 3, new Date())
        } catch (e) {
            return []
        }
    }, [schedule])

    const getSummaryText = () => {
        const { frequency, interval, customUnit, isLastDayOfMonth, monthDay, weekDays, yearlyMonth, timeOfDay, monthPosition, quarterMonth } = schedule;

        let repeatPart = '';
        if (frequency === 'custom') {
            const unit = customUnit || 'days';
            const unitLabel = interval > 1 ? unit : unit.replace(/s$/, '');
            repeatPart = `Every ${interval} ${unitLabel}`;
        } else {
            const freqLabels = { daily: 'day', weekly: 'week', monthly: 'month', quarterly: 'quarter', yearly: 'year' };
            const label = freqLabels[frequency as keyof typeof freqLabels];
            repeatPart = interval > 1 ? `Every ${interval} ${label}s` : `Every ${frequency.replace('ly', '').replace('i', 'y')}`;
        }

        let detailPart = '';
        if (frequency === 'weekly' || (frequency === 'custom' && customUnit === 'weeks')) {
            if (weekDays?.length) {
                const dayNames = weekDays.map(d => WEEKDAYS.find(w => w.value === d)?.label.substring(0, 3)).join(', ');
                detailPart = `on ${dayNames}`;
            }
        } else if (frequency === 'monthly' || frequency === 'quarterly' || frequency === 'yearly' || (frequency === 'custom' && (customUnit === 'months' || customUnit === 'years'))) {
            if (monthPosition) {
                const weekLabel = WEEK_POSITIONS.find(p => p.value === monthPosition.week)?.label;
                const dayLabel = WEEKDAYS.find(d => d.value === monthPosition.weekday)?.label;
                detailPart = `on the ${weekLabel} ${dayLabel}`;
            } else if (isLastDayOfMonth) {
                detailPart = 'on the last day of the month';
            } else if (monthDay) {
                const suffix = (d: number) => {
                    const j = d % 10, k = d % 100;
                    if (j === 1 && k !== 11) return "st";
                    if (j === 2 && k !== 12) return "nd";
                    if (j === 3 && k !== 13) return "rd";
                    return "th";
                };
                detailPart = `on the ${monthDay}${suffix(monthDay)} day`;
            }

            if (frequency === 'quarterly' && quarterMonth) {
                const quarterLabels = { 1: '1st', 2: '2nd', 3: '3rd' };
                detailPart += ` of the ${quarterLabels[quarterMonth as 1 | 2 | 3]} month`;
            }

            if (frequency === 'yearly' || (frequency === 'custom' && customUnit === 'years')) {
                const monthIndex = yearlyMonth !== undefined ? Number(yearlyMonth) : 0;
                const monthName = MONTH_NAMES.find(m => m.value === monthIndex)?.label || 'January';
                detailPart += ` in ${monthName}`;
            }
        }

        const duePart = schedule.dueDays && schedule.dueDays > 0 ? ` (due in ${schedule.dueDays} days)` : '';
        const timeLabel = timeOfDay ? ` @ ${timeOfDay}` : '';
        return `${repeatPart} ${detailPart}${duePart}${timeLabel}`.trim().replace(/\s+/g, ' ');
    };

    const isCustom = schedule.frequency === 'custom'

    const handleLocalNumericChange = (value: string, setter: (val: string) => void, field: string, min: number = 0, isEndOcc: boolean = false) => {
        // 1. Allow user to clear input (handled by local state) without triggering parent update
        if (value === '') {
            setter('')
            return
        }

        // 2. Clean and Parse
        const cleaned = value.replace(/^0+/, '')
        // If it was just "0" or "00", it becomes empty string, so we handle that:
        // Actually, if input is "0", cleaned is "". If min is 1, strictly we shouldn't allow "0".
        // But let's assume typing "10" starts with "1" then "0".

        setter(cleaned)

        let num = parseInt(cleaned)
        if (isNaN(num)) return // Should be caught by regex/type but safe to check

        // 3. Apply Constraints
        if (num < min) num = min

        // Explicit Max Validations based on field
        if (field === 'monthDay' && num > 28) num = 28
        if (field === 'dueDays' && num > 365) num = 365

        // 4. Update Parent
        if (isEndOcc) {
            updateSchedule({ endCondition: { ...schedule.endCondition, occurrenceCount: num } })
        } else {
            updateSchedule({ [field]: num })
        }
    }

    return (
        <div className="space-y-6">
            {/* Frequency Selector */}
            <div className="space-y-2">
                <Label htmlFor="frequency" className="font-semibold text-slate-700">Frequency *</Label>
                <Select
                    value={schedule.frequency}
                    onValueChange={(value: any) => updateSchedule({ frequency: value })}
                >
                    <SelectTrigger id="frequency" className="h-11 bg-white border-slate-200">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="custom">Custom...</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Due in (days) - EXACT UI MATCH */}
            <div className="space-y-2">
                <Label htmlFor="due-days" className="font-semibold text-slate-700">Due in (days)</Label>
                <div className="flex items-center gap-3">
                    <Input
                        id="due-days"
                        type="text"
                        inputMode="numeric"
                        disabled={schedule.frequency === 'daily'}
                        value={schedule.frequency === 'daily' ? '0' : localDueDays}
                        onChange={(e) => handleLocalNumericChange(e.target.value, setLocalDueDays, 'dueDays', 0)}
                        onBlur={() => setLocalDueDays(schedule.dueDays?.toString() || '0')}
                        className="w-20 h-10 text-center font-medium bg-white border-slate-200"
                    />
                    <span className="text-sm text-slate-500 font-medium">days from trigger date</span>
                </div>
                <p className="text-[11px] text-slate-400 italic mt-1">
                    Task due date = trigger date + due days
                </p>
            </div>

            {/* Dynamic Trigger Logic Section */}
            {(schedule.frequency === 'weekly' || schedule.frequency === 'monthly' || schedule.frequency === 'quarterly' || schedule.frequency === 'yearly' || isCustom) && (
                <div className="space-y-6 pt-2">
                    {/* Weekly Selection - Restored Circular Design */}
                    {(schedule.frequency === 'weekly' || (isCustom && schedule.customUnit === 'weeks')) && (
                        <div className="space-y-4">
                            <Label className="font-semibold text-slate-700">On these days *</Label>
                            <div className="flex flex-wrap gap-2 pt-1">
                                {WEEKDAYS.map((day) => {
                                    const isSelected = !!schedule.weekDays?.includes(day.value);
                                    const label = day.label.charAt(0);
                                    return (
                                        <button
                                            key={day.value}
                                            type="button"
                                            onClick={() => {
                                                const current = schedule.weekDays || []
                                                const updated = isSelected
                                                    ? current.filter((d) => d !== day.value)
                                                    : [...current, day.value].sort((a, b) => a - b)
                                                updateSchedule({ weekDays: updated })
                                            }}
                                            className={`h-10 w-10 rounded-full border-2 flex items-center justify-center text-xs font-black transition-all ${isSelected ? 'bg-amber-500 border-amber-500 text-white shadow-md ring-2 ring-amber-500/10' : 'bg-transparent border-slate-100 text-slate-400 hover:border-amber-200'}`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Error Display for Weekdays */}
                    {errors?.frequency && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 animate-in fade-in slide-in-from-top-1">
                            <AlertTriangle className="h-4 w-4" />
                            <span>{errors.frequency}</span>
                        </div>
                    )}

                    {/* Quarterly: Month Selection */}
                    {schedule.frequency === 'quarterly' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="font-semibold text-slate-700">Month of quarter</Label>
                                <Select
                                    value={schedule.quarterMonth?.toString() || '1'}
                                    onValueChange={(val) => updateSchedule({ quarterMonth: parseInt(val) as 1 | 2 | 3 })}
                                >
                                    <SelectTrigger className="w-full h-11 bg-white border-slate-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">First month (Jan, Apr, Jul, Oct)</SelectItem>
                                        <SelectItem value="2">Second month (Feb, May, Aug, Nov)</SelectItem>
                                        <SelectItem value="3">Third month (Mar, Jun, Sep, Dec)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {/* Monthly/Quarterly/Yearly: Day of Month Selection */}
                    {(['monthly', 'quarterly', 'yearly'].includes(schedule.frequency) || (isCustom && ['months', 'years'].includes(schedule.customUnit || ''))) && (
                        <div className="space-y-4">
                            {/* Monthly specific: Position vs Day */}
                            {schedule.frequency === 'monthly' && (
                                <RadioGroup
                                    value={schedule.monthPosition ? 'position' : 'day'}
                                    onValueChange={(val) => {
                                        if (val === 'day') {
                                            updateSchedule({ monthPosition: undefined, monthDay: 1 })
                                        } else {
                                            updateSchedule({ monthDay: undefined, monthPosition: { week: 'first', weekday: 1 } })
                                        }
                                    }}
                                    className="flex flex-col gap-3"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="day" id="monthly-day" className="text-amber-500" />
                                        <Label htmlFor="monthly-day" className="cursor-pointer text-sm font-medium">Specific day of month</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="position" id="monthly-pos" className="text-amber-500" />
                                        <Label htmlFor="monthly-pos" className="cursor-pointer text-sm font-medium">Relative position</Label>
                                    </div>
                                </RadioGroup>
                            )}

                            {/* Position dropdowns if selected */}
                            {schedule.monthPosition && (
                                <div className="flex items-center gap-2 pl-6">
                                    <Select
                                        value={schedule.monthPosition.week}
                                        onValueChange={(week: any) => updateSchedule({ monthPosition: { ...schedule.monthPosition!, week } })}
                                    >
                                        <SelectTrigger className="w-32 h-10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {WEEK_POSITIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select
                                        value={schedule.monthPosition.weekday.toString()}
                                        onValueChange={(val) => updateSchedule({ monthPosition: { ...schedule.monthPosition!, weekday: parseInt(val) } })}
                                    >
                                        <SelectTrigger className="w-40 h-10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {WEEKDAYS.map(d => <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Standard Day input */}
                            {!schedule.monthPosition && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        {!schedule.isLastDayOfMonth && (
                                            <Label className="font-semibold text-slate-700">Day of month</Label>
                                        )}
                                        <div className="flex items-center space-x-2 ml-auto">
                                            <Checkbox
                                                id="last-day-toggle"
                                                checked={!!schedule.isLastDayOfMonth}
                                                onCheckedChange={(checked) => updateSchedule({ isLastDayOfMonth: !!checked, monthDay: checked ? undefined : 1 })}
                                            />
                                            <Label htmlFor="last-day-toggle" className="text-xs font-semibold text-slate-500 cursor-pointer">Last day of month</Label>
                                        </div>
                                    </div>

                                    {!schedule.isLastDayOfMonth && (
                                        <Input
                                            type="text"
                                            inputMode="numeric"
                                            value={localMonthDay}
                                            onChange={(e) => handleLocalNumericChange(e.target.value, setLocalMonthDay, 'monthDay', 1)}
                                            onBlur={() => setLocalMonthDay(schedule.monthDay?.toString() || '1')}
                                            className="w-20 h-10 text-center font-medium bg-white border-slate-200"
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Yearly: Month Selector */}
                    {schedule.frequency === 'yearly' && (
                        <div className="space-y-2">
                            <Label className="font-semibold text-slate-700">In month</Label>
                            <Select
                                value={schedule.yearlyMonth?.toString() || '0'}
                                onValueChange={(val) => updateSchedule({ yearlyMonth: parseInt(val) })}
                            >
                                <SelectTrigger className="w-full h-11 bg-white border-slate-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTH_NAMES.map(m => (
                                        <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Custom Logic: Interval, Unit, and Start Date */}
                    {isCustom && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="font-semibold text-slate-700">Repeat every</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="text"
                                            inputMode="numeric"
                                            value={localInterval}
                                            onChange={(e) => handleLocalNumericChange(e.target.value, setLocalInterval, 'interval', 1)}
                                            onBlur={() => setLocalInterval(schedule.interval?.toString() || '1')}
                                            className="w-20 h-10 text-center font-medium bg-white border-slate-200"
                                        />
                                        <Select
                                            value={schedule.customUnit || 'days'}
                                            onValueChange={(val: any) => updateSchedule({ customUnit: val })}
                                        >
                                            <SelectTrigger className="flex-1 h-10">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="days">Day(s)</SelectItem>
                                                <SelectItem value="weeks">Week(s)</SelectItem>
                                                <SelectItem value="months">Month(s)</SelectItem>
                                                <SelectItem value="years">Year(s)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-semibold text-slate-700">Effective from</Label>
                                    <Input
                                        type="date"
                                        value={schedule.startDate?.split('T')[0] || ''}
                                        onChange={(e) => updateSchedule({ startDate: e.target.value })}
                                        className="h-10 bg-white border-slate-200"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Time & Timezone Row */}
            <div className="grid grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                    <Label htmlFor="time" className="font-semibold text-slate-700">Time *</Label>
                    <Input
                        id="time"
                        type="time"
                        value={schedule.timeOfDay || ''}
                        onChange={(e) => updateSchedule({ timeOfDay: e.target.value })}
                        className="h-11 bg-white border-slate-200"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="timezone" className="font-semibold text-slate-700">Timezone</Label>
                    <Select
                        value={schedule.timezone}
                        onValueChange={(val) => updateSchedule({ timezone: val })}
                    >
                        <SelectTrigger id="timezone" className="h-11 bg-white border-slate-200">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                            <SelectItem value="America/New_York">New York (EST)</SelectItem>
                            <SelectItem value="UTC">UTC</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Schedule Logic Hint Box */}
            <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/30 space-y-2">
                <div className="flex items-center gap-2 text-amber-700">
                    <Info className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Schedule Logic</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                    Tasks will be generated automatically at the selected frequency and time. The generated task's
                    starting date will be the trigger date, and the due date will be calculated based on the
                    "Due in (days)" setting.
                </p>
            </div>

            {/* End Condition Section */}
            <div className="space-y-4 pt-4">
                <Label className="font-bold text-amber-600 uppercase tracking-widest text-[11px]">End Date Settings</Label>
                <RadioGroup
                    value={schedule.endCondition.type}
                    onValueChange={(val: any) => updateSchedule({ endCondition: { ...schedule.endCondition, type: val } })}
                    className="space-y-4"
                >
                    <div className="flex items-center space-x-3">
                        <RadioGroupItem value="never" id="end-never" className="text-amber-500" />
                        <Label htmlFor="end-never" className="font-medium text-slate-700 cursor-pointer">Never End</Label>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-3 w-28">
                            <RadioGroupItem value="on_date" id="end-date" className="text-amber-500" />
                            <Label htmlFor="end-date" className="font-medium text-slate-700 cursor-pointer">On Date</Label>
                        </div>
                        <Input
                            type="date"
                            disabled={schedule.endCondition.type !== 'on_date'}
                            value={schedule.endCondition.endDate || ''}
                            onChange={(e) => updateSchedule({ endCondition: { ...schedule.endCondition, type: 'on_date', endDate: e.target.value } })}
                            className="h-10 max-w-[160px] bg-white border-slate-200"
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-3 w-28">
                            <RadioGroupItem value="after_count" id="end-after" className="text-amber-500" />
                            <Label htmlFor="end-after" className="font-medium text-slate-700 cursor-pointer">After</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="text"
                                inputMode="numeric"
                                disabled={schedule.endCondition.type !== 'after_count'}
                                value={localOccCount}
                                onChange={(e) => handleLocalNumericChange(e.target.value, setLocalOccCount, 'occurrenceCount', 1, true)}
                                onBlur={() => setLocalOccCount(schedule.endCondition.occurrenceCount?.toString() || '1')}
                                className="w-20 h-10 text-center font-medium bg-white"
                            />
                            <span className="text-sm text-slate-500">times</span>
                        </div>
                    </div>
                </RadioGroup>
            </div>

            {/* Summary Preview Table/Card */}
            <div className="mt-8 rounded-xl border border-slate-100 bg-slate-50/50 overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Schedule Status</span>
                </div>
                <div className="p-4 space-y-3">
                    <p className="text-sm font-bold text-slate-800 leading-tight">
                        {getSummaryText()}
                    </p>
                    <div className="space-y-1.5 pt-2">
                        {preview.slice(0, 3).map((date, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400 font-medium uppercase tracking-tighter">
                                    {idx === 0 ? 'Next run' : idx === 1 ? 'Follow up' : 'Then'}
                                </span>
                                <span className="text-slate-600 font-bold">{format(parseISO(date), 'MMM d, hh:mm a')}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
