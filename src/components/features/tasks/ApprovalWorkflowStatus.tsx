import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    ShieldCheck,
    Clock,
    CheckCircle2,
    XCircle,
    User,
    MessageSquare,
    AlertTriangle,
    ChevronRight
} from 'lucide-react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'
import type { ApprovalInstance, ApprovalStageInstance } from '@/types/approval-line-schema'
import { TaskApprovalService } from '@/lib/services/tasks/task-approval-service'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { formatDate } from './utils'
import { useCompany } from '@/contexts/CompanyContext'

interface ApprovalWorkflowStatusProps {
    companyId: string
    instanceId: string
    onDecisionSubmitted?: () => void
}

export function ApprovalWorkflowStatus({ companyId, instanceId, onDecisionSubmitted }: ApprovalWorkflowStatusProps) {
    const { user } = useAuthStore()
    const { groupId } = useCompany()
    const [instance, setInstance] = useState<ApprovalInstance | null>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState<string | null>(null)
    const [comments, setComments] = useState('')

    useEffect(() => {
        if (!companyId || !instanceId) return

        const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'approvalInstances')
        const instanceRef = doc(db, segments[0], ...segments.slice(1), instanceId)

        const unsub = onSnapshot(
            instanceRef,
            (doc) => {
                if (doc.exists()) {
                    setInstance({ id: doc.id, ...doc.data() } as ApprovalInstance)
                }
                setLoading(false)
            },
            (error) => {
                console.error('Error fetching approval instance:', error)
                setLoading(false)
            }
        )

        return () => unsub()
    }, [companyId, instanceId, groupId])

    const handleSubmit = async (decision: 'approved' | 'rejected') => {
        if (!user || !instance) return

        try {
            setSubmitting(decision)
            await TaskApprovalService.submitDecision(
                companyId,
                instanceId,
                user.id,
                decision,
                comments,
                groupId || undefined
            )
            toast.success(`Task ${decision} successfully`)
            setComments('')
            onDecisionSubmitted?.()
        } catch (error) {
            console.error('Error submitting decision:', error)
            toast.error('Failed to submit decision')
        } finally {
            setSubmitting(null)
        }
    }

    if (loading) return <div className="animate-pulse space-y-4">
        <div className="h-20 bg-muted rounded-lg" />
        <div className="h-40 bg-muted rounded-lg" />
    </div>

    if (!instance) return (
        <div className="p-8 text-center border-2 border-dashed rounded-xl">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
            <p className="text-muted-foreground">Approval instance not found or has been removed.</p>
        </div>
    )

    const activeStage = instance.stageInstances.find(s => s.status === 'active')
    const isPendingMyApproval = activeStage?.assignedApprovers.some(a => a.userId === user?.id && a.status === 'pending')

    return (
        <div className="space-y-6">
            {/* Header Summary */}
            <Card className={cn(
                "border-none shadow-md overflow-hidden",
                instance.status === 'approved' ? "bg-green-50/50 dark:bg-green-950/10" :
                    instance.status === 'rejected' ? "bg-red-50/50 dark:bg-red-950/10" :
                        "bg-blue-50/50 dark:bg-blue-950/10"
            )}>
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center shadow-inner",
                                instance.status === 'approved' ? "bg-green-100 dark:bg-green-900/30 text-green-600" :
                                    instance.status === 'rejected' ? "bg-red-100 dark:bg-red-900/30 text-red-600" :
                                        "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                            )}>
                                {instance.status === 'approved' && <CheckCircle2 className="w-6 h-6" />}
                                {instance.status === 'rejected' && <XCircle className="w-6 h-6" />}
                                {instance.status === 'in_progress' && <Clock className="w-6 h-6" />}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold capitalize">Approval {instance.status.replace('_', ' ')}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {instance.approvalLineName} • v{instance.approvalLineVersion}
                                </p>
                            </div>
                        </div>
                        <Badge className={cn("px-3 py-1 text-xs font-bold uppercase tracking-wider",
                            instance.status === 'approved' ? "bg-green-500 hover:bg-green-600 text-white" :
                                instance.status === 'rejected' ? "bg-red-500 hover:bg-red-600 text-white" :
                                    "bg-blue-500 hover:bg-blue-600 text-white"
                        )}>
                            {instance.status}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Actionable Area */}
            {isPendingMyApproval && instance.status === 'in_progress' && (
                <Card className="border-2 border-primary shadow-lg ring-4 ring-primary/5">
                    <CardHeader className="pb-3 text-center lg:text-left">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                            Action Required: Your Approval Needed
                        </CardTitle>
                        <CardDescription>
                            Please review the task details and provide your decision.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase">Comments (Optional)</label>
                            <textarea
                                className="w-full min-h-[100px] p-3 rounded-lg border bg-muted/30 focus:ring-2 focus:ring-primary outline-none transition-all"
                                placeholder="Details about your decision..."
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                                onClick={() => handleSubmit('approved')}
                                disabled={!!submitting}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold h-11"
                            >
                                {submitting === 'approved' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
                                Approve Task
                            </Button>
                            <Button
                                onClick={() => handleSubmit('rejected')}
                                disabled={!!submitting}
                                variant="destructive"
                                className="flex-1 font-bold h-11"
                            >
                                {submitting === 'rejected' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                                Reject Task
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Workflow Timeline */}
            <Card className="border-none shadow-sm bg-slate-50/50 dark:bg-slate-900/50">
                <CardHeader>
                    <CardTitle className="text-md flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        Workflow Timeline
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {instance.stageInstances.map((stage, idx) => (
                            <div key={stage.id} className={cn(
                                "p-4 transition-colors",
                                stage.status === 'active' ? "bg-white dark:bg-slate-900 border-l-4 border-primary" : "opacity-80"
                            )}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                                            stage.status === 'approved' ? "bg-green-100 text-green-700" :
                                                stage.status === 'active' ? "bg-primary text-white shadow-md shadow-primary/20" :
                                                    stage.status === 'rejected' ? "bg-red-100 text-red-700" :
                                                        "bg-slate-100 text-slate-500"
                                        )}>
                                            {stage.status === 'approved' ? <CheckCircle2 className="w-4 h-4" /> : stage.stageOrder}
                                        </div>
                                        <div>
                                            <span className="font-bold text-sm block">{stage.stageName}</span>
                                            <span className="text-[11px] text-muted-foreground">
                                                {stage.stageType === 'parallel' ? 'All must approve' : 'First to respond'}
                                            </span>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className={cn(
                                        "text-[10px] uppercase font-bold tracking-tighter h-5",
                                        stage.status === 'active' && "animate-pulse border-primary text-primary"
                                    )}>
                                        {stage.status}
                                    </Badge>
                                </div>

                                {/* Approvers List in Stage */}
                                <div className="space-y-3 pl-11">
                                    {stage.assignedApprovers.map((approver) => (
                                        <div key={approver.userId} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-muted rounded-full group-hover:bg-primary/10 transition-colors">
                                                    <User className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                                </div>
                                                <div className="text-xs">
                                                    <span className="font-semibold">{approver.userName}</span>
                                                    <span className="text-muted-foreground ml-1">({approver.positionTitle || 'Approver'})</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {approver.status !== 'pending' && (
                                                    <div className="flex flex-col items-end">
                                                        <Badge variant="secondary" className={cn(
                                                            "text-[9px] h-4",
                                                            approver.status === 'approved' ? "text-green-600" : "text-red-600"
                                                        )}>
                                                            {approver.status.toUpperCase()}
                                                        </Badge>
                                                        {approver.respondedAt && (
                                                            <span className="text-[9px] text-muted-foreground mt-0.5">
                                                                {formatDate(approver.respondedAt)}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {approver.status === 'pending' && stage.status === 'active' && (
                                                    <Badge variant="outline" className="text-[9px] h-4 text-blue-500 border-blue-200">WAITING</Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Stage Comments */}
                                    {stage.decisionReason && (
                                        <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-dashed text-xs italic text-muted-foreground flex gap-2">
                                            <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                            {stage.decisionReason}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function Loader2({ className }: { className?: string }) {
    return <Loader2Icon className={cn("animate-spin", className)} />
}

import { Loader2 as Loader2Icon } from 'lucide-react'
