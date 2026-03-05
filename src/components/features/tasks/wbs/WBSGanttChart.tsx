'use client'

import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react'
import { startOfWeek, endOfWeek, addWeeks, addDays, format, differenceInDays } from 'date-fns'
import { ChevronRight, ChevronDown, AlertCircle, Plus, ChevronLeft, FileSpreadsheet } from 'lucide-react'
import { GeneratedTask } from '@/types/task-template-schema'
import { buildWBSTree, flattenWBSTreeForDisplay, calculateWBSSchedule, WBSNode } from '@/lib/wbs-algorithms'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, formatISODate } from '@/lib/utils/date-utils'

import { DependencyDialog } from './DependencyDialog'
import { ImportWizard } from '@/components/import/ImportWizard'
import { ImportType } from '@/lib/services/import/types/import-types'
import { useAuthStore } from '@/store/authStore'
import { useCompany } from '@/contexts/CompanyContext'
import { formatTaskId } from '@/lib/utils/task-display'
import { getStatusColors } from '@/lib/utils/task-status-colors'

interface WBSGanttChartProps {
    items: GeneratedTask[]
    projectId?: string
    project?: any
    onTaskUpdate?: (task: GeneratedTask) => void
    onTasksUpdate?: (tasks: GeneratedTask[]) => Promise<void>
    onTaskClick?: (task: GeneratedTask) => void
    onCreateTask?: (isMilestone: boolean) => void
    onTasksImported?: (importedCount: number) => void
    workspaceId?: string
    projectUsers?: any[]
}

const COLUMN_WIDTH = 40
const ROW_HEIGHT = 36

