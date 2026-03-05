'use client'

import { useState, useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { useParams, useRouter } from 'next/navigation'
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Link from 'next/link'
import { WorkflowInstance } from '@/types/workflow-schema'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, CheckCircle2, XCircle, Clock, User } from 'lucide-react'
import { format } from 'date-fns'

interface ApprovalStageInstance {
  id: string
  stageName: string
  stageOrder: number
  type?: 'sequential' | 'parallel'
  stageType?: 'sequential' | 'parallel'
  status: 'pending' | 'in_progress' | 'active' | 'approved' | 'rejected' | 'escalated' | 'skipped'
  requiredApprovals?: number
  currentApprovals?: number
  assignedApprovers?: string[]
  approvals?: Array<{
    id: string
    userId: string
    userName?: string
    approvedAt: string
    comments?: string
  }>
  rejections?: Array<{
    id: string
    userId: string
    userName?: string
    rejectedAt: string
    reason: string
  }>
  dueAt?: string
  completedAt?: string
  escalationLevel?: number
}

export default function WorkflowInstanceDetailPage() {
  const { companyId } = useCompany()
  const params = useParams()
  const router = useRouter()
  const instanceId = params.id as string

  const [instance, setInstance] = useState<WorkflowInstance | null>(null)
  const [stages, setStages] = useState<ApprovalStageInstance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId || !instanceId) return

    setLoading(true)

    const unsubs: {
      instance?: () => void
      stages?: () => void
      direct?: () => void
    } = {}

    const bpmnRef = doc(db, `companies/${companyId}/workflowInstances`, instanceId)

    unsubs.instance = onSnapshot(bpmnRef, (snap) => {
      if (snap.exists()) {
        setInstance({ id: snap.id, ...snap.data() } as WorkflowInstance)

        const q = query(
          collection(db, `companies/${companyId}/approvalStageInstances`),
          where('workflowInstanceId', '==', instanceId),
          orderBy('stageOrder', 'asc')
        )

        if (unsubs.stages) unsubs.stages()
        unsubs.stages = onSnapshot(q, (stagesSnap) => {
          setStages(stagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ApprovalStageInstance)))
          setLoading(false)
        })

        if (unsubs.direct) {
          unsubs.direct()
          unsubs.direct = undefined
        }
      } else {
        const directRef = doc(db, `companies/${companyId}/approvalInstances`, instanceId)

        if (unsubs.direct) unsubs.direct()
        unsubs.direct = onSnapshot(directRef, (dirSnap) => {
          if (dirSnap.exists()) {
            const data = dirSnap.data()
            setInstance({ id: dirSnap.id, ...data } as WorkflowInstance)

            const transformedStages = (data.stageInstances || []).map((stage: any) => {
              const approvals: any[] = []
              const rejections: any[] = []
              const pendingApprovers: string[] = []

              const assignedApprovers = stage.assignedApprovers || []
              assignedApprovers.forEach((approver: any) => {
                if (approver.status === 'approved' || approver.decision === 'approved') {
                  approvals.push({
                    id: approver.userId,
                    userId: approver.userId,
                    userName: approver.userName || approver.userId,
                    approvedAt: approver.respondedAt || new Date().toISOString(),
                    comments: approver.comments || ''
                  })
                } else if (approver.status === 'rejected' || approver.decision === 'rejected') {
                  rejections.push({
                    id: approver.userId,
                    userId: approver.userId,
                    userName: approver.userName || approver.userId,
                    rejectedAt: approver.respondedAt || new Date().toISOString(),
                    reason: approver.comments || 'No reason provided'
                  })
                } else if (approver.status === 'pending') {
                  pendingApprovers.push(approver.userName || approver.userId)
                }
              })

              return {
                ...stage,
                type: stage.stageType || stage.type || 'sequential',
                approvals,
                rejections,
                assignedApprovers: pendingApprovers,
                currentApprovals: stage.currentApprovals || approvals.length,
              }
            })

            setStages(transformedStages)
          } else {
            setInstance(null)
            setStages([])
          }
          setLoading(false)
        })

        if (unsubs.stages) {
          unsubs.stages()
          unsubs.stages = undefined
        }
      }
    })

    return () => {
      if (unsubs.instance) unsubs.instance()
      if (unsubs.stages) unsubs.stages()
      if (unsubs.direct) unsubs.direct()
    }
  }, [companyId, instanceId])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      case 'in_progress':
      case 'active':
        return <Badge variant="default" className="bg-blue-600">In Progress</Badge>
      case 'approved':
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>
      case 'escalated':
        return <Badge variant="default" className="bg-yellow-600">Escalated</Badge>
      case 'skipped':
        return <Badge variant="secondary">Skipped</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!instance) {
    return (
      <DashboardLayout>
        <div>
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Approval Instance Not Found</h2>
            <p className="text-muted-foreground mb-4">The requested approval instance could not be found.</p>
            <Button variant="outline" asChild>
              <Link href="/approvals">Back to Approvals</Link>
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const completedStages = stages.filter(s => ['approved', 'rejected', 'skipped'].includes(s.status)).length
  const progress = stages.length > 0 ? Math.round((completedStages / stages.length) * 100) : 0

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">
              {(instance as any).resourceTitle || 'Approval Details'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {(instance as any).approvalLineName || 'Workflow Instance'} - {instanceId.substring(0, 8)}
            </p>
          </div>
          {getStatusBadge(instance.status)}
        </div>

        {/* Summary Card */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{instance.status.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Progress</p>
                <p className="font-medium">{completedStages} of {stages.length} stages</p>
              </div>
              <div>
                <p className="text-muted-foreground">Started</p>
                <p className="font-medium">
                  {instance.startedAt ? format(new Date(instance.startedAt), 'MMM d, yyyy h:mm a') : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Type</p>
                <p className="font-medium">
                  {(instance as any).approvalLineId ? 'Direct Approval' : 'Workflow'}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Completion</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stages */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Approval Stages</CardTitle>
          </CardHeader>
          <CardContent>
            {stages.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No stages found.</p>
            ) : (
              <div className="space-y-4">
                {stages.map((stage, idx) => {
                  const isActive = stage.status === 'in_progress' || stage.status === 'active'
                  const isCompleted = ['approved', 'rejected', 'skipped'].includes(stage.status)

                  return (
                    <div
                      key={stage.id}
                      className={`border rounded-lg p-4 ${isActive ? 'border-primary bg-primary/5' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Stage {stage.stageOrder}</span>
                          <span className="font-medium">{stage.stageName}</span>
                        </div>
                        {getStatusBadge(stage.status)}
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">
                        {(stage.type || stage.stageType) === 'parallel'
                          ? `Requires ${stage.requiredApprovals || 1} approval(s)`
                          : 'Sequential approval'}
                      </p>

                      {/* Approvals */}
                      {(stage.approvals?.length || 0) > 0 && (
                        <div className="space-y-2 mb-3">
                          {stage.approvals?.map((app) => (
                            <div key={app.id} className="flex items-center gap-2 text-sm bg-green-50 dark:bg-green-950/20 p-2 rounded">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="font-medium">{app.userName || app.userId}</span>
                              <span className="text-muted-foreground">approved</span>
                              <span className="text-muted-foreground ml-auto">
                                {format(new Date(app.approvedAt), 'MMM d, h:mm a')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Rejections */}
                      {(stage.rejections?.length || 0) > 0 && (
                        <div className="space-y-2 mb-3">
                          {stage.rejections?.map((rej) => (
                            <div key={rej.id} className="text-sm bg-red-50 dark:bg-red-950/20 p-2 rounded">
                              <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-red-600" />
                                <span className="font-medium">{rej.userName || rej.userId}</span>
                                <span className="text-muted-foreground">rejected</span>
                                <span className="text-muted-foreground ml-auto">
                                  {format(new Date(rej.rejectedAt), 'MMM d, h:mm a')}
                                </span>
                              </div>
                              {rej.reason && (
                                <p className="mt-1 text-red-700 dark:text-red-400 pl-6">{rej.reason}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Pending Approvers */}
                      {isActive && (stage.assignedApprovers?.length || 0) > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Waiting for:</span>
                          <div className="flex gap-1 flex-wrap">
                            {stage.assignedApprovers?.map((name, i) => (
                              <span key={i} className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs">
                                <User className="h-3 w-3" />
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resource Link */}
        {(instance as any).resourceId && (
          <div className="mt-6 text-center">
            <Button variant="outline" asChild>
              <Link href={`/projects/${(instance as any).context?.projectId || 'all'}/tasks/${(instance as any).resourceId}`}>
                View Original Task
              </Link>
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
