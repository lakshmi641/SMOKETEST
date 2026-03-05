'use client'

import { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react'
import { format, addDays, startOfWeek, endOfWeek, parseISO, differenceInDays, addWeeks, getISOWeek, isSameDay, isWithinInterval } from 'date-fns'
import { ChevronLeft, ChevronRight, AlertCircle, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GanttItem } from '@/types'
import { calculateCriticalPath } from '@/lib/gantt-utils'
import { useUIStore } from '@/store/uiStore'
import { getStatusColors } from '@/lib/utils/task-status-colors'
import type { GeneratedTask } from '@/types/task-template-schema'

interface GanttChartProps {
    items: GanttItem[]
    onItemUpdate?: (item: GanttItem) => void
    onItemClick?: (item: GanttItem) => void
}

const HEADER_HEIGHT = 56
const ROW_HEIGHT = 44
const GROUP_HEADER_HEIGHT = 40

export function GanttChart({ items, onItemUpdate, onItemClick }: GanttChartProps) {
    const { ganttZoomLevel, setGanttZoomLevel, ganttViewMode, setGanttViewMode } = useUIStore()
    const headerRef = useRef<HTMLDivElement>(null)
    const bodyRef = useRef<HTMLDivElement>(null)
    const leftSidebarRef = useRef<HTMLDivElement>(null)

    const [extraWeeksBefore, setExtraWeeksBefore] = useState(2)
    const [extraWeeksAfter, setExtraWeeksAfter] = useState(4)

    const prevScrollWidthRef = useRef(0)
    const isPrependingRef = useRef(false)

    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

    const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
    const [dragStartX, setDragStartX] = useState<number>(0)
    const [dragStartLeft, setDragStartLeft] = useState<number>(0)
    const [tempItemPositions, setTempItemPositions] = useState<Record<string, number>>({})
    const [isDragging, setIsDragging] = useState(false)

    const [resizeMode, setResizeMode] = useState<'start' | 'end' | null>(null)
    const [resizeItemId, setResizeItemId] = useState<string | null>(null)
    const [resizeStartX, setResizeStartX] = useState<number>(0)
    const [tempResizeDeltas, setTempResizeDeltas] = useState<Record<string, { startDelta: number; endDelta: number }>>({})

    // ============================================================
    // COLUMN RESIZING STATE & LOGIC
    // ============================================================
    const [columnWidths, setColumnWidths] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('pms_gantt_column_widths')
            if (saved) {
                try {
                    return JSON.parse(saved)
                } catch (e) {
                    console.error('Failed to parse saved column widths', e)
                }
            }
        }
        return {
            name: 260,
            assignee: 120,
            status: 100
        }
    })

    useEffect(() => {
        localStorage.setItem('pms_gantt_column_widths', JSON.stringify(columnWidths))
    }, [columnWidths])

    const [resizingColumn, setResizingColumn] = useState<'name' | 'assignee' | 'status' | null>(null)
    const [colResizeStartX, setColResizeStartX] = useState<number>(0)
    const [colInitialWidth, setColInitialWidth] = useState<number>(0)

    const handleColumnResizeStart = (column: 'name' | 'assignee' | 'status', e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setResizingColumn(column)
        setColResizeStartX(e.clientX)
        setColInitialWidth(columnWidths[column])
    }

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingColumn) return
            const deltaX = e.clientX - colResizeStartX
            const minWidths = { name: 100, assignee: 50, status: 50 }
            const newWidth = Math.max(minWidths[resizingColumn], colInitialWidth + deltaX)

            setColumnWidths((prev: any) => ({
                ...prev,
                [resizingColumn]: newWidth
            }))
        }

        const handleMouseUp = () => {
            setResizingColumn(null)
            document.body.style.cursor = 'default'
        }

        if (resizingColumn) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = 'col-resize'
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [resizingColumn, colResizeStartX, colInitialWidth])

    // Hover state for highlighting
    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null)

    const COLUMN_WIDTH = useMemo(() => {
        switch (ganttZoomLevel) {
            case 'week': return 21
            case 'month': return 10
            case 'day':
            default: return 50
        }
    }, [ganttZoomLevel])

    const groupedItems = useMemo(() => {
        const groups = {
            open: { id: 'open', label: 'Open', items: [] as GanttItem[] },
            assigned: { id: 'assigned', label: 'Assigned', items: [] as GanttItem[] },
            in_progress: { id: 'in_progress', label: 'In Progress', items: [] as GanttItem[] },
            on_hold: { id: 'on_hold', label: 'On Hold', items: [] as GanttItem[] },
            completed: { id: 'completed', label: 'Completed', items: [] as GanttItem[] },
            cancelled: { id: 'cancelled', label: 'Cancelled', items: [] as GanttItem[] },
        }

        items.forEach(item => {
            const s = item.status?.toLowerCase() || 'open'
            if (['in_progress', 'active', 'doing'].includes(s)) groups.in_progress.items.push(item)
            else if (['done', 'completed'].includes(s)) groups.completed.items.push(item)
            else if (['cancelled'].includes(s)) groups.cancelled.items.push(item)
            else if (['on_hold', 'hold'].includes(s)) groups.on_hold.items.push(item)
            else if (['assigned'].includes(s)) groups.assigned.items.push(item)
            else groups.open.items.push(item)
        })

        const parseDate = (val: any) => {
            if (!val) return 0
            if (typeof val.toDate === 'function') return val.toDate().getTime()
            const d = new Date(val)
            return isNaN(d.getTime()) ? 0 : d.getTime()
        }

        // Explicitly sort each group by createdAt (newest first)
        const result = Object.values(groups).filter(g => g.items.length > 0)
        result.forEach(group => {
            group.items.sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt))
        })

        return result
    }, [items])

    const toggleGroup = (groupId: string) => {
        setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
    }

    const getStatusColor = (status?: string) => {
        const s = status?.toLowerCase() || 'open'
        // Map to GeneratedTask status format
        let mappedStatus: GeneratedTask['status'] = 'open'
        if (['done', 'completed'].includes(s)) mappedStatus = 'completed'
        else if (['in_progress', 'active', 'doing'].includes(s)) mappedStatus = 'in_progress'
        else if (['on_hold', 'hold'].includes(s)) mappedStatus = 'on_hold'
        else if (['cancelled'].includes(s)) mappedStatus = 'cancelled'
        else if (['assigned'].includes(s)) mappedStatus = 'assigned'
        else if (['approval_required', 'approval'].includes(s)) mappedStatus = 'approval_required'

        const colors = getStatusColors(mappedStatus)
        // Extract color name and shade from gradientFrom (e.g., 'from-blue-600' -> 'blue-600')
        const colorMatch = colors.gradientFrom.match(/from-(\w+)-(\d+)/)
        if (!colorMatch) return 'bg-gray-500 ring-gray-600'

        const colorName = colorMatch[1]
        const shade = colorMatch[2]
        if (!colorName || !shade) return 'bg-gray-500 ring-gray-600'

        const ringShade = parseInt(shade) >= 600 ? '700' : '600'
        return `bg-${colorName}-${shade} ring-${colorName}-${ringShade}`
    }

    const getStatusBadge = (status?: string) => {
        const s = status?.toLowerCase() || 'open'
        // Map to GeneratedTask status format
        let mappedStatus: GeneratedTask['status'] = 'open'
        if (['done', 'completed'].includes(s)) mappedStatus = 'completed'
        else if (['in_progress', 'active', 'doing'].includes(s)) mappedStatus = 'in_progress'
        else if (['on_hold', 'hold'].includes(s)) mappedStatus = 'on_hold'
        else if (['cancelled'].includes(s)) mappedStatus = 'cancelled'
        else if (['assigned'].includes(s)) mappedStatus = 'assigned'
        else if (['approval_required', 'approval'].includes(s)) mappedStatus = 'approval_required'

        const colors = getStatusColors(mappedStatus)
        const base = "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide"
        const statusLabels: Record<GeneratedTask['status'], string> = {
            open: 'Open',
            assigned: 'Assigned',
            in_progress: 'In Progress',
            on_hold: 'On Hold',
            completed: 'Completed',
            cancelled: 'Cancelled',
            escalated: 'Escalated',
            approval_required: 'Approval Required',
        }
        return <span className={`${base} ${colors.barBg} ${colors.barText}`}>{statusLabels[mappedStatus]}</span>
    }

    const { startDate, endDate } = useMemo(() => {
        let min = new Date()
        let max = new Date()
        let hasItems = false
        if (items.length > 0) {
            items.forEach(t => {
                if (t.startDate) {
                    const d = parseISO(t.startDate);
                    if (!isNaN(d.getTime())) {
                        if (d < min) min = d;
                        hasItems = true
                    }
                }
                if (t.endDate) {
                    const d = parseISO(t.endDate);
                    if (!isNaN(d.getTime())) {
                        if (d > max) max = d;
                        hasItems = true
                    }
                }
            })
        }
        if (!hasItems) { min = new Date(); max = addWeeks(new Date(), 4) }

        // Final safety check for min/max
        if (isNaN(min.getTime())) min = new Date()
        if (isNaN(max.getTime())) max = addWeeks(min, 4)

        return {
            startDate: startOfWeek(addWeeks(min, -extraWeeksBefore)),
            endDate: endOfWeek(addWeeks(max, extraWeeksAfter))
        }
    }, [items, extraWeeksBefore, extraWeeksAfter])

    const timelineDates = useMemo(() => {
        const dates = []; let curr = startDate; while (curr <= endDate) { dates.push(curr); curr = addDays(curr, 1) } return dates
    }, [startDate, endDate])

    const timelineWeeks = useMemo(() => {
        const weeks = []; let curr = startDate; while (curr <= endDate) { const weekEnd = addDays(curr, 6); weeks.push({ start: curr, end: weekEnd, label: `W${getISOWeek(curr)} ${format(curr, 'MMM d')} - ${format(weekEnd, 'd')}` }); curr = addDays(curr, 7) } return weeks
    }, [startDate, endDate])

    useLayoutEffect(() => {
        if (isPrependingRef.current && bodyRef.current) {
            const diff = bodyRef.current.scrollWidth - prevScrollWidthRef.current
            if (diff > 0) { bodyRef.current.scrollLeft += diff; if (headerRef.current) headerRef.current.scrollLeft += diff }
            isPrependingRef.current = false
        }
    }, [startDate])

    const handleScroll = (direction: 'left' | 'right') => {
        if (bodyRef.current) {
            if (direction === 'left') { isPrependingRef.current = true; prevScrollWidthRef.current = bodyRef.current.scrollWidth; setExtraWeeksBefore(prev => prev + 2) }
            else { setExtraWeeksAfter(prev => prev + 2); requestAnimationFrame(() => bodyRef.current?.scrollBy({ left: 300, behavior: 'smooth' })) }
        }
    }

    const onBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollLeft, scrollTop, scrollWidth, clientWidth } = e.currentTarget
        if (headerRef.current) headerRef.current.scrollLeft = scrollLeft
        if (leftSidebarRef.current) leftSidebarRef.current.scrollTop = scrollTop
        if (scrollLeft < 100 && !isPrependingRef.current) { isPrependingRef.current = true; prevScrollWidthRef.current = scrollWidth; setExtraWeeksBefore(prev => prev + 4) }
        if (scrollLeft + clientWidth > scrollWidth - 100) setExtraWeeksAfter(prev => prev + 4)
    }

    const scrollToToday = () => { if (bodyRef.current) { const daysDiff = differenceInDays(new Date(), startDate); bodyRef.current.scrollTo({ left: Math.max(0, daysDiff * COLUMN_WIDTH - 300), behavior: 'smooth' }) } }

    const handleMouseDown = (e: React.MouseEvent, item: GanttItem, left: number) => {
        if (!onItemUpdate) return; e.preventDefault(); e.stopPropagation(); setDraggingItemId(item.id); setDragStartX(e.clientX); setDragStartLeft(left); setIsDragging(false)
    }

    const handleMouseMove = (e: MouseEvent) => {
        if (!draggingItemId) return; const deltaX = e.clientX - dragStartX; if (Math.abs(deltaX) > 5) setIsDragging(true); setTempItemPositions(prev => ({ ...prev, [draggingItemId]: dragStartLeft + deltaX }))
    }

    const handleMouseUp = () => {
        if (!draggingItemId) return
        const item = items.find(t => t.id === draggingItemId)
        if (isDragging && onItemUpdate) {
            const currentLeft = tempItemPositions[draggingItemId] ?? dragStartLeft
            const offsetDays = Math.round(currentLeft / COLUMN_WIDTH)
            const newStartDate = addDays(startDate, offsetDays)
            if (item && item.startDate && item.endDate) {
                const durationDays = differenceInDays(parseISO(item.endDate), parseISO(item.startDate))
                onItemUpdate({ ...item, startDate: newStartDate.toISOString(), endDate: addDays(newStartDate, durationDays).toISOString() })
            }
        } else if (!isDragging && onItemClick && item) onItemClick(item)
        setDraggingItemId(null); setTempItemPositions({}); setIsDragging(false)
    }

    const handleResizeStart = (e: React.MouseEvent, item: GanttItem, mode: 'start' | 'end') => {
        if (!onItemUpdate) return; e.preventDefault(); e.stopPropagation(); setResizeItemId(item.id); setResizeMode(mode); setResizeStartX(e.clientX)
    }

    const handleResizeMove = (e: MouseEvent) => {
        if (!resizeItemId || !resizeMode) return
        const deltaX = e.clientX - resizeStartX; const deltaDays = Math.round(deltaX / COLUMN_WIDTH); const item = items.find(t => t.id === resizeItemId)
        if (!item?.startDate || !item?.endDate) return
        const durationDays = differenceInDays(parseISO(item.endDate), parseISO(item.startDate))
        if (resizeMode === 'start') { if (deltaDays < durationDays) setTempResizeDeltas(prev => ({ ...prev, [resizeItemId]: { startDelta: deltaDays, endDelta: 0 } })) }
        else { if (deltaDays > -durationDays) setTempResizeDeltas(prev => ({ ...prev, [resizeItemId]: { startDelta: 0, endDelta: deltaDays } })) }
    }

    const handleResizeEnd = () => {
        if (!resizeItemId) return
        const item = items.find(t => t.id === resizeItemId); const resize = tempResizeDeltas[resizeItemId]
        if (item && resize && item.startDate && item.endDate) {
            const newStart = addDays(parseISO(item.startDate), resize.startDelta); const newEnd = addDays(parseISO(item.endDate), resize.endDelta)
            if (newStart <= newEnd) onItemUpdate?.({ ...item, startDate: newStart.toISOString(), endDate: newEnd.toISOString() })
        }
        setResizeItemId(null); setResizeMode(null); setTempResizeDeltas({})
    }

    useEffect(() => {
        if (draggingItemId || resizeItemId) {
            document.body.style.cursor = 'ew-resize'
            const cleanup = () => { document.body.style.cursor = 'default' }
            return cleanup
        }
    }, [draggingItemId, resizeItemId])

    useEffect(() => {
        if (draggingItemId) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp) } }
    }, [draggingItemId, dragStartX, dragStartLeft, startDate, items, onItemUpdate, COLUMN_WIDTH, isDragging])

    useEffect(() => {
        if (resizeItemId) { window.addEventListener('mousemove', handleResizeMove); window.addEventListener('mouseup', handleResizeEnd); return () => { window.removeEventListener('mousemove', handleResizeMove); window.removeEventListener('mouseup', handleResizeEnd) } }
    }, [resizeItemId, resizeMode, resizeStartX, items, onItemUpdate, COLUMN_WIDTH, tempResizeDeltas])

    const calculateCriticalPathMemo = useMemo(() => calculateCriticalPath(items), [items])

    const months = useMemo(() => {
        const groups: { key: string; label: string; count: number }[] = []
        timelineDates.forEach(date => {
            const key = format(date, 'yyyy-MM'); const label = format(date, 'MMMM yyyy')
            const lastGroup = groups[groups.length - 1]; if (lastGroup && lastGroup.key === key) lastGroup.count++
            else groups.push({ key, label, count: 1 })
        })
        return groups
    }, [timelineDates])

    // Derived active range for highlighting
    const activeRange = useMemo(() => {
        const activeId = draggingItemId || resizeItemId || hoveredItemId
        if (!activeId) return null
        const item = items.find(i => i.id === activeId)
        if (!item?.startDate || !item?.endDate) return null

        let start = parseISO(item.startDate)
        let end = parseISO(item.endDate)

        if (isNaN(start.getTime()) || isNaN(end.getTime())) return null

        // Adjust for drag/resize
        if (draggingItemId === activeId && tempItemPositions[activeId] !== undefined) {
            const offset = Math.round(tempItemPositions[activeId] / COLUMN_WIDTH)
            const duration = differenceInDays(end, start)
            start = addDays(startDate, offset)
            end = addDays(start, duration)
        }
        if (resizeItemId === activeId && tempResizeDeltas[activeId]) {
            start = addDays(start, tempResizeDeltas[activeId].startDelta)
            end = addDays(end, tempResizeDeltas[activeId].endDelta)
        }
        return { start, end }
    }, [draggingItemId, resizeItemId, hoveredItemId, items, tempItemPositions, tempResizeDeltas, startDate, COLUMN_WIDTH])


    const headerOverlay = useMemo(() => {
        if (!activeRange) return null

        // Safety check for activeRange
        if (isNaN(activeRange.start.getTime()) || isNaN(activeRange.end.getTime()) || isNaN(startDate.getTime())) {
            return null
        }

        const startDiff = differenceInDays(activeRange.start, startDate)
        const duration = differenceInDays(activeRange.end, activeRange.start) + 1

        const left = startDiff * COLUMN_WIDTH
        const width = duration * COLUMN_WIDTH

        // More safety: ensure left and width are numbers
        if (isNaN(left) || isNaN(width)) return null

        const label = `${format(activeRange.start, 'MMM d')} - ${format(activeRange.end, 'MMM d')}`
        return { left, width, label }
    }, [activeRange, startDate, COLUMN_WIDTH])

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden text-sm relative">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
                <div className="flex items-center space-x-4">
                    <h2 className="text-lg font-bold text-gray-900">Timeline</h2>
                    <div className="flex items-center p-1 bg-gray-100 rounded-lg border border-gray-200">
                        {(['day', 'week', 'month'] as const).map(level => (
                            <Button key={level} variant={ganttZoomLevel === level ? 'secondary' : 'ghost'} size="sm" onClick={() => setGanttZoomLevel(level)} className={`text-xs px-3 h-7 rounded-md capitalize ${ganttZoomLevel === level ? 'shadow-sm text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900'}`}>{level}</Button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    <Button variant="outline" size="sm" onClick={scrollToToday} className="text-xs h-8">Today</Button>
                    <div className="h-4 w-px bg-gray-300 mx-1" />
                    <Button variant={ganttViewMode === 'critical_path' ? 'destructive' : 'outline'} size="sm" onClick={() => setGanttViewMode(ganttViewMode === 'standard' ? 'critical_path' : 'standard')} className={`text-xs h-8 ${ganttViewMode === 'critical_path' ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : ''}`}><AlertCircle className={`w-3.5 h-3.5 mr-1.5 ${ganttViewMode === 'critical_path' ? 'text-red-600' : 'text-gray-500'}`} />Critical Path</Button>
                    <div className="flex items-center space-x-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleScroll('left')}><ChevronLeft className="w-4 h-4" /></Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleScroll('right')}><ChevronRight className="w-4 h-4" /></Button>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="flex-1 overflow-hidden flex flex-col relative">
                <div className="flex overflow-hidden border-b border-gray-200 bg-gray-50 z-20" ref={headerRef}>
                    <div className="flex-shrink-0 border-r border-gray-200 flex flex-col sticky left-0 bg-gray-50 z-40 shadow-[4px_0_12px_-6px_rgba(0,0,0,0.1)]" style={{ width: columnWidths.name + columnWidths.assignee + columnWidths.status }}>
                        <div className="h-8 border-b border-gray-200 bg-gray-100/50 flex items-center px-4"><span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Task Details</span></div>
                        <div className="flex flex-1 items-center bg-gray-50 h-full">
                            <div className="p-3 font-bold text-[11px] text-muted-foreground/80 uppercase tracking-wider relative shrink-0" style={{ width: columnWidths.name }}>
                                Task Name
                                <div
                                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400/30 transition-colors z-30"
                                    onMouseDown={(e) => handleColumnResizeStart('name', e)}
                                />
                            </div>
                            <div className="p-3 font-bold text-[11px] text-muted-foreground/80 uppercase tracking-wider border-l border-gray-200 relative shrink-0" style={{ width: columnWidths.assignee }}>
                                Assignee
                                <div
                                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400/30 transition-colors z-30"
                                    onMouseDown={(e) => handleColumnResizeStart('assignee', e)}
                                />
                            </div>
                            <div className="p-3 font-bold text-[11px] text-muted-foreground/80 uppercase tracking-wider border-l border-gray-200 relative shrink-0" style={{ width: columnWidths.status }}>
                                Status
                                <div
                                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400/30 transition-colors z-30"
                                    onMouseDown={(e) => handleColumnResizeStart('status', e)}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex h-8 border-b border-gray-200 bg-white">
                            {months.map(group => (
                                <div key={group.key} className="flex-shrink-0 relative border-r border-gray-200" style={{ width: group.count * COLUMN_WIDTH }}>
                                    <div className="sticky left-0 px-3 flex items-center h-full font-semibold text-xs text-gray-600 whitespace-nowrap overflow-hidden w-max bg-white/80 backdrop-blur-sm z-10">{group.label}</div>
                                </div>
                            ))}
                        </div>
                        <div className="flex h-[28px] relative">
                            {headerOverlay && (
                                <div className="absolute top-0 bottom-0 bg-blue-600 z-20 rounded-md shadow-sm flex items-center justify-between px-2 text-white text-xs font-semibold pointer-events-none" style={{ left: headerOverlay.left, width: headerOverlay.width }}>
                                    <span>{headerOverlay.label.split(' - ')[0]}</span>
                                    <span>{headerOverlay.label.split(' - ')[1]}</span>
                                </div>
                            )}
                            {ganttZoomLevel === 'week' ? timelineWeeks.map((week, i) => {
                                const isHighlighted = activeRange && isWithinInterval(week.start, activeRange)
                                return (<div key={i} className={`flex-shrink-0 border-r border-gray-200 flex items-center justify-center ${isHighlighted ? 'bg-blue-50' : 'bg-white'}`} style={{ width: COLUMN_WIDTH * 7 }}><span className={`text-[10px] font-medium ${isHighlighted ? 'text-blue-600' : 'text-gray-500'}`}>{week.label}</span></div>)
                            }) : timelineDates.map(date => {
                                const isToday = isSameDay(date, new Date())
                                const isHighlighted = activeRange && date >= activeRange.start && date <= activeRange.end
                                const bgClass = isHighlighted ? 'bg-blue-50' : (isToday ? 'bg-blue-50' : 'bg-white')
                                return (<div key={date.toISOString()} className={`flex-shrink-0 border-r border-gray-200 flex flex-col items-center justify-center ${bgClass}`} style={{ width: COLUMN_WIDTH }}>{ganttZoomLevel !== 'month' && <span className={`text-[10px] font-medium uppercase ${isHighlighted ? 'text-blue-600' : (isToday ? 'text-blue-600' : 'text-gray-400')}`}>{format(date, 'EEE')}</span>}{(ganttZoomLevel !== 'month' || date.getDate() === 1) && <span className={`text-sm font-bold ${isHighlighted ? 'text-blue-600' : (isToday ? 'text-blue-600' : 'text-gray-900')} leading-none`}>{format(date, 'd')}</span>}</div>)
                            })}
                        </div>
                    </div>
                </div>

                {/* BODY SECTION - SPLIT LAYOUT */}
                <div className="flex-1 overflow-hidden flex">
                    {/* LEFT: FIXED TASK DETAILS */}
                    <div
                        ref={leftSidebarRef}
                        className="flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto custom-scrollbar"
                        style={{ width: columnWidths.name + columnWidths.assignee + columnWidths.status }}
                        onScroll={(e) => {
                            // Sync vertical scroll to right panel
                            if (bodyRef.current) {
                                bodyRef.current.scrollTop = e.currentTarget.scrollTop
                            }
                        }}
                    >
                        {groupedItems.map(group => (
                            <div key={group.id}>
                                <div className="flex items-center px-2 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors" style={{ height: GROUP_HEADER_HEIGHT }} onClick={() => toggleGroup(group.id)}>
                                    <div className="p-1 rounded-md hover:bg-gray-200 mr-2">{collapsedGroups[group.id] ? <ChevronRightIcon className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}</div>
                                    <span className="text-xs font-bold text-gray-700">{group.label}</span><span className="ml-2 px-1.5 py-0.5 bg-gray-200 rounded-full text-[10px] text-gray-600 font-medium">{group.items.length}</span>
                                </div>
                                {!collapsedGroups[group.id] && group.items.map(item => (
                                    <div key={item.id} onMouseEnter={() => setHoveredItemId(item.id)} onMouseLeave={() => setHoveredItemId(null)} className="flex items-center border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group" style={{ height: ROW_HEIGHT }} onClick={() => onItemClick?.(item)}>
                                        <div className="px-4 text-sm font-medium text-gray-700 truncate group-hover:text-blue-600 transition-colors shrink-0" style={{ width: columnWidths.name }} title={item.title}>{item.title}</div>
                                        <div className="px-3 border-l border-gray-100 flex items-center shrink-0" style={{ width: columnWidths.assignee }}>{item.assignee ? (<div className="flex items-center space-x-2 min-w-0"><div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 border border-indigo-200 flex-shrink-0">{item.assignee.avatar ? <img src={item.assignee.avatar} className="w-full h-full rounded-full" alt="" /> : item.assignee.name.charAt(0)}</div><span className="text-xs text-gray-600 truncate">{item.assignee.name}</span></div>) : <span className="text-xs text-gray-400 italic">Unassigned</span>}</div>
                                        <div className="px-3 border-l border-gray-100 shrink-0" style={{ width: columnWidths.status }}>{getStatusBadge(item.status)}</div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* RIGHT: SCROLLABLE TIMELINE */}
                    <div className="flex-1 overflow-auto custom-scrollbar bg-white" ref={bodyRef} onScroll={onBodyScroll}>
                        <div className="relative min-w-max">
                            <div className="absolute inset-0 flex pointer-events-none">
                                {ganttZoomLevel === 'week' ? timelineWeeks.map((week, i) => (<div key={i} className="flex-shrink-0 border-r border-gray-100 h-full bg-transparent" style={{ width: COLUMN_WIDTH * 7 }} />)) : timelineDates.map(date => {
                                    const isWeekend = [0, 6].includes(date.getDay()); const isToday = isSameDay(date, new Date())
                                    return (<div key={date.toISOString()} className={`flex-shrink-0 border-r border-gray-100 h-full relative ${isWeekend ? 'bg-gray-50/50' : ''}`} style={{ width: COLUMN_WIDTH }}>{isToday && <div className="absolute left-1/2 top-0 bottom-0 w-px bg-blue-500 z-10" />}</div>)
                                })}
                            </div>

                            <div className="relative py-0">
                                {groupedItems.map(group => (
                                    <div key={group.id}>
                                        <div className="border-b border-gray-200 bg-gray-50/30 w-full" style={{ height: GROUP_HEADER_HEIGHT }} />
                                        {!collapsedGroups[group.id] && group.items.map(item => {
                                            if (!item.startDate || !item.endDate) return <div key={item.id} style={{ height: ROW_HEIGHT }} className="border-b border-white" />
                                            const itemStart = parseISO(item.startDate); const itemEnd = parseISO(item.endDate)
                                            if (isNaN(itemStart.getTime()) || isNaN(itemEnd.getTime())) return <div key={item.id} style={{ height: ROW_HEIGHT }} className="border-b border-white" />

                                            const offsetDays = differenceInDays(itemStart, startDate); const durationDays = differenceInDays(itemEnd, itemStart) + 1
                                            let left = offsetDays * COLUMN_WIDTH; let width = durationDays * COLUMN_WIDTH

                                            if (isNaN(left) || isNaN(width)) return <div key={item.id} style={{ height: ROW_HEIGHT }} className="border-b border-white" />

                                            if (draggingItemId === item.id && tempItemPositions[item.id] !== undefined) left = tempItemPositions[item.id] ?? left
                                            const resize = resizeItemId === item.id ? tempResizeDeltas[item.id] : undefined
                                            if (resize) { left += resize.startDelta * COLUMN_WIDTH; width += (resize.endDelta - resize.startDelta) * COLUMN_WIDTH }

                                            const isCritical = ganttViewMode === 'critical_path' && calculateCriticalPathMemo.has(item.id)
                                            const colorClass = isCritical ? 'bg-red-500 ring-red-600' : getStatusColor(item.status)

                                            return (
                                                <div key={item.id} onMouseEnter={() => setHoveredItemId(item.id)} onMouseLeave={() => setHoveredItemId(null)} className="relative group border-b border-transparent" style={{ height: ROW_HEIGHT }}>
                                                    <div
                                                        className={`absolute top-2 bottom-2 rounded-lg shadow-sm ${colorClass} bg-opacity-95 border border-white/20 hover:shadow-md transition-all flex items-center z-10 overflow-hidden ${isDragging || resizeItemId ? 'cursor-ew-resize' : 'cursor-pointer hover:cursor-ew-resize'}`}
                                                        style={{ left, width: Math.max(width - 4, 4) }}
                                                        onMouseDown={(e) => handleMouseDown(e, item, left)}
                                                    >
                                                        {/* Progress Overlay */}
                                                        {typeof item.progress === 'number' && item.progress > 0 && (
                                                            <div
                                                                className="absolute left-0 top-0 bottom-0 bg-white/20 z-0 transition-all pointer-events-none"
                                                                style={{ width: `${item.progress}%` }}
                                                            />
                                                        )}

                                                        <span className="text-white text-[11px] font-semibold truncate sticky left-0 px-3 z-10 drop-shadow-sm select-none">
                                                            {item.title}
                                                        </span>

                                                        {/* Left Drag Handle */}
                                                        <div
                                                            className="absolute left-0 top-0 bottom-0 w-4 hover:bg-white/30 rounded-l-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-ew-resize"
                                                            onMouseDown={(e) => handleResizeStart(e, item, 'start')}
                                                            title="Drag to change start date"
                                                        >
                                                            <div className="w-[1.5px] h-3 bg-white/70 rounded-full" />
                                                        </div>

                                                        {/* Right Drag Handle */}
                                                        <div
                                                            className="absolute right-0 top-0 bottom-0 w-4 hover:bg-white/30 rounded-r-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-ew-resize"
                                                            onMouseDown={(e) => handleResizeStart(e, item, 'end')}
                                                            title="Drag to change due date"
                                                        >
                                                            <div className="w-[1.5px] h-3 bg-white/70 rounded-full" />
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                {/* Legend Overlay */}
                <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-gray-200 z-50 flex items-center space-x-4 animate-in fade-in slide-in-from-bottom-4 pointer-events-none">
                    <div className="flex items-center space-x-1.5"><div className="w-2.5 h-2.5 rounded-full bg-sky-500" /><span className="text-xs text-gray-600 font-medium">Open</span></div>
                    <div className="flex items-center space-x-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-600" /><span className="text-xs text-gray-600 font-medium">Assigned</span></div>
                    <div className="flex items-center space-x-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /><span className="text-xs text-gray-600 font-medium">In Progress</span></div>
                    <div className="flex items-center space-x-1.5"><div className="w-2.5 h-2.5 rounded-full bg-orange-500" /><span className="text-xs text-gray-600 font-medium">On Hold</span></div>
                    <div className="flex items-center space-x-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-xs text-gray-600 font-medium">Completed</span></div>
                    <div className="flex items-center space-x-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /><span className="text-xs text-gray-600 font-medium">Cancelled</span></div>
                </div>
            </div>
        </div>
    )
}
