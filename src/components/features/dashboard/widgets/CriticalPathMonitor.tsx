import React from 'react'
import type { GeneratedTask } from '@/types/task-template-schema'
import { formatDate } from '@/lib/utils/date-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle } from 'lucide-react'

interface CriticalPathMonitorProps {
  criticalTasks: GeneratedTask[]
}

export function CriticalPathMonitor({ criticalTasks }: CriticalPathMonitorProps) {
  const incompleteCritical = criticalTasks.filter(t => t.status !== 'completed')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Critical Path Monitor</CardTitle>
      </CardHeader>
      <CardContent>
        {incompleteCritical.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No critical tasks pending</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              {incompleteCritical.length} task{incompleteCritical.length !== 1 ? 's' : ''} on critical path
            </p>
            <div className="space-y-2">
              {incompleteCritical.slice(0, 10).map(task => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-md border-l-4 border-red-500 bg-red-50 dark:bg-red-900/10"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-foreground truncate">{task.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
                    </div>
                  </div>
                  <div className="ml-4">
                    <Badge variant="outline" className="text-xs">
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

