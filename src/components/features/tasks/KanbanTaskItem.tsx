import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatDate, getPriorityColor } from './utils'
import { StarButton } from '@/components/ui/star-button'
import { useStarredItems } from '@/hooks/useStarredItems'
import type { GeneratedTask } from '@/types/task-template-schema'
import { Calendar, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface KanbanTaskItemProps {
  task: GeneratedTask
  onTaskClick?: (task: GeneratedTask) => void
  users?: Array<{ id: string; name: string; avatar: string | null; positionCode?: string }>
  currentUserId?: string
}

export const KanbanTaskItem = memo(function KanbanTaskItem({ task, onTaskClick, users = [], currentUserId }: KanbanTaskItemProps) {
  const { isStarred, toggleStarred } = useStarredItems()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id || '',
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return
    // Don't open task when clicking interactive elements (star, links, etc.)
    if ((e.target as HTMLElement).closest('button, [role="button"], a, [data-drag-handle]')) return

    e.stopPropagation()
    if (onTaskClick) {
      onTaskClick(task)
    }
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        className={cn(
          "p-3 bg-card border border-border rounded-md transition-all duration-150",
          "hover:shadow-md hover:border-primary/20",
          isDragging && "ring-2 ring-primary/50 shadow-lg scale-105",
          !isDragging && "cursor-pointer"
        )}
        onClick={handleClick}
      >
        <div className="space-y-2.5">
          {/* Header with title and star */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5 flex-1 min-w-0">
              <button
                type="button"
                data-drag-handle
                className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground mt-0.5 flex-shrink-0 p-0.5 rounded"
                aria-label="Drag to reorder"
                {...listeners}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
              <span onClick={(e) => e.stopPropagation()} role="presentation">
                <StarButton
                  isStarred={isStarred('task', task.id || '')}
                  onToggle={() => task.id && toggleStarred('task', task.id)}
                  size="sm"
                  className="mt-0.5 flex-shrink-0"
                />
              </span>
              <h4
                className="font-medium text-sm text-foreground line-clamp-2 leading-snug hover:text-primary hover:underline cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  if (!isDragging && onTaskClick) onTaskClick(task)
                }}
              >
                {task.title}
              </h4>
            </div>
          </div>

          {/* Priority and metadata */}
          <div className="flex items-center gap-2 flex-wrap">
            {task.priority && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-medium",
                  getPriorityColor(task.priority)
                )}
              >
                {task.priority}
              </Badge>
            )}
            {task.dueDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(task.dueDate)}</span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {task.progress !== undefined && task.progress > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium text-foreground">{task.progress}%</span>
              </div>
              <Progress value={task.progress} className="h-1.5" />
            </div>
          )}

          {/* Footer with Assignee */}
          <div className="flex items-center justify-between pt-1">
            {(task.assignedUserId || task.assignedToName) && (
              <div className="flex items-center gap-1 max-w-full min-w-0">
                <Avatar className="h-5 w-5 ring-2 ring-background shrink-0">
                  <AvatarImage src={users.find(u => u.id === task.assignedUserId)?.avatar || undefined} />
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {(users.find(u => u.id === task.assignedUserId)?.name || task.assignedToName || task.assignedUserId || '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[10px] text-muted-foreground truncate">
                  {users.find(u => u.id === task.assignedUserId)?.name || task.assignedToName?.split(',')[0]?.trim() || 'Unassigned'}
                  {task.assignedToName?.includes(',') && (
                    <span className="ml-1 px-1 bg-primary/10 text-primary rounded-full font-bold">
                      +{task.assignedToName.split(',').length - 1}
                    </span>
                  )}
                </span>
                {(() => {
                  const user = users.find(u => u.id === task.assignedUserId);
                  return user?.positionCode ? (
                    <span className="shrink-0 px-1 py-0.5 text-[8px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-sm">
                      {user.positionCode}
                    </span>
                  ) : null;
                })()}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
})

