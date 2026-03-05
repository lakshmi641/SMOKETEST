'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Clock, CheckCircle2, ListFilter, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { toast } from 'react-hot-toast'

import { useCompany } from '@/contexts/CompanyContext'
import { db } from '@/lib/firebase'
import { collection, addDoc } from 'firebase/firestore'
import { Loader2 } from 'lucide-react'

interface ProjectDetailViewProps {
    projectId: string
    data: any // OrgHierarchyNode for this project
}

export function ProjectDetailView({ projectId, data }: ProjectDetailViewProps) {
    const { companyId } = useCompany()
    const [isNotifying, setIsNotifying] = React.useState(false)

    if (!data) return null

    const managerName = data.metadata?.managerName || 'Manager'
    const managerId = data.metadata?.managerId

    const handleNotifyManager = async () => {
        if (!companyId || !managerId) {
            toast.error('Unable to identify project manager')
            return
        }

        setIsNotifying(true)
        try {
            const notifRef = collection(db, 'companies', companyId, 'notifications')
            await addDoc(notifRef, {
                userId: managerId,
                companyId: companyId,
                type: 'project_updated',
                title: 'CEO Dashboard Nudge',
                message: `The CEO has requested an update on project "${data.name}". High attention required.`,
                priority: 'high',
                isRead: false,
                actionRequired: true,
                actionUrl: `/projects/${projectId}`,
                projectId: projectId,
                createdAt: new Date().toISOString()
            })

            toast.success(`Nudge sent to ${managerName}`)
        } catch (error) {
            console.error('Failed to send nudge:', error)
            toast.error('Failed to send notification')
        } finally {
            setIsNotifying(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Status Summary */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/40">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "h-12 w-12 rounded-full flex items-center justify-center border-4",
                        data.health === 'green' ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                            data.health === 'yellow' ? "bg-amber-50 border-amber-100 text-amber-600" : "bg-rose-50 border-rose-100 text-rose-600"
                    )}>
                        <span className="text-lg font-bold">{Math.round(data.healthScore)}%</span>
                    </div>
                    <div>
                        <h4 className="font-bold">Project Health Index</h4>
                        <p className="text-xs text-muted-foreground">Real-time status based on task execution & deadlines</p>
                    </div>
                </div>
                <Badge className={cn(
                    "capitalize px-3 py-1",
                    data.health === 'green' ? "bg-emerald-500 hover:bg-emerald-600" :
                        data.health === 'yellow' ? "bg-amber-500 hover:bg-amber-600" : "bg-rose-500 hover:bg-rose-600"
                )}>
                    {data.health === 'green' ? 'Healthy' : data.health === 'yellow' ? 'At Risk' : 'Critical'}
                </Badge>
            </div>

            {/* Task Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-card rounded-lg border border-border/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <ListFilter className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Total</span>
                    </div>
                    <p className="text-lg font-bold">{data.metadata?.totalTasks || 0}</p>
                </div>
                <div className="p-3 bg-card rounded-lg border border-border/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Done</span>
                    </div>
                    <p className="text-lg font-bold text-emerald-600">{data.metadata?.completedTasks || 0}</p>
                </div>
                <div className="p-3 bg-card rounded-lg border border-border/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Pending</span>
                    </div>
                    <p className="text-lg font-bold">{(data.metadata?.totalTasks || 0) - (data.metadata?.completedTasks || 0)}</p>
                </div>
                <div className="p-3 bg-card rounded-lg border border-border/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Overdue</span>
                    </div>
                    <p className="text-lg font-bold text-rose-600">{data.metadata?.overdueCount || 0}</p>
                </div>
            </div>

            {/* Progress Visualization */}
            <Card className="p-5">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-bold">Delivery Velocity</h4>
                    <span className="text-xs font-mono font-bold">{data.metadata?.progress || 0}%</span>
                </div>
                <Progress value={data.metadata?.progress || 0} className="h-3 rounded-full" />
                <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed italic border-l-2 border-primary/20 pl-3">
                    Project is currently trending <strong>{data.health === 'green' ? 'on-time' : 'with potential delays'}</strong>.
                    {data.metadata?.overdueCount > 0 && ` Immediate attention required for ${data.metadata.overdueCount} overdue items.`}
                </p>
            </Card>

            {/* Actions / CTA */}
            <div className="flex gap-3">
                <Link
                    href={`/projects/${projectId}`}
                    className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity flex items-center justify-center"
                >
                    View Project Details
                </Link>
                <button
                    onClick={handleNotifyManager}
                    disabled={isNotifying}
                    className="flex-1 border border-border bg-card py-2 rounded-lg text-sm font-bold hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isNotifying ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Send className="h-3.5 w-3.5" />
                    )}
                    Notify {managerName}
                </button>
            </div>
        </div>
    )
}
