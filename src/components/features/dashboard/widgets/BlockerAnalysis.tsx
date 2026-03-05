import React from 'react'
import { BlockerInfo } from '@/lib/services/dashboard/analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface BlockerAnalysisProps {
  blockers: BlockerInfo[]
  totalActiveTasks: number
  onTaskClick?: (taskId: string) => void
  /** When set (e.g. autocracy), task ID is hidden */
  companyId?: string | null
  /** Company domain when company ID is Firestore auto-id */
  companyDomain?: string | null
}

export function BlockerAnalysis({ blockers, totalActiveTasks, onTaskClick, companyId, companyDomain }: BlockerAnalysisProps) {
  const totalBlocked = blockers.length
  const hideTaskId = (companyId != null && companyId.toLowerCase().includes('autocracy')) ||
    (companyDomain != null && companyDomain.toLowerCase().includes('autocracy'))

  // Calculate percentage for Chart (clamped 0-100)
  const percentage = totalActiveTasks > 0
    ? Math.min(100, Math.round((totalBlocked / totalActiveTasks) * 100))
    : 0

  // CSS Conic Gradient for Donut Chart - Using native system red color
  const chartStyle = {
    background: `conic-gradient(#dc2626 ${percentage}%, #e5e7eb ${percentage}% 100%)`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Blocker Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6 mb-6">
          {/* Donut Chart */}
          <div className="relative w-24 h-24 rounded-full flex items-center justify-center" style={chartStyle}>
            {/* Inner Circle to make it a donut */}
            <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center z-10">
              <span className="text-2xl font-bold text-foreground">{percentage}%</span>
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Blocked Tasks</p>
            <p className="text-2xl font-bold text-foreground">{totalBlocked} / {totalActiveTasks}</p>
          </div>
        </div>

        <div className="max-h-48 overflow-y-auto">
          {blockers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No active blockers.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium text-foreground">Task</th>
                  <th className="text-right py-2 font-medium text-foreground">Reason</th>
                </tr>
              </thead>
              <tbody>
                {blockers.slice(0, 5).map(b => (
                  <tr
                    key={b.taskId}
                    className="border-b last:border-0 hover:bg-blue-50/50 cursor-pointer transition-colors group"
                    onClick={() => onTaskClick?.(b.taskId)}
                  >
                    <td className="py-2 truncate max-w-[150px] text-foreground" title={b.taskTitle}>
                      {!hideTaskId && b.projectCode && b.taskNumber && (
                        <span className="text-blue-600 font-bold mr-2 font-mono text-xs">
                          {b.projectCode}-{b.taskNumber}
                        </span>
                      )}
                      <span className="group-hover:text-blue-600 transition-colors">
                        {b.taskTitle}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span className="text-xs font-medium text-red-600 dark:text-red-400">
                        {b.blockerDetails}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

