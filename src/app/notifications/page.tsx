'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Bell, Settings, Volume2, VolumeX, CheckCircle2, Trash2, Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useNotifications } from '@/contexts/NotificationContext'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'react-hot-toast'

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'task_assigned':
    case 'task_due_soon':
    case 'task_overdue':
    case 'task_completed':
    case 'task_updated':
      return '📋'
    case 'approval_required':
    case 'approval_approved':
    case 'approval_rejected':
      return '✅'
    case 'project_created':
    case 'project_updated':
    case 'project_milestone':
      return '📁'
    case 'quality_alert':
      return '⚠️'
    default:
      return '🔔'
  }
}

const getNotificationColor = (priority: string, isRead: boolean) => {
  if (isRead) {
    return 'bg-gray-50 border-gray-200'
  }

  switch (priority) {
    case 'urgent':
      return 'bg-red-50 border-red-200'
    case 'high':
      return 'bg-orange-50 border-orange-200'
    case 'medium':
      return 'bg-blue-50 border-blue-200'
    default:
      return 'bg-gray-50 border-gray-200'
  }
}

import { useRouter } from 'next/navigation'

export default function NotificationsPage() {
  const router = useRouter()
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications()

  const handleMarkAsRead = async (notificationId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await markAsRead(notificationId)
      toast.success('Notification marked as read')
    } catch (error) {
      toast.error('Failed to mark notification as read')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead()
      toast.success('All notifications marked as read')
    } catch (error) {
      toast.error('Failed to mark all as read')
    }
  }

  const handleDelete = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteNotification(notificationId)
      toast.success('Notification deleted')
    } catch (error) {
      toast.error('Failed to delete notification')
    }
  }

  const handleNotificationClick = (notification: any) => {
    console.log('[NotificationPage] Clicked notification:', notification);

    // Helper to extract path from URL (handles both absolute and relative URLs)
    const extractPath = (url: string | undefined | null): string | null => {
      if (!url) return null;
      try {
        // If it's an absolute URL, extract just the pathname + search
        if (url.startsWith('http://') || url.startsWith('https://')) {
          const urlObj = new URL(url);
          return urlObj.pathname + urlObj.search;
        }
        // Already a relative path
        return url;
      } catch {
        return url;
      }
    };

    let targetUrl: string | null = extractPath(notification.actionUrl);

    // For approval_required notifications, navigate to the Approvals tab
    if (notification.type === 'approval_required') {
      targetUrl = '/my-tasks?tab=approvals';
    }
    // For approval_rejected notifications, navigate to the specific task
    else if (notification.type === 'approval_rejected') {
      // Use actionUrl if available, otherwise construct from taskId/projectId
      if (!targetUrl) {
        const taskId = notification.taskId || notification.metadata?.taskId;
        const projectId = notification.projectId || notification.metadata?.projectId;
        if (projectId && taskId) {
          targetUrl = `/projects/${projectId}/tasks/${taskId}`;
        } else if (taskId) {
          targetUrl = `/my-tasks?task=${taskId}`;
        }
      }
    }
    // Default fallback for other notification types
    else if (!targetUrl) {
      const taskId = notification.taskId || notification.metadata?.taskId;
      const projectId = notification.projectId || notification.metadata?.projectId;
      if (projectId && taskId) {
        targetUrl = `/projects/${projectId}/tasks/${taskId}`;
      } else if (taskId) {
        targetUrl = `/my-tasks?task=${taskId}`;
      }
    }

    console.log('[NotificationPage] Navigating to:', targetUrl);
    if (targetUrl) {
      router.push(targetUrl);
    } else {
      toast.error('Cannot open task: Link is missing');
    }
  }

  return (
    <DashboardLayout contentClassName="h-full overflow-hidden">
      <div className="h-full w-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
            <p className="text-gray-600">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
            </p>
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark All Read
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notification Settings (Left Sidebar) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bell className="w-5 h-5 text-blue-600" />
                    <span>Task Assignments</span>
                  </div>
                  <Button variant="outline" size="sm">
                    <Volume2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bell className="w-5 h-5 text-green-600" />
                    <span>Project Updates</span>
                  </div>
                  <Button variant="outline" size="sm">
                    <Volume2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bell className="w-5 h-5 text-yellow-600" />
                    <span>Quality Alerts</span>
                  </div>
                  <Button variant="outline" size="sm">
                    <VolumeX className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Recent Notifications ({notifications.length})
                </h3>
              </div>

              {isLoading && (
                <div className="p-12 text-center">
                  <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-gray-400" />
                  <p className="text-gray-600">Loading notifications...</p>
                </div>
              )}

              {error && (
                <div className="p-6 text-center">
                  <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
                  <p className="text-red-600">{error}</p>
                </div>
              )}

              {!isLoading && !error && notifications.length === 0 && (
                <div className="p-12 text-center">
                  <Bell className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600 mb-2">No notifications yet</p>
                </div>
              )}

              {!isLoading && !error && notifications.length > 0 && (
                <div className="divide-y divide-gray-200">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 hover:bg-gray-50 transition-colors border-l-4 cursor-pointer ${getNotificationColor(notification.priority, notification.isRead)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">{getNotificationIcon(notification.type)}</span>
                            <h4 className={`font-medium ${notification.isRead ? 'text-gray-600' : 'text-gray-900'}`}>
                              {notification.title}
                            </h4>
                            {!notification.isRead && (
                              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>
                              {notification.createdAt
                                ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })
                                : 'Recently'}
                            </span>
                            {notification.priority && (
                              <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                                {notification.priority}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleMarkAsRead(notification.id, e)}
                              title="Mark as read"
                            >
                              <CheckCircle2 className="w-4 h-4 text-gray-400" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDelete(notification.id, e)}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-gray-400" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
