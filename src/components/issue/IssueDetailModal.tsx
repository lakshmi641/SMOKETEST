'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Pencil,
  X,
  Link as LinkIcon,
  Paperclip,
  MessageSquare,
  Clock,
  User,
  Calendar,
  Flag,
  CheckCircle,
  AlertCircle,
  FileText,
  Play,
  Pause
} from 'lucide-react'
import type { GeneratedTask } from '@/types/task-template-schema'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/lib/utils/date-utils'

interface IssueDetailModalProps {
  task: GeneratedTask | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: (task: GeneratedTask) => Promise<void>
  users?: Array<{ id: string; name: string }>
  /** When set (e.g. autocracy), task ID badge is hidden */
  companyId?: string | null
}

export function IssueDetailModal({
  task,
  open,
  onOpenChange,
  onUpdate,
  users = [],
  companyId
}: IssueDetailModalProps) {
  const { user: currentUser } = useAuthStore()
  const hideTaskId = companyId != null && companyId.toLowerCase().includes('autocracy')
  const [isEditing, setIsEditing] = useState(false)
  const [editedTask, setEditedTask] = useState<GeneratedTask | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('details')

  useEffect(() => {
    if (task) {
      setEditedTask({ ...task })
      setIsEditing(false)
    }
  }, [task])

  if (!task || !editedTask) return null

  const handleSave = async () => {
    if (onUpdate && editedTask) {
      try {
        setIsSaving(true)
        await onUpdate(editedTask)
        setIsEditing(false)
      } catch (error) {
        console.error('Error updating task:', error)
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleCancel = () => {
    setEditedTask(task ? { ...task } : null)
    setIsEditing(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-slate-100 text-slate-700 border-slate-300'
      case 'assigned':
        return 'bg-blue-100 text-blue-700 border-blue-300'
      case 'in_progress':
        return 'bg-sky-100 text-sky-700 border-sky-300'
      case 'on_hold':
        return 'bg-amber-100 text-amber-700 border-amber-300'
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-300'
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-300'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive'
      case 'high':
        return 'default'
      case 'medium':
        return 'secondary'
      case 'low':
        return 'outline'
      default:
        return 'outline'
    }
  }

  // Removed local formatDate to use centralized utility from date-utils

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId)
    return user?.name || userId
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-7xl h-[92vh] lg:h-[90vh] p-0 flex flex-col overflow-hidden shadow-2xl border-muted/20">
        <DialogTitle className="sr-only">
          {task?.title || 'Task Details'}
        </DialogTitle>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white/80 backdrop-blur-md sticky top-0 z-10 flex-shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {!hideTaskId && (
              <Badge variant="outline" className="font-mono text-[10px] bg-secondary/50 text-muted-foreground border-muted shadow-sm px-2 py-0.5">
                TASK-{task.id.slice(0, 8).toUpperCase()}
              </Badge>
            )}
            {isEditing ? (
              <Input
                value={editedTask.title}
                onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                className="text-lg font-bold flex-1 bg-transparent border-none focus-visible:ring-1 focus-visible:ring-blue-500/30"
                placeholder="Task title..."
              />
            ) : (
              <h2 className="text-lg font-bold truncate text-foreground/90 tracking-tight">{task.title}</h2>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            {isEditing ? (
              <>
                <Button variant="default" size="sm" onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 shadow-sm transition-all duration-200">
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancel} className="text-muted-foreground">
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="text-muted-foreground hover:text-blue-600 hover:bg-blue-50/50">
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className="hidden md:flex text-muted-foreground hover:text-blue-600 hover:bg-blue-50/50">
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Link
                </Button>
                <Button variant="ghost" size="sm" className="hidden md:flex text-muted-foreground hover:text-blue-600 hover:bg-blue-50/50">
                  <Paperclip className="h-4 w-4 mr-2" />
                  Attach
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full hover:bg-red-50 hover:text-red-500 transition-colors">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden flex-col md:flex-row bg-background">
          {/* Left Side - Main Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-ultrathin">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="details">
                  <FileText className="h-4 w-4 mr-2" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="comments">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Comments
                </TabsTrigger>
                <TabsTrigger value="activity">
                  <Clock className="h-4 w-4 mr-2" />
                  Activity
                </TabsTrigger>
                <TabsTrigger value="quality">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Quality
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6 mt-0">
                {/* Description */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">Description</h3>
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={editedTask.description || ''}
                      onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                      className="min-h-[200px] font-normal"
                      placeholder="Add a description..."
                    />
                  ) : (
                    <div className="text-sm text-gray-600 whitespace-pre-wrap min-h-[100px] p-4 bg-gray-50 rounded-md border">
                      {task.description || 'No description provided.'}
                    </div>
                  )}
                </div>

                {/* Task Progress */}
                {task.progress !== undefined && task.progress > 0 && (
                  <div className="border-t pt-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Progress</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Estimated Hours:</span>
                        <p className="font-medium mt-1">{task.estimatedHours}h</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Progress:</span>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium">{task.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Subtasks / Checklist */}
                <div className="border-t pt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Checklist</h3>
                  <div className="text-sm text-gray-500">
                    No checklist items
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="comments" className="mt-0">
                <div className="space-y-4">
                  {/* Comment Input */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-medium">
                      {currentUser?.name?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1">
                      <Textarea
                        placeholder="Add a comment..."
                        className="min-h-[100px] mb-2"
                      />
                      <div className="flex gap-2">
                        <Button size="sm">Comment</Button>
                        <Button size="sm" variant="ghost">Cancel</Button>
                      </div>
                    </div>
                  </div>

                  {/* Comments List */}
                  <div className="border-t pt-4">
                    <div className="text-center text-sm text-gray-500 py-8">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p>No comments yet</p>
                      <p className="text-xs mt-1">Be the first to comment!</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="mt-0">
                <div className="space-y-4">
                  {/* Activity Timeline */}
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Play className="h-3 w-3 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{task.reporterName || 'User'}</span>{' '}
                          created task{task.assignedToName ? ` and assigned to ${task.assignedToName}` : ''}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(task.createdAt || new Date().toISOString())}
                        </p>
                      </div>
                    </div>

                    {task.status !== 'assigned' && (
                      <div className="flex gap-3">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Play className="h-3 w-3 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className="font-medium">{getUserName(task.assignedUserId)}</span> started working on this task
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Recently</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="quality" className="mt-0">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900">Quality Checkpoints</h3>
                  <div className="text-center text-sm text-gray-500 py-8">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No quality checkpoints defined</p>
                    <p className="text-xs mt-1">Add quality checks to ensure standards</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Side - Metadata */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l bg-gray-50/50 p-6 overflow-y-auto scrollbar-ultrathin">
            <div className="space-y-6">
              {/* Status */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                  Status
                </label>
                {isEditing ? (
                  <Select
                    value={editedTask.status}
                    onValueChange={(value) => setEditedTask({ ...editedTask, status: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={getStatusColor(task.status)}>
                    {task.status.replace('_', ' ')}
                  </Badge>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                  Priority
                </label>
                {isEditing ? (
                  <Select
                    value={editedTask.priority}
                    onValueChange={(value) => setEditedTask({ ...editedTask, priority: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={getPriorityColor(task.priority)}>
                    {task.priority}
                  </Badge>
                )}
              </div>

              {/* Assignee */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                  Assignee
                </label>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                    {getUserName(task.assignedUserId).charAt(0)}
                  </div>
                  <span className="text-sm">{getUserName(task.assignedUserId)}</span>
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                  Due Date
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span>{formatDate(task.dueDate)}</span>
                </div>
                {new Date(task.dueDate) < new Date() && task.status !== 'completed' && (
                  <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    <span>Overdue</span>
                  </div>
                )}
              </div>

              {/* Time Tracking */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                  Time Tracking
                </label>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estimated:</span>
                    <span className="font-medium">{task.estimatedHours}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Logged:</span>
                    <span className="font-medium">0h</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '0%' }} />
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    <Clock className="h-3 w-3 mr-2" />
                    Log Time
                  </Button>
                </div>
              </div>

              {/* Created */}
              <div className="border-t pt-4">
                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                  Created
                </label>
                <p className="text-sm">{formatDate(task.createdAt || new Date().toISOString())}</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

