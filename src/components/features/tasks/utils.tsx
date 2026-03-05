'use client'

import {
  CheckCircle,
  Clock,
  Play,
  XCircle,
  ClipboardCheck
} from 'lucide-react'
import type { GeneratedTask } from '@/types/task-template-schema'
import { getStatusColors } from '@/lib/utils/task-status-colors'

import { formatDate, getUTCNormalizedDate, formatFriendlyDate, formatFriendlyDateOnly } from '@/lib/utils/date-utils'

export { formatDate, formatFriendlyDate, formatFriendlyDateOnly }

export function getPriorityColor(priority: GeneratedTask['priority']) {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

export function getStatusColor(status: GeneratedTask['status']) {
  const colors = getStatusColors(status)
  // Return badge format matching Timeline view: bg-{color}-100 text-{color}-700 border-{color}-200
  // Use barBg and barText from shared utility, but adjust text color to match Timeline (700 instead of 800)
  const textMatch = colors.barText.match(/text-(\w+)-\d+/)
  if (!textMatch) return 'bg-gray-100 text-gray-700 border-gray-200'

  const colorName = textMatch[1]
  // Timeline uses text-{color}-700, not text-{color}-800
  const textColor = colors.barText.replace(/text-\w+-\d+/, `text-${colorName}-700`)
  return `${colors.barBg} ${textColor} border-${colorName}-200`
}

export function isOverdue(task: GeneratedTask) {
  if (!task.dueDate) return false
  const dueDate = getUTCNormalizedDate(task.dueDate)
  if (!dueDate || isNaN(dueDate.getTime())) return false

  const now = new Date()
  return dueDate < now && task.status !== 'completed'
}

export function getStatusIcon(status: GeneratedTask['status']) {
  switch (status) {
    case 'assigned':
      return <Clock className="h-4 w-4 text-blue-500" />
    case 'in_progress':
      return <Play className="h-4 w-4 text-yellow-500" />
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'cancelled':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'approval_required':
      return <ClipboardCheck className="h-4 w-4 text-indigo-500" />
    default:
      return <Clock className="h-4 w-4 text-gray-500" />
  }
}

