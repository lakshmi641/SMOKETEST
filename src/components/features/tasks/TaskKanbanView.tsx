'use client'

import { useMemo, memo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { GeneratedTask } from '@/types/task-template-schema'
import { KanbanTaskItem } from './KanbanTaskItem'
import { DroppableColumn } from './DroppableColumn'
import { Plus, GripVertical, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Default columns shown on board (Jira-style: no Open, On Hold, Cancelled by default) */
export const DEFAULT_BOARD_COLUMN_CODES = ['assigned', 'in_progress', 'completed'] as const

const ALL_STATUSES_FALLBACK = [
  { code: 'open', name: 'Open' },
  { code: 'assigned', name: 'Assigned' },
  { code: 'in_progress', name: 'In Progress' },
  { code: 'on_hold', name: 'On Hold' },
  { code: 'approval_required', name: 'Approval Required' },
  { code: 'completed', name: 'Completed' },
  { code: 'cancelled', name: 'Cancelled' },
]

interface TaskKanbanViewProps {
  tasks: GeneratedTask[]
  /** All available statuses (from task master / company) */
  statuses: Array<{ code: string; name: string }>
  /** Status codes to show as columns. If not provided, uses DEFAULT_BOARD_COLUMN_CODES. */
  visibleStatusCodes?: string[]
  /** Called when user changes visible columns (e.g. from Configure dialog). */
  onVisibleStatusCodesChange?: (codes: string[]) => void
  onDragEnd: (event: DragEndEvent) => void
  onDragStart: (event: any) => void
  onDragCancel: () => void
  activeId: string | null
  onTaskClick?: (task: GeneratedTask) => void
  users?: Array<{ id: string; name: string; avatar: string | null }>
  currentUserId?: string
}

// Memoized column component for better performance
const KanbanColumn = memo(({
  status,
  tasks,
  onTaskClick,
  users,
  currentUserId,
}: {
  status: { code: string; name: string }
  tasks: GeneratedTask[]
  onTaskClick?: (task: GeneratedTask) => void
  users?: Array<{ id: string; name: string; avatar: string | null }>
  currentUserId?: string
}) => {
  const taskIds = useMemo(() => tasks.map(t => t.id || '').filter(Boolean), [tasks])

  return (
    <div className="flex-shrink-0 w-[280px] h-full">
      <div className="bg-card border border-border rounded-lg flex flex-col h-full shadow-sm overflow-hidden">
        {/* Column Header - Fixed */}
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex-shrink-0 rounded-t-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground capitalize">
              {status.name}
            </h3>
            <span className="text-xs font-medium text-muted-foreground bg-background px-2 py-0.5 rounded-full">
              {tasks.length}
            </span>
          </div>
        </div>

        {/* Column Content - Scrollable */}
        <div className="flex-1 min-h-0">
          <DroppableColumn id={status.code}>
            <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
              <div className="h-full overflow-y-auto overflow-x-hidden px-2 py-3 space-y-2 scrollbar-ultrathin">
                {tasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <p>No tasks</p>
                  </div>
                ) : (
                  tasks.map((task) => (
                    <KanbanTaskItem key={task.id} task={task} onTaskClick={onTaskClick} users={users} currentUserId={currentUserId} />
                  ))
                )}
              </div>
            </SortableContext>
          </DroppableColumn>
        </div>
      </div>
    </div>
  )
})

KanbanColumn.displayName = 'KanbanColumn'

function SortableConfigRow({
  code,
  name,
  onRemove,
}: {
  code: string
  name: string
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: code })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-2 bg-card',
        isDragging ? 'border-primary/50 shadow-md' : 'border-border'
      )}
    >
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5 rounded"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-sm font-medium capitalize flex-1">{name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        aria-label="Remove column"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function TaskKanbanView({
  tasks = [],
  statuses,
  visibleStatusCodes,
  onVisibleStatusCodesChange,
  onDragEnd,
  onDragStart,
  onDragCancel,
  activeId,
  onTaskClick,
  users = [],
  currentUserId
}: TaskKanbanViewProps) {
  const [configOpen, setConfigOpen] = useState(false)
  const [draftCodes, setDraftCodes] = useState<string[]>([])
  const [internalColumnCodes, setInternalColumnCodes] = useState<string[]>([])

  const isControlled = visibleStatusCodes !== undefined && onVisibleStatusCodesChange !== undefined

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const configDialogSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const allStatuses = useMemo(() =>
    Array.isArray(statuses) && statuses.length > 0 ? statuses : ALL_STATUSES_FALLBACK,
    [statuses]
  )

  const selectedCodes = useMemo(() => {
    if (isControlled && Array.isArray(visibleStatusCodes) && visibleStatusCodes.length > 0) {
      return visibleStatusCodes.filter(code => allStatuses.some(s => s.code === code))
    }
    if (!isControlled && internalColumnCodes.length > 0) {
      return internalColumnCodes.filter(code => allStatuses.some(s => s.code === code))
    }
    return [...DEFAULT_BOARD_COLUMN_CODES].filter(code => allStatuses.some(s => s.code === code))
  }, [isControlled, visibleStatusCodes, internalColumnCodes, allStatuses])

  const validStatuses = useMemo(() =>
    allStatuses.filter(s => selectedCodes.includes(s.code)),
    [allStatuses, selectedCodes]
  )

  const openConfig = () => {
    setDraftCodes([...selectedCodes])
    setConfigOpen(true)
  }

  const saveConfig = () => {
    if (draftCodes.length > 0) {
      if (isControlled) {
        onVisibleStatusCodesChange?.(draftCodes)
      } else {
        setInternalColumnCodes(draftCodes)
      }
    }
    setConfigOpen(false)
  }

  const toggleDraft = (code: string, checked: boolean) => {
    if (checked) {
      setDraftCodes(prev => prev.includes(code) ? prev : [...prev, code])
    } else {
      setDraftCodes(prev => prev.filter(c => c !== code))
    }
  }

  const removeDraft = (code: string) => {
    setDraftCodes(prev => prev.filter(c => c !== code))
  }

  const handleConfigDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const overId = String(over.id)
    setDraftCodes(prev => {
      const oldIndex = prev.indexOf(activeId)
      const newIndex = prev.indexOf(overId)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const validTasks = useMemo(() =>
    Array.isArray(tasks) ? tasks : [],
    [tasks]
  )

  // Group tasks by status - memoized
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, GeneratedTask[]> = {}
    validStatuses.forEach(status => {
      grouped[status.code] = []
    })
    validTasks.forEach(task => {
      if (task.status && grouped[task.status]) {
        grouped[task.status]!.push(task)
      }
    })

    const parseDate = (val: any) => {
      if (!val) return 0
      if (typeof val.toDate === 'function') return val.toDate().getTime()
      const d = new Date(val)
      return isNaN(d.getTime()) ? 0 : d.getTime()
    }

    // Sort: prefer explicit boardOrder; fall back to createdAt desc for tasks without it
    Object.keys(grouped).forEach(status => {
      grouped[status]!.sort((a, b) => {
        const aHasOrder = a.boardOrder !== undefined
        const bHasOrder = b.boardOrder !== undefined
        if (aHasOrder && bHasOrder) return a.boardOrder! - b.boardOrder!
        if (aHasOrder) return -1   // tasks with explicit order come first
        if (bHasOrder) return 1
        // Both lack boardOrder → fall back to createdAt desc
        return parseDate(b.createdAt) - parseDate(a.createdAt)
      })
    })

    return grouped
  }, [validStatuses, validTasks])

  // Get active task for drag overlay
  const activeTask = useMemo(() =>
    activeId ? validTasks.find(t => t.id === activeId) : null,
    [activeId, validTasks]
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      onDragCancel={onDragCancel}
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Horizontal scrollable container - Configure (+ icon only) next to last column */}
        <div className="flex-1 min-h-0 w-full overflow-x-auto overflow-y-hidden scrollbar-ultrathin">
          <div className="inline-flex gap-4 min-w-max px-1 h-full py-6 items-start">
            {validStatuses.map(status => (
              <KanbanColumn
                key={status.code}
                status={status}
                tasks={tasksByStatus[status.code] || []}
                onTaskClick={onTaskClick}
                users={users}
                currentUserId={currentUserId}
              />
            ))}
            <div className="flex-shrink-0 flex items-center pt-1">
              <button
                type="button"
                onClick={openConfig}
                aria-label="Configure columns"
                className={cn(
                  'w-10 h-10 rounded-lg border-2 border-dashed border-border',
                  'flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/30 transition-colors'
                )}
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Configure columns dialog - own DndContext for column reorder */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure board columns</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Drag to reorder columns. Add or remove columns below. At least one column is required.
          </p>
          <DndContext
            sensors={configDialogSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleConfigDragEnd}
          >
            <SortableContext items={draftCodes} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 py-2 max-h-[220px] overflow-y-auto">
                {draftCodes.map((code) => {
                  const status = allStatuses.find(s => s.code === code)
                  if (!status) return null
                  return (
                    <SortableConfigRow
                      key={status.code}
                      code={status.code}
                      name={status.name}
                      onRemove={() => removeDraft(status.code)}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
          {allStatuses.some(s => !draftCodes.includes(s.code)) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Add column</p>
              <div className="flex flex-wrap gap-2">
                {allStatuses
                  .filter(s => !draftCodes.includes(s.code))
                  .map((status) => (
                    <Button
                      key={status.code}
                      variant="outline"
                      size="sm"
                      onClick={() => toggleDraft(status.code, true)}
                      className="capitalize"
                    >
                      {status.name}
                    </Button>
                  ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveConfig} disabled={draftCodes.length === 0}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced Drag Overlay */}
      <DragOverlay>
        {activeTask ? (
          <Card className="p-3 w-[260px] shadow-xl border-2 border-primary/50 bg-background">
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-foreground line-clamp-2">
                {activeTask.title}
              </h4>
              {activeTask.priority && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {activeTask.priority}
                  </span>
                </div>
              )}
            </div>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

