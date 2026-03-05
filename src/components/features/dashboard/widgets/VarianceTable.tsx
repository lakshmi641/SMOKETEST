import * as React from 'react'
import { VarianceMetric } from '@/lib/services/dashboard/analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'

interface VarianceTableProps {
  variances: VarianceMetric[]
  /** When set (e.g. autocracy), task ID is hidden */
  companyId?: string | null
  /** Company domain when company ID is Firestore auto-id */
  companyDomain?: string | null
}

export function VarianceTable({ variances, companyId, companyDomain }: VarianceTableProps) {
  const router = useRouter()
  const criticalVariances = variances.filter(v => v.varianceDays > 0).slice(0, 5)
  const hideTaskId = (companyId != null && companyId.toLowerCase().includes('autocracy')) ||
    (companyDomain != null && companyDomain.toLowerCase().includes('autocracy'))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Schedule Variance</CardTitle>
      </CardHeader>
      <CardContent>
        {criticalVariances.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Everything is on schedule.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 font-medium text-foreground">Task</th>
                  <th className="py-2 text-right font-medium text-foreground">Delay</th>
                </tr>
              </thead>
              <tbody>
                {criticalVariances.map((v) => (
                  <tr
                    key={v.taskId}
                    className="border-b last:border-0 hover:bg-blue-50/50 cursor-pointer transition-colors group"
                    onClick={() => router.push(`/projects/${v.projectId}/tasks/${v.taskId}`)}
                  >
                    <td className="py-2 text-foreground truncate max-w-[150px] group-hover:text-blue-600 transition-colors font-medium">
                      {!hideTaskId && v.projectCode && v.taskNumber && (
                        <span className="text-blue-600 font-bold mr-2 font-mono text-xs">
                          {v.projectCode}-{v.taskNumber}
                        </span>
                      )}
                      {v.title}
                    </td>
                    <td className="py-2 text-right">
                      <Badge variant="destructive" className="text-xs">
                        {`+${v.varianceDays}d`}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