export function WBSGanttChart({
    items,
    projectId,
    project,
    onTaskUpdate,
    onTasksUpdate,
    onTaskClick,
    onCreateTask,
    onTasksImported,
    workspaceId,
    projectUsers = []
}: WBSGanttChartProps) {
    const [viewMode, setViewMode] = useState<'standard' | 'critical'>('standard')
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
    const [filterMode, setFilterMode] = useState<'all' | 'milestones' | 'tasks'>('all')
    const [dependencyModal, setDependencyModal] = useState<{ isOpen: boolean, sourceTask: GeneratedTask | null }>({ isOpen: false, sourceTask: null })
    const [importWizardOpen, setImportWizardOpen] = useState(false)
    const { user } = useAuthStore()
    const { companyId, currentCompany } = useCompany()

    const [extraWeeksBefore, setExtraWeeksBefore] = useState(2)
    const [extraWeeksAfter, setExtraWeeksAfter] = useState(4)

    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const ganttBodyRef = useRef<HTMLDivElement>(null)
    const headerRef = useRef<HTMLDivElement>(null)
    const prevScrollWidthRef = useRef(0)
    const isPrependingRef = useRef(false)

    // ============================================================
    // DRAG & RESIZE STATE
    // ============================================================
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
            const saved = localStorage.getItem('pms_wbs_column_widths')
            if (saved) {
                try {
                    return JSON.parse(saved)
                } catch (e) {
                    console.error('Failed to parse saved column widths', e)
                }
            }
        }
        return {
            work: 320,
            assignee: 120,
            dep: 40
        }
    })

    useEffect(() => {
        localStorage.setItem('pms_wbs_column_widths', JSON.stringify(columnWidths))
    }, [columnWidths])

    const [resizingColumn, setResizingColumn] = useState<'work' | 'assignee' | 'dep' | null>(null)
    const [colResizeStartX, setColResizeStartX] = useState<number>(0)
    const [colInitialWidth, setColInitialWidth] = useState<number>(0)

    const handleColumnResizeStart = (column: 'work' | 'assignee' | 'dep', e: React.MouseEvent) => {
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
            const minWidths = { work: 100, assignee: 80, dep: 30 }
            const newWidth = Math.max(minWidths[resizingColumn], colInitialWidth + deltaX)

            setColumnWidths((prev: any) => ({
                ...prev,
                [resizingColumn]: newWidth
            }))
        }

        const handleMouseUp = () => {
            setResizingColumn(null)
        }

        if (resizingColumn) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [resizingColumn, colResizeStartX, colInitialWidth])







    // ============================================================
    // DATA PROCESSING - SORT BY START DATE (EARLIEST FIRST - ASANA STYLE)
    // ============================================================
    // ============================================================
    // DATA PROCESSING - SORT BY START DATE (EARLIEST FIRST - ASANA STYLE)
    // ============================================================
    const { flatNodes, criticalPathIds } = useMemo(() => {
        // Calculate Schedule & Critical Path
        const schedule = calculateWBSSchedule(items)

        // Build Tree & Flatten
        const tree = buildWBSTree(items, collapsedIds)
        let nodes = flattenWBSTreeForDisplay(tree)

        // Apply filtering based on filterMode
        if (filterMode === 'milestones') {
            nodes = nodes.filter(n => n.isMilestone)
        } else if (filterMode === 'tasks') {
            nodes = nodes.filter(n => !n.isMilestone)
        }

        // Apply schedule data to nodes
        nodes.forEach(node => {
            const s = schedule.get(node.id)
            if (s) {
                node.es = s.es
                node.ef = s.ef
                node.isCritical = s.isCritical
            }
        })

        // Build critical path set from scheduler result
        const criticalSet = new Set<string>()
        schedule.forEach((val, key) => {
            if (val.isCritical) criticalSet.add(key)
        })

        return { flatNodes: nodes, criticalPathIds: criticalSet }
    }, [items, collapsedIds, filterMode])


    // ============================================================
    // TIMELINE CALCULATION
    // ============================================================
    const { startDate, endDate } = useMemo(() => {
        let min = new Date()
        let max = new Date()
        let hasItems = false

        if (flatNodes.length > 0) {
            flatNodes.forEach(node => {
                if (node.es < min) { min = node.es; hasItems = true }
                if (node.ef > max) { max = node.ef; hasItems = true }
            })
        }

        if (!hasItems) {
            min = new Date()
            max = addWeeks(new Date(), 4)
        }

        // Final safety check for min/max
        if (isNaN(min.getTime())) min = new Date()
        if (isNaN(max.getTime())) max = addWeeks(min, 4)

        return {
            startDate: startOfWeek(addWeeks(min, -extraWeeksBefore)),
            endDate: endOfWeek(addWeeks(max, extraWeeksAfter))
        }
    }, [flatNodes, extraWeeksBefore, extraWeeksAfter])

    const timelineDates = useMemo(() => {
        const dates = []
        let curr = startDate
        while (curr <= endDate) {
            dates.push(curr)
            curr = addDays(curr, 1)
        }
        return dates
    }, [startDate, endDate])

    // ============================================================
    // DRAG & RESIZE HANDLERS
    // ============================================================

    const handleMouseDown = (e: React.MouseEvent, node: WBSNode, left: number) => {
        if (!onTaskUpdate) return
        if (node.isMilestone) return

        e.preventDefault()
        e.stopPropagation()
        setDraggingItemId(node.id)
        setDragStartX(e.clientX)
        setDragStartLeft(left)
        setIsDragging(false)
    }

    const handleMouseMove = (e: MouseEvent) => {
        if (!draggingItemId) return
        const deltaX = e.clientX - dragStartX
        if (Math.abs(deltaX) > 5) setIsDragging(true)
        setTempItemPositions(prev => ({ ...prev, [draggingItemId]: dragStartLeft + deltaX }))
    }

    const handleMouseUp = () => {
        if (!draggingItemId) return

        const node = flatNodes.find(n => n.id === draggingItemId)

        if (isDragging && onTaskUpdate && node) {
            const currentLeft = tempItemPositions[draggingItemId] ?? dragStartLeft
            const offsetDays = Math.round(currentLeft / COLUMN_WIDTH)
            const newStartDate = addDays(startDate, offsetDays)

            const durationDays = differenceInDays(node.ef, node.es)
            const newEndDate = addDays(newStartDate, durationDays)

            const { children, level, expanded, hasChildren, es, ef, ls, lf, float, isCritical, ...rawTask } = node
            const updatedTask = {
                ...rawTask,
                startDate: newStartDate.toISOString(),
                endDate: newEndDate.toISOString(),
                dueDate: newEndDate.toISOString() // Sync dueDate with endDate for consistency
            } as GeneratedTask

            onTaskUpdate(updatedTask)
        } else if (!isDragging && onTaskClick && node) {
            onTaskClick(node)
        }

        setDraggingItemId(null)
        setTempItemPositions({})
        setIsDragging(false)
    }

    const handleResizeStart = (e: React.MouseEvent, node: WBSNode, mode: 'start' | 'end') => {
        if (!onTaskUpdate || node.isMilestone) return
        e.preventDefault()
        e.stopPropagation()
        setResizeItemId(node.id)
        setResizeMode(mode)
        setResizeStartX(e.clientX)
    }

    const handleResizeMove = (e: MouseEvent) => {
        if (!resizeItemId || !resizeMode) return
        const deltaX = e.clientX - resizeStartX
        const deltaDays = Math.round(deltaX / COLUMN_WIDTH)

        const node = flatNodes.find(n => n.id === resizeItemId)
        if (!node) return

        const durationDays = differenceInDays(node.ef, node.es)

        if (resizeMode === 'start') {
            if (deltaDays < durationDays) {
                setTempResizeDeltas(prev => ({ ...prev, [resizeItemId]: { startDelta: deltaDays, endDelta: 0 } }))
            }
        } else {
            if (deltaDays > -durationDays) {
                setTempResizeDeltas(prev => ({ ...prev, [resizeItemId]: { startDelta: 0, endDelta: deltaDays } }))
            }
        }
    }

    const handleResizeEnd = () => {
        if (!resizeItemId) return

        const node = flatNodes.find(n => n.id === resizeItemId)
        const resize = tempResizeDeltas[resizeItemId]

        if (node && resize && onTaskUpdate) {
            const newStart = addDays(node.es, resize.startDelta)
            const newEnd = addDays(node.ef, resize.endDelta)

            if (newStart <= newEnd) {
                const { children, level, expanded, hasChildren, es, ef, ls, lf, float, isCritical, ...rawTask } = node
                const updatedTask = {
                    ...rawTask,
                    startDate: newStart.toISOString(),
                    endDate: newEnd.toISOString(),
                    dueDate: newEnd.toISOString() // Sync dueDate with endDate for consistency
                } as GeneratedTask

                onTaskUpdate(updatedTask)
            }
        }

        setResizeItemId(null)
        setResizeMode(null)
        setTempResizeDeltas({})
    }

    // Effect for global mouse events
    useEffect(() => {
        if (draggingItemId) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
            return () => {
                window.removeEventListener('mousemove', handleMouseMove)
                window.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [draggingItemId, dragStartX, dragStartLeft, startDate, flatNodes, onTaskUpdate, isDragging])

    useEffect(() => {
        if (resizeItemId) {
            window.addEventListener('mousemove', handleResizeMove)
            window.addEventListener('mouseup', handleResizeEnd)
            return () => {
                window.removeEventListener('mousemove', handleResizeMove)
                window.removeEventListener('mouseup', handleResizeEnd)
            }
        }
    }, [resizeItemId, resizeMode, resizeStartX, flatNodes, onTaskUpdate, tempResizeDeltas])

    // Cursor effect
    useEffect(() => {
        if (draggingItemId || resizeItemId) {
            document.body.style.cursor = 'ew-resize'
            const cleanup = () => { document.body.style.cursor = 'default' }
            return cleanup
        }
    }, [draggingItemId, resizeItemId])

    // Scroll management
    useLayoutEffect(() => {
        if (isPrependingRef.current && ganttBodyRef.current) {
            const diff = ganttBodyRef.current.scrollWidth - prevScrollWidthRef.current
            if (diff > 0) {
                ganttBodyRef.current.scrollLeft += diff
                if (headerRef.current) headerRef.current.scrollLeft = ganttBodyRef.current.scrollLeft
            }
            isPrependingRef.current = false
        }
    }, [startDate])

    const handleTimelineScroll = (direction: 'left' | 'right') => {
        if (ganttBodyRef.current) {
            if (direction === 'left') {
                isPrependingRef.current = true
                prevScrollWidthRef.current = ganttBodyRef.current.scrollWidth
                setExtraWeeksBefore(prev => prev + 2)
            } else {
                setExtraWeeksAfter(prev => prev + 2)
                requestAnimationFrame(() => ganttBodyRef.current?.scrollBy({ left: 300, behavior: 'smooth' }))
            }
        }
    }

    const onGanttBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollLeft, scrollWidth, clientWidth } = e.currentTarget
        if (headerRef.current) headerRef.current.scrollLeft = scrollLeft

        if (scrollLeft < 100 && !isPrependingRef.current) {
            isPrependingRef.current = true
            prevScrollWidthRef.current = scrollWidth
            setExtraWeeksBefore(prev => prev + 4)
        }
        if (scrollLeft + clientWidth > scrollWidth - 100) {
            setExtraWeeksAfter(prev => prev + 4)
        }
    }

    const scrollToToday = () => {
        if (ganttBodyRef.current) {
            const daysDiff = differenceInDays(new Date(), startDate)
            ganttBodyRef.current.scrollTo({ left: Math.max(0, daysDiff * COLUMN_WIDTH - 300), behavior: 'smooth' })
        }
    }

    const toggleCollapse = (id: string) => {
        const newSet = new Set(collapsedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setCollapsedIds(newSet)
    }

    // ============================================================
    // TASK BAR RENDERING
    // ============================================================
    const renderTaskBar = (node: WBSNode) => {
        const start = node.es
        const end = node.ef

        const offset = differenceInDays(start, startDate)
        const duration = differenceInDays(end, start)
        const renderDuration = node.isMilestone ? 1 : Math.max(duration, 1)

        let left = offset * COLUMN_WIDTH
        let width = node.isMilestone ? COLUMN_WIDTH : (renderDuration * COLUMN_WIDTH)

        // Apply drag/resize optimistically
        if (draggingItemId === node.id && tempItemPositions[node.id] !== undefined) {
            left = tempItemPositions[node.id] ?? left
        }

        const resize = resizeItemId === node.id ? tempResizeDeltas[node.id] : undefined
        if (resize) {
            left += resize.startDelta * COLUMN_WIDTH
            width += (resize.endDelta - resize.startDelta) * COLUMN_WIDTH
        }

        // ★ CRITICAL PATH CHECK - Uses criticalPathIds set
        const isCritical = viewMode === 'critical' && criticalPathIds.has(node.id)

        // DEBUG: Log first 3 tasks to diagnose
        if (flatNodes.indexOf(node) < 3) {
            console.log(`[RENDER] Task: ${node.title}, viewMode=${viewMode}, hasInSet=${criticalPathIds.has(node.id)}, isCritical=${isCritical}, nodeId=${node.id}`)
        }

        const style: React.CSSProperties = {
            left: `${left}px`,
            width: `${Math.max(width, 4)}px`,
            height: '100%',
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: node.isMilestone ? 'center' : 'flex-start',
            zIndex: 10
        }

        const isMoving = draggingItemId === node.id
        const isResizing = resizeItemId === node.id

        return (
            <div
                id={`gantt-task-${node.id}`}
                style={style}
                className={cn(
                    "group",
                    !node.isMilestone && (isMoving || isResizing ? 'cursor-ew-resize' : 'cursor-pointer hover:cursor-ew-resize')
                )}
                data-task-id={node.id}
                // Only attach main click handler if not using custom drag handler
                onClick={() => { if (!isDragging && !isMoving && !isResizing) onTaskClick?.(node) }}
                onMouseDown={(e) => !node.isMilestone && handleMouseDown(e, node, left)}
            >
                {node.isMilestone ? (
                    <div className="relative flex flex-col items-center cursor-pointer" onClick={(e) => { e.stopPropagation(); onTaskClick?.(node) }}>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <div className={cn(
                                        "w-5 h-5 rotate-45 border-2 shadow-md transition-all hover:scale-110",
                                        isCritical
                                            ? "bg-red-500 border-red-700 shadow-red-300"
                                            : (() => {
                                                const colors = getStatusColors(node.status || 'open');
                                                // Extract color name/shade to match task bars
                                                const colorMatch = colors.gradientFrom.match(/from-(\w+)-(\d+)/);
                                                if (colorMatch && colorMatch[1] && colorMatch[2]) {
                                                    const colorName = colorMatch[1];
                                                    const shade = colorMatch[2];
                                                    const borderShade = parseInt(shade) >= 600 ? '700' : '600';
                                                    const shadowShade = '300';
                                                    return `bg-${colorName}-${shade} border-${colorName}-${borderShade} shadow-${colorName}-${shadowShade}`;
                                                }
                                                return "bg-amber-400 border-amber-600 shadow-amber-200";
                                            })()
                                    )} />
                                </TooltipTrigger>
                                <TooltipContent className="z-[100]">
                                    <p className="font-bold">{node.title}</p>
                                    <p className="text-xs">
                                        Milestone: {!isNaN(start.getTime())
                                            ? formatDate(start)
                                            : 'Invalid Date'}
                                    </p>
                                    {isCritical && <p className="text-xs text-red-500 font-semibold">★ On Critical Path</p>}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <span className={cn(
                            "absolute top-7 whitespace-nowrap text-[10px] font-semibold px-1 rounded shadow-sm z-20",
                            isCritical ? "text-red-700 bg-red-50" : "text-gray-600 bg-white/90"
                        )}>
                            {node.title}
                        </span>
                    </div>
                ) : (
                    (() => {
                        // Determine colors based on priority: Critical > Status
                        let colorClasses = ""
                        if (isCritical) {
                            colorClasses = "bg-red-500 ring-red-600"
                        } else {
                            // Extract solid color from gradient to match Timeline view exactly
                            // Use same logic as Timeline's getStatusColor function
                            const status = node.status || 'open'
                            const statusColors = getStatusColors(status)
                            const colorMatch = statusColors.gradientFrom.match(/from-(\w+)-(\d+)/)
                            if (colorMatch && colorMatch[1] && colorMatch[2]) {
                                const colorName = colorMatch[1]
                                const shade = colorMatch[2]
                                const ringShade = parseInt(shade) >= 600 ? '700' : '600'
                                // Match Timeline colors exactly
                                colorClasses = `bg-${colorName}-${shade} ring-${colorName}-${ringShade}`
                            } else {
                                colorClasses = "bg-gray-500 ring-gray-600"
                            }
                        }

                        return (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className={cn(
                                            "h-7 rounded-md shadow-sm border px-2 text-xs flex items-center text-white truncate transition-all hover:shadow-lg w-full font-medium relative",
                                            colorClasses
                                        )}>
                                            <span className="truncate">{node.title}</span>

                                            {/* Left Drag Handle */}
                                            <div
                                                className="absolute left-0 top-0 bottom-0 w-3 hover:bg-white/30 rounded-l-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-ew-resize"
                                                onMouseDown={(e) => handleResizeStart(e, node, 'start')}
                                                onClick={(e) => e.stopPropagation()}
                                                title="Drag to change start date"
                                            >
                                                <div className="w-[1.5px] h-3 bg-white/70 rounded-full" />
                                            </div>

                                            {/* Right Drag Handle */}
                                            <div
                                                className="absolute right-0 top-0 bottom-0 w-3 hover:bg-white/30 rounded-r-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-ew-resize"
                                                onMouseDown={(e) => handleResizeStart(e, node, 'end')}
                                                onClick={(e) => e.stopPropagation()}
                                                title="Drag to change due date"
                                            >
                                                <div className="w-[1.5px] h-3 bg-white/70 rounded-full" />
                                            </div>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="z-[100]">
                                        <p className="font-bold">{node.title}</p>
                                        <p className="text-xs">
                                            {!isNaN(start.getTime()) && !isNaN(end.getTime())
                                                ? `${formatDate(start)} - ${formatDate(end)}`
                                                : 'Invalid Date Range'}
                                        </p>
                                        <p className="text-xs text-gray-400">{duration} days</p>
                                        {isCritical && <p className="text-xs text-red-500 font-semibold">★ On Critical Path</p>}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )
                    })()
                )}
            </div>
        )
    }

    // ============================================================
    // GRID LINES
    // ============================================================
    const renderGridLines = () => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        return (
            <div className="absolute top-0 left-0 h-full w-full pointer-events-none">
                {timelineDates.map((d, i) => {
                    const isToday = d.getTime() === today.getTime()
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6

                    return (
                        <div
                            key={i}
                            className={cn(
                                "absolute top-0 h-full border-r",
                                isWeekend ? "bg-gray-50/80 border-gray-200" : "border-gray-100",
                                isToday && "bg-blue-50/50"
                            )}
                            style={{ left: i * COLUMN_WIDTH, width: COLUMN_WIDTH }}
                        >
                            {isToday && <div className="absolute top-0 left-1/2 w-0.5 h-full bg-blue-400 -translate-x-1/2" />}
                        </div>
                    )
                })}
            </div>
        )
    }

    // ============================================================
    // DEPENDENCY ARROWS - FIXED ARROWHEADS
    // ============================================================
    const renderDependencies = () => {
        const contentHeight = flatNodes.length * ROW_HEIGHT
        const contentWidth = timelineDates.length * COLUMN_WIDTH

        // Build node position lookup
        const nodePositions = new Map<string, { x: number, y: number, width: number, isMilestone: boolean, index: number }>()
        flatNodes.forEach((node, index) => {
            const offset = differenceInDays(node.es, startDate)
            let duration = differenceInDays(node.ef, node.es)
            if (!node.isMilestone && duration < 1) duration = 1

            nodePositions.set(node.id, {
                x: offset * COLUMN_WIDTH,
                y: (index * ROW_HEIGHT) + (ROW_HEIGHT / 2),
                width: node.isMilestone ? COLUMN_WIDTH : duration * COLUMN_WIDTH,
                isMilestone: node.isMilestone || false,
                index
            })
        })

        const arrows: React.ReactNode[] = []

        flatNodes.forEach((node) => {
            if (!node.dependencies || node.dependencies.length === 0) return

            const targetPos = nodePositions.get(node.id)
            if (!targetPos) return

            node.dependencies.forEach((dep: any) => {
                const sourcePos = nodePositions.get(dep.targetTaskId)
                if (!sourcePos) return

                // ★ CRITICAL PATH LINK - Both ends must be on critical path
                const isCriticalLink = viewMode === 'critical' &&
                    criticalPathIds.has(node.id) &&
                    criticalPathIds.has(dep.targetTaskId)

                const type = dep.type || 'FS'

                // Calculate connection points
                let sourceX: number, targetX: number
                const sourceY = sourcePos.y
                const targetY = targetPos.y

                // Source X
                if (type === 'FS' || type === 'FF') {
                    sourceX = sourcePos.x + sourcePos.width
                    if (sourcePos.isMilestone) sourceX = sourcePos.x + (COLUMN_WIDTH / 2) + 12
                } else {
                    sourceX = sourcePos.x
                    if (sourcePos.isMilestone) sourceX = sourcePos.x + (COLUMN_WIDTH / 2) - 12
                }

                // Target X
                if (type === 'FS' || type === 'SS') {
                    targetX = targetPos.x - 2
                    if (targetPos.isMilestone) targetX = targetPos.x + (COLUMN_WIDTH / 2) - 12
                } else {
                    targetX = targetPos.x + targetPos.width
                    if (targetPos.isMilestone) targetX = targetPos.x + (COLUMN_WIDTH / 2) + 12
                }

                // Generate path
                const path = generatePath(sourceX, sourceY, targetX, targetY, type)

                // Colors - ★ RED FOR CRITICAL PATH
                const strokeColor = isCriticalLink ? '#dc2626' : '#94a3b8'
                const strokeWidth = isCriticalLink ? 2.5 : 1.5
                const glowColor = isCriticalLink ? '#fecaca' : '#e2e8f0'

                arrows.push(
                    <g key={`${node.id}-${dep.targetTaskId}`}>
                        {/* Glow/shadow */}
                        <path d={path} stroke={glowColor} strokeWidth={strokeWidth + 2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        {/* Main line */}
                        <path d={path} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        {/* Source circle */}
                        <circle cx={sourceX} cy={sourceY} r={3} fill={strokeColor} />
                        {/* ★ ARROWHEAD - Fixed polygon */}
                        <polygon
                            points={`${targetX},${targetY} ${targetX - 8},${targetY - 4} ${targetX - 8},${targetY + 4}`}
                            fill={strokeColor}
                        />
                    </g>
                )
            })
        })

        return (
            <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: contentWidth, height: contentHeight, zIndex: 5 }}>
                {arrows}
            </svg>
        )
    }

    // Generate smooth path
    function generatePath(x1: number, y1: number, x2: number, y2: number, type: string): string {
        const r = 6 // radius

        if (type === 'SS') {
            const stub = Math.min(x1, x2) - 15
            return `M${x1},${y1} L${stub + r},${y1} Q${stub},${y1} ${stub},${y1 + (y2 > y1 ? r : -r)} L${stub},${y2 - (y2 > y1 ? r : -r)} Q${stub},${y2} ${stub + r},${y2} L${x2},${y2}`
        }

        if (type === 'FF') {
            const stub = Math.max(x1, x2) + 15
            return `M${x1},${y1} L${stub - r},${y1} Q${stub},${y1} ${stub},${y1 + (y2 > y1 ? r : -r)} L${stub},${y2 - (y2 > y1 ? r : -r)} Q${stub},${y2} ${stub - r},${y2} L${x2},${y2}`
        }

        // FS - Most common
        if (x2 > x1 + 15) {
            const mid = (x1 + x2) / 2
            return `M${x1},${y1} L${mid - r},${y1} Q${mid},${y1} ${mid},${y1 + (y2 > y1 ? r : -r)} L${mid},${y2 - (y2 > y1 ? r : -r)} Q${mid},${y2} ${mid + r},${y2} L${x2},${y2}`
        } else {
            const stubR = x1 + 12
            const stubY = y1 + (y2 > y1 ? ROW_HEIGHT * 0.6 : -ROW_HEIGHT * 0.6)
            const stubL = x2 - 12
            return `M${x1},${y1} L${stubR},${y1} L${stubR},${stubY} L${stubL},${stubY} L${stubL},${y2} L${x2},${y2}`
        }
    }

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="flex flex-col h-full min-h-0 bg-white overflow-hidden select-none">
            {/* TOOLBAR */}
            <div className="h-12 border-b flex items-center justify-between px-4 bg-gray-50/80 shrink-0">
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => onCreateTask?.(false)}>
                        <Plus className="w-4 h-4 mr-1" /> Add Task
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onCreateTask?.(true)}>
                        <div className="w-2.5 h-2.5 rotate-45 bg-amber-400 border border-amber-600 mr-2 flex-shrink-0" />
                        Add Milestone
                    </Button>
                    {projectId && (
                        <Button variant="outline" size="sm" onClick={() => setImportWizardOpen(true)} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                            <FileSpreadsheet className="w-4 h-4 mr-1" /> Import
                        </Button>
                    )}
                </div>

                <div className="flex items-center space-x-1 bg-white rounded-md border p-0.5 shadow-sm">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleTimelineScroll('left')}><ChevronLeft className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs font-medium px-3" onClick={scrollToToday}>Today</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleTimelineScroll('right')}><ChevronRight className="w-4 h-4" /></Button>
                </div>

                <div className="flex items-center space-x-2">
                    <Select value={filterMode} onValueChange={(value: any) => setFilterMode(value)}>
                        <SelectTrigger className="h-8 w-[140px] bg-white text-xs font-medium">
                            <SelectValue placeholder="Filter by..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Show All</SelectItem>
                            <SelectItem value="tasks">Tasks Only</SelectItem>
                            <SelectItem value="milestones">Milestones Only</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Button
                    variant={viewMode === 'critical' ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode(prev => prev === 'standard' ? 'critical' : 'standard')}
                    className={viewMode === 'critical' ? 'shadow-md' : ''}
                >
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {viewMode === 'critical' ? 'Hide Critical Path' : 'Show Critical Path'}
                </Button>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex overflow-hidden min-h-0">
                {/* LEFT: Task List */}
                <div
                    className="border-r flex flex-col bg-white z-20 shadow-[2px_0_4px_rgba(0,0,0,0.02)] shrink-0 min-h-0"
                    style={{ width: columnWidths.work + columnWidths.assignee + columnWidths.dep }}
                >
                    <div className="h-[50px] border-b bg-gray-50/50 flex items-center font-semibold text-[11px] text-gray-500 uppercase tracking-widest shrink-0">
                        <div className="px-4 border-r h-full flex items-center relative shrink-0" style={{ width: columnWidths.work, minWidth: columnWidths.work }}>
                            Work
                            <div
                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400/30 transition-colors z-30"
                                onMouseDown={(e) => handleColumnResizeStart('work', e)}
                            />
                        </div>
                        <div className="px-3 border-r h-full flex items-center justify-center relative shrink-0" style={{ width: columnWidths.assignee, minWidth: columnWidths.assignee }}>
                            Assignee
                            <div
                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400/30 transition-colors z-30"
                                onMouseDown={(e) => handleColumnResizeStart('assignee', e)}
                            />
                        </div>
                        <div className="flex items-center justify-center h-full text-center text-[10px] relative shrink-0" style={{ width: columnWidths.dep, minWidth: columnWidths.dep }}>
                            Dep
                            <div
                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400/30 transition-colors z-30"
                                onMouseDown={(e) => handleColumnResizeStart('dep', e)}
                            />
                        </div>
                    </div>

                    <div
                        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-ultrathin"
                        ref={scrollContainerRef}
                        onScroll={(e) => {
                            if (ganttBodyRef.current) ganttBodyRef.current.scrollTop = e.currentTarget.scrollTop
                        }}
                    >
                        {flatNodes.map((node) => {
                            const isCritical = viewMode === 'critical' && criticalPathIds.has(node.id)
                            return (
                                <div
                                    key={node.id}
                                    style={{ height: ROW_HEIGHT }}
                                    className={cn(
                                        "border-b flex items-center transition-colors",
                                        isCritical ? "bg-red-50 hover:bg-red-100" : "hover:bg-blue-50/50"
                                    )}
                                >
                                    <div className="flex items-center h-full px-2 border-r overflow-hidden shrink-0" style={{ width: columnWidths.work, minWidth: columnWidths.work, paddingLeft: `${node.level * 20 + 8}px` }}>
                                        <button
                                            className={cn(
                                                "p-0.5 mr-1.5 rounded-md hover:bg-gray-100 transition-colors flex-shrink-0 text-gray-400",
                                                !node.hasChildren && "opacity-0 cursor-default"
                                            )}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                if (node.hasChildren) toggleCollapse(node.id)
                                            }}
                                        >
                                            {node.hasChildren ? (node.expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : <div className="w-3.5 h-3.5" />}
                                        </button>

                                        {node.isMilestone && (
                                            <div className={cn(
                                                "w-2.5 h-2.5 rotate-45 border flex-shrink-0 mr-2",
                                                isCritical ? "bg-red-500 border-red-700" : (() => {
                                                    const colors = getStatusColors(node.status || 'open');
                                                    const colorMatch = colors.gradientFrom.match(/from-(\w+)-(\d+)/);
                                                    if (colorMatch && colorMatch[1] && colorMatch[2]) {
                                                        const colorName = colorMatch[1];
                                                        const shade = colorMatch[2];
                                                        const borderShade = parseInt(shade) >= 600 ? '700' : '600';
                                                        return `bg-${colorName}-${shade} border-${colorName}-${borderShade}`;
                                                    }
                                                    return "bg-amber-400 border-amber-600";
                                                })()
                                            )} title="Milestone" />
                                        )}

                                        <div className="flex items-baseline overflow-hidden truncate">
                                            {formatTaskId(node as any, project, companyId ?? undefined, currentCompany?.domain ?? undefined) ? (
                                                <span
                                                    className="text-blue-600 font-bold mr-2 text-[11px] font-mono whitespace-nowrap hover:underline cursor-pointer"
                                                    onClick={(e) => { e.stopPropagation(); onTaskClick?.(node) }}
                                                >
                                                    {formatTaskId(node as any, project, companyId ?? undefined, currentCompany?.domain ?? undefined)}
                                                </span>
                                            ) : null}
                                            <span
                                                className={cn(
                                                    "text-sm truncate cursor-pointer hover:text-blue-600 transition-colors",
                                                    node.isMilestone && "font-semibold",
                                                    isCritical ? "text-red-700 font-semibold" : "text-gray-700"
                                                )}
                                                onClick={() => onTaskClick?.(node)}
                                            >
                                                {node.title}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Assignee Column */}
                                    <div className="flex items-center px-2 border-r h-full overflow-hidden shrink-0" style={{ width: columnWidths.assignee, minWidth: columnWidths.assignee }}>
                                        {(() => {
                                            const assigneeId = node.assignedUserId || node.assignedTo
                                            const user = projectUsers.find(u => u.id === assigneeId)
                                            const name = user?.name || node.assignedToName || 'Unassigned'

                                            if (name === 'Unassigned') {
                                                return <span className="text-[10px] text-gray-400 italic">Unassigned</span>
                                            }

                                            return (
                                                <div className="flex items-center gap-2 truncate">
                                                    {user?.avatar ? (
                                                        <img src={user.avatar} alt={name} className="w-5 h-5 rounded-full object-cover border border-gray-200" />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[9px] font-bold text-blue-600 border border-blue-200">
                                                            {name.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <span className="text-[11px] text-gray-600 truncate font-medium">{name}</span>
                                                </div>
                                            )
                                        })()}
                                    </div>

                                    <div className="flex items-center justify-center h-full shrink-0" style={{ width: columnWidths.dep, minWidth: columnWidths.dep }}>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setDependencyModal({ isOpen: true, sourceTask: node }); }}>
                                            {node.dependencies && node.dependencies.length > 0 ? (
                                                <span className={cn("text-xs font-mono font-bold", isCritical ? "text-red-600" : "text-blue-600")}>{node.dependencies.length}</span>
                                            ) : (
                                                <span className="text-gray-300 hover:text-gray-500 text-lg leading-none">+</span>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* RIGHT: Gantt */}
                <div className="flex-1 flex flex-col overflow-hidden bg-white min-h-0">
                    <div className="h-[50px] border-b bg-white shrink-0 overflow-hidden" ref={headerRef}>
                        <div className="flex flex-col h-full" style={{ width: timelineDates.length * COLUMN_WIDTH }}>
                            <div className="flex h-[25px] border-b bg-gray-50/80">
                                {(() => {
                                    const months: { title: string; width: number }[] = []
                                    let currentMonthStr = '', currentMonthWidth = 0

                                    timelineDates.forEach((d, i) => {
                                        const mStr = format(d, 'MMMM yyyy')
                                        if (mStr !== currentMonthStr) {
                                            if (currentMonthStr) months.push({ title: currentMonthStr, width: currentMonthWidth })
                                            currentMonthStr = mStr
                                            currentMonthWidth = COLUMN_WIDTH
                                        } else {
                                            currentMonthWidth += COLUMN_WIDTH
                                        }
                                        if (i === timelineDates.length - 1) months.push({ title: currentMonthStr, width: currentMonthWidth })
                                    })

                                    return months.map((m, idx) => (
                                        <div key={idx} className="border-r px-2 text-xs font-semibold text-gray-700 flex items-center truncate bg-white/90" style={{ width: m.width, minWidth: m.width }}>{m.title}</div>
                                    ))
                                })()}
                            </div>
                            <div className="flex h-[25px] bg-white">
                                {timelineDates.map((d, i) => {
                                    const isToday = d.toDateString() === new Date().toDateString()
                                    return (
                                        <div key={i} className={cn("flex-shrink-0 flex flex-col items-center justify-center border-r text-[9px] h-full", isToday && "bg-blue-100")} style={{ width: COLUMN_WIDTH }}>
                                            <span className="text-gray-400 font-medium leading-tight">{format(d, 'EEE')}</span>
                                            <span className={cn("font-bold leading-tight", isToday ? "text-blue-600" : "text-gray-700")}>{format(d, 'd')}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div
                        className="flex-1 overflow-auto scrollbar-ultrathin"
                        ref={ganttBodyRef}
                        onScroll={(e) => {
                            onGanttBodyScroll(e)
                            if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = e.currentTarget.scrollTop
                        }}
                    >
                        <div className="relative" style={{ width: timelineDates.length * COLUMN_WIDTH, height: flatNodes.length * ROW_HEIGHT, minHeight: '100%' }}>
                            {renderGridLines()}
                            {renderDependencies()}

                            {flatNodes.map((node, index) => {
                                const isCritical = viewMode === 'critical' && criticalPathIds.has(node.id)
                                return (
                                    <div
                                        key={node.id}
                                        className={cn("absolute left-0 right-0 border-b border-gray-100", isCritical && "bg-red-50/40")}
                                        style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
                                    >
                                        {renderTaskBar(node)}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Dialogs */}
            {dependencyModal.isOpen && dependencyModal.sourceTask && (
                <DependencyDialog
                    isOpen={dependencyModal.isOpen}
                    onClose={() => setDependencyModal({ isOpen: false, sourceTask: null })}
                    sourceTask={dependencyModal.sourceTask}
                    project={project}
                    availableTasks={items}
                    companyId={companyId ?? undefined}
                    companyDomain={currentCompany?.domain ?? undefined}
                    onSave={async (targetId, type, lag, originalTargetId) => {
                        const node = dependencyModal.sourceTask as unknown as WBSNode
                        if (targetId === node.id) { alert("Cannot link task to itself."); return }

                        const currentDeps = [...(node.dependencies || [])]
                        const searchId = originalTargetId || targetId
                        const index = currentDeps.findIndex((d: any) => d.targetTaskId === searchId)

                        const newDeps = [...currentDeps]
                        if (index >= 0) {
                            newDeps[index] = { targetTaskId: targetId, type, lag }
                        } else {
                            if (currentDeps.some((d: any) => d.targetTaskId === targetId)) {
                                alert("Dependency already exists.");
                                return;
                            }
                            newDeps.push({ targetTaskId: targetId, type, lag })
                        }

                        const { children, level, expanded, hasChildren, es, ef, ls, lf, float, isCritical, ...rawTask } = node
                        const updatedTask = { ...rawTask, dependencies: newDeps } as GeneratedTask

                        const tempItems = items.map(t => t.id === updatedTask.id ? updatedTask : t) as GeneratedTask[]
                        const schedule = calculateWBSSchedule(tempItems)
                        const updates: GeneratedTask[] = [updatedTask]

                        schedule.forEach((res, taskId) => {
                            const t = tempItems.find(i => i.id === taskId)
                            if (!t || t.id === updatedTask.id) return // Avoid double adding primary task
                            const oldStart = t.startDate ? formatISODate(t.startDate) : ''
                            const oldEnd = t.endDate ? formatISODate(t.endDate) : ''
                            const newStart = formatISODate(res.es)

                            // Convert EF back to endDate: CPM adds MS_PER_DAY to EF, so we subtract 1 day
                            // For milestones (ES == EF), use EF directly as they have 0 duration
                            const calculatedEndDate = (res.es.getTime() === res.ef.getTime())
                                ? res.ef
                                : addDays(res.ef, -1)
                            const newEnd = formatISODate(calculatedEndDate)

                            if (oldStart !== newStart || oldEnd !== newEnd) {
                                // Sync dueDate with endDate to ensure consistency between WBS and task page
                                const endDateISO = calculatedEndDate.toISOString()
                                updates.push({
                                    ...t,
                                    startDate: res.es.toISOString(),
                                    endDate: endDateISO,
                                    dueDate: endDateISO // Always sync dueDate with endDate
                                })
                            }
                        })

                        if (onTasksUpdate) {
                            await onTasksUpdate(updates)
                        } else {
                            // Fallback to individual updates if onTasksUpdate not provided
                            for (const upd of updates) {
                                await onTaskUpdate?.(upd)
                            }
                        }
                    }}
                    onDelete={async (targetId) => {
                        const node = dependencyModal.sourceTask as unknown as WBSNode
                        const currentDeps = node.dependencies || []
                        const updatedDeps = currentDeps.filter((d: any) => d.targetTaskId !== targetId)
                        const { children, level, expanded, hasChildren, es, ef, ls, lf, float, isCritical, ...rawTask } = node
                        const updatedTask = { ...rawTask, dependencies: updatedDeps }

                        const tempItems = items.map(t => t.id === updatedTask.id ? updatedTask : t) as GeneratedTask[]
                        const schedule = calculateWBSSchedule(tempItems)
                        const updates: GeneratedTask[] = [updatedTask]

                        schedule.forEach((res, taskId) => {
                            const t = tempItems.find(i => i.id === taskId)
                            if (!t || t.id === updatedTask.id) return
                            const oldStart = t.startDate ? formatISODate(t.startDate) : ''
                            const oldEnd = t.endDate ? formatISODate(t.endDate) : ''
                            const newStart = formatISODate(res.es)
                            const newEnd = (res.es.getTime() === res.ef.getTime()) ? formatISODate(res.ef) : formatISODate(addDays(res.ef, -1))
                            if (oldStart !== newStart || oldEnd !== newEnd) {
                                updates.push({
                                    ...t,
                                    startDate: res.es.toISOString(),
                                    endDate: (res.es.getTime() === res.ef.getTime()) ? res.ef.toISOString() : addDays(res.ef, -1).toISOString(),
                                    dueDate: (res.es.getTime() === res.ef.getTime()) ? res.ef.toISOString() : addDays(res.ef, -1).toISOString()
                                })
                            }
                        })

                        if (onTasksUpdate) {
                            await onTasksUpdate(updates)
                        } else {
                            for (const upd of updates) {
                                await onTaskUpdate?.(upd)
                            }
                        }
                    }}
                />
            )}

            {projectId && (
                <ImportWizard
                    isOpen={importWizardOpen}
                    onClose={() => {
                        setImportWizardOpen(false)
                        onTasksImported?.(0) // Logic for refreshing is usually in parent
                    }}
                    importType="wbs_gantt"
                    context={{
                        companyId: companyId || '',
                        projectId: projectId,
                        userId: user?.id || '',
                        workspaceId: workspaceId || ''
                    }}
                />
            )}
        </div>
    )
}
