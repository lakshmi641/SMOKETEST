'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Clock, Calendar, CheckSquare, Eye, Play, Edit, Trash2, CheckCircle } from 'lucide-react'
import type { GeneratedTask } from '@/types/task-template-schema'
import { formatDate, getPriorityColor, getStatusColor, isOverdue, getStatusIcon } from './utils'
import { StarButton } from '@/components/ui/star-button'
import { useStarredItems } from '@/hooks/useStarredItems'

interface TaskListViewProps {
  tasks: GeneratedTask[]
  statusOptions: Array<{ code: string; name: string; color?: string; isSystem?: boolean }>
  statusLoading?: boolean
  assignedStatusCode: string
  inProgressStatusCode: string
  onStatusChange: (taskId: string, status: GeneratedTask['status']) => void
  onStartTask: (taskId: string) => void
  onUpdateProgress: (task: GeneratedTask) => void
  onViewTask: (task: GeneratedTask) => void
  onEditTask: (task: GeneratedTask) => void
  onDeleteTask?: (task: GeneratedTask) => void
  users?: Array<{ id: string; name: string; avatar: string | null; positionCode?: string }>
  currentUserId?: string
  /** When set (e.g. autocracy), task ID badge is hidden */
  companyId?: string | null
}

export function TaskListView({
  tasks,
  statusOptions = [],
  statusLoading = false,
  assignedStatusCode,
  inProgressStatusCode,
  onStatusChange,
  onStartTask,
  onUpdateProgress,
  onViewTask,
  onEditTask,
  onDeleteTask,
  users = [],
  companyId,
  currentUserId
}: TaskListViewProps) {
  const { isStarred, toggleStarred } = useStarredItems()
  const hideTaskId = companyId != null && companyId.toLowerCase().includes('autocracy')
  const options = Array.isArray(statusOptions) ? statusOptions : []

  return (
    <div className="space-y-4">
      {tasks.map((task, index) => {
        const statusMeta = options.find(option => option.code === task.status)
        const statusName = statusMeta?.name ?? task.status.replace('_', ' ')
        const isCreator = task.reporter === currentUserId

        return (
          <Card key={task.id || `task-${index}`} className={`clickable-card border ${isOverdue(task) ? 'border-red-200 bg-red-50' : ''}`}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* ... existing content ... */}
                  {/* Task Header with Project ID (hidden for autocracy tenant) */}
                  <div className="flex items-center gap-3 mb-2">
                    {/* Project ID Badge (if available) - Clickable */}
                    {!hideTaskId && task.projectCode && task.taskNumber !== undefined && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          // Navigate to task detail
                          if (task.projectId && task.id) {
                            window.location.href = `/projects/${task.projectId}/tasks/${task.id}`
                          }
                        }}
                        className="text-xs font-mono font-medium text-blue-600 hover:text-blue-800 hover:underline px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-colors"
                        title="Click to view task details"
                      >
                        {task.projectCode}-{task.taskNumber}
                      </button>
                    )}

                    {getStatusIcon(task.status)}
                    <StarButton
                      isStarred={isStarred('task', task.id || '')}
                      onToggle={() => task.id && toggleStarred('task', task.id)}
                      size="sm"
                    />
                    {task.metadata?.isRecurring && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] h-4 px-1.5 uppercase font-bold shrink-0">
                        Rec
                      </Badge>
                    )}
                    <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                    {isOverdue(task) && (
                      <Badge variant="destructive" className="text-xs">
                        Overdue
                      </Badge>
                    )}
                  </div>

                  <p className="text-gray-600 mb-3">{task.description}</p>

                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Due: {formatDate(task.dueDate)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {task.estimatedHours}h estimated
                    </div>
                    {task.actualHours && (
                      <div className="flex items-center gap-1">
                        <CheckSquare className="h-4 w-4" />
                        {task.actualHours}h actual
                      </div>
                    )}
                    {task.assignedUserId && (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">assigned to</span>
                        <span className="font-medium text-gray-700">
                          {task.assignedToName || users.find(u => u.id === task.assignedUserId)?.name || 'Unassigned'}
                        </span>
                        {(() => {
                          const user = users.find(u => u.id === task.assignedUserId);
                          return user?.positionCode ? (
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-1 rounded ml-1">
                              {user.positionCode}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    )}
                    {task.reporter && (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">by</span>
                        <span className="font-medium text-gray-700">
                          {users.find(u => u.id === task.reporter)?.name || task.reporter}
                        </span>
                        {(() => {
                          const user = users.find(u => u.id === task.reporter);
                          return user?.positionCode ? (
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-1 rounded ml-1">
                              {user.positionCode}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Actual Dates Display */}
                  {(task.actualStartDate || task.actualEndDate) && (
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3 border-t pt-2">
                      {task.actualStartDate && (
                        <div className="flex items-center gap-1">
                          <Play className="h-4 w-4 text-blue-500" />
                          <span>Started: {formatDate(task.actualStartDate)}</span>
                        </div>
                      )}
                      {task.actualEndDate && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Completed: {formatDate(task.actualEndDate)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={getPriorityColor(task.priority)}>
                      {task.priority}
                    </Badge>
                    <Badge className={getStatusColor(task.status)}>
                      {statusName}
                    </Badge>
                  </div>

                  {task.progress > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Progress</span>
                        <span className="text-gray-900 font-medium">{task.progress}%</span>
                      </div>
                      <Progress value={task.progress} className="h-2" />
                    </div>
                  )}

                  {task.definitionOfDone && task.definitionOfDone.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Definition of Done:</p>
                      <div className="space-y-1">
                        {task.definitionOfDone.map((item, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${item.isCompleted ? 'bg-green-100 border-green-300' : 'bg-gray-100 border-gray-300'
                              }`}>
                              {item.isCompleted && <CheckSquare className="h-3 w-3 text-green-600" />}
                            </div>
                            <span className={item.isCompleted ? 'text-gray-500 line-through' : 'text-gray-700'}>
                              {item.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={task.status}
                    onValueChange={(value) => task.id && onStatusChange(task.id, value as GeneratedTask['status'])}
                    disabled={statusLoading || task.status === assignedStatusCode}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map(option => (
                        <SelectItem key={option.code} value={option.code}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {task.status === assignedStatusCode && task.id && (
                    <Button
                      size="sm"
                      onClick={() => onStartTask(task.id!)}
                    >
                      Start Task
                    </Button>
                  )}
                  {task.status === inProgressStatusCode && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdateProgress(task)}
                      disabled={!isCreator}
                    >
                      Update Progress
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onViewTask(task)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEditTask(task)}
                    disabled={!isCreator}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {onDeleteTask && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => onDeleteTask(task)}
                      disabled={!isCreator}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

