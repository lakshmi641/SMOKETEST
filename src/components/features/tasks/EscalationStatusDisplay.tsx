'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Clock,
    AlertTriangle,
    CheckCircle2,
    Timer,
    Play,
    Loader2,
    ChevronRight,
    Bell,
    UserPlus,
    ArrowUpRight,
    CheckCheck,
    XCircle
} from 'lucide-react'
import { useEscalationStatus } from '@/hooks/useEscalationStatus'
import { cn } from '@/lib/utils'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface EscalationRule {
    id: string
    order: number
    triggerType: 'time' | 'rejection' | 'no_response'
    triggerAfterHours?: number
    action: 'notify' | 'reassign' | 'escalate' | 'auto_approve' | 'auto_reject'
    notificationChannels?: string[]
}

interface EscalationStatusDisplayProps {
    companyId: string
    taskId: string
    compact?: boolean
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
    notify: <Bell className="w-3 h-3" />,
    reassign: <UserPlus className="w-3 h-3" />,
    escalate: <ArrowUpRight className="w-3 h-3" />,
    auto_approve: <CheckCheck className="w-3 h-3" />,
    auto_reject: <XCircle className="w-3 h-3" />
}

const ACTION_LABELS: Record<string, string> = {
    notify: 'Send Notification',
    reassign: 'Reassign Task',
    escalate: 'Escalate to Manager',
    auto_approve: 'Auto Approve',
    auto_reject: 'Auto Reject'
}

function formatTriggerTime(hours?: number): string {
    if (!hours) return 'Immediately'
    if (hours < 1) return `${Math.round(hours * 60)}m overdue`
    if (hours === 1) return '1 hour overdue'
    return `${hours}h overdue`
}

/**
 * EscalationStatusDisplay - Sleek, native escalation monitoring display
 */
export function EscalationStatusDisplay({ companyId, taskId, compact = false }: EscalationStatusDisplayProps) {
    const {
        registration,
        loading,
        error,
        isActive,
        currentLevel,
        nextCheckAt,
        timeUntilNextCheckFormatted,
        lastActionTaken
    } = useEscalationStatus(companyId, taskId)

    const [isStarting, setIsStarting] = useState(false)
    const [rules, setRules] = useState<EscalationRule[]>([])
    const [policyName, setPolicyName] = useState<string>('')
    const [loadingRules, setLoadingRules] = useState(false)

    // Fetch escalation rules when registration becomes active
    useEffect(() => {
        async function fetchRules() {
            if (!registration?.escalationPolicyId) return
            try {
                setLoadingRules(true)
                const pathDoc = await getDoc(doc(db, 'companies', companyId, 'escalationPaths', registration.escalationPolicyId))
                if (pathDoc.exists()) {
                    const data = pathDoc.data()
                    setRules(data.rules || [])
                    setPolicyName(data.name || 'Escalation Policy')
                }
            } catch (err) {
                console.error('Failed to fetch escalation rules:', err)
            } finally {
                setLoadingRules(false)
            }
        }
        fetchRules()
    }, [companyId, registration?.escalationPolicyId])

    const handleStartMonitoring = async () => {
        try {
            setIsStarting(true)
            const { TaskEscalationService } = await import('@/lib/services/tasks/task-escalation-service')
            await TaskEscalationService.registerForEscalation(companyId, taskId)
            toast.success('Monitoring started')
        } catch (err) {
            console.error('Failed to start monitoring:', err)
            toast.error('Failed to start')
        } finally {
            setIsStarting(false)
        }
    }

    // Don't render anything if companyId or taskId is missing
    if (!companyId || !taskId) {
        return null
    }

    // Don't show anything if there's a permission error (user doesn't have access)
    if (error && (error.message?.includes('permission') || error.message?.includes('denied'))) {
        return null
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Loading...</span>
            </div>
        )
    }

    // No registration - show start button
    if (!registration) {
        return (
            <div className="mt-2 p-3 rounded-lg border border-dashed border-amber-200 bg-amber-50/30">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-medium text-amber-700">Not monitoring</span>
                    </div>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-amber-700 hover:bg-amber-100"
                        onClick={handleStartMonitoring}
                        disabled={isStarting}
                    >
                        {isStarting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <>
                                <Play className="w-3 h-3 mr-1" />
                                Start
                            </>
                        )}
                    </Button>
                </div>
            </div>
        )
    }

    // Active monitoring - sleek display
    return (
        <div className="mt-2 space-y-2">
            {/* Status Header */}
            <div className={cn(
                "flex items-center justify-between p-2.5 rounded-lg",
                isActive ? "bg-amber-50 border border-amber-100" : "bg-green-50 border border-green-100"
            )}>
                <div className="flex items-center gap-2">
                    {isActive ? (
                        <Timer className="w-4 h-4 text-amber-600" />
                    ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                    )}
                    <div>
                        <p className={cn(
                            "text-xs font-semibold",
                            isActive ? "text-amber-800" : "text-green-800"
                        )}>
                            {isActive ? 'Monitoring Active' : 'Completed'}
                        </p>
                        {isActive && nextCheckAt && (
                            <p className="text-[10px] text-muted-foreground">
                                Next check: {timeUntilNextCheckFormatted || 'Soon'}
                            </p>
                        )}
                    </div>
                </div>
                <Badge
                    variant="outline"
                    className={cn(
                        "text-[9px] px-1.5 py-0",
                        isActive
                            ? "border-amber-300 text-amber-700 bg-amber-100"
                            : "border-green-300 text-green-700 bg-green-100"
                    )}
                >
                    Level {currentLevel}
                </Badge>
            </div>

            {/* Escalation Steps - Only show when active */}
            {isActive && rules.length > 0 && (
                <div className="border rounded-lg divide-y">
                    <div className="px-3 py-1.5 bg-slate-50">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            Escalation Steps
                        </p>
                    </div>
                    <div className="divide-y">
                        {rules.slice(0, 3).map((rule, idx) => {
                            const isCompleted = idx < currentLevel
                            const isCurrent = idx === currentLevel
                            return (
                                <div
                                    key={rule.id}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 text-xs",
                                        isCompleted && "bg-green-50/50",
                                        isCurrent && "bg-amber-50/50"
                                    )}
                                >
                                    <div className={cn(
                                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                                        isCompleted ? "bg-green-500 text-white" :
                                            isCurrent ? "bg-amber-500 text-white animate-pulse" :
                                                "bg-slate-200 text-slate-500"
                                    )}>
                                        {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className={cn(
                                                "font-medium",
                                                isCompleted ? "text-green-700" :
                                                    isCurrent ? "text-amber-700" : "text-slate-600"
                                            )}>
                                                {ACTION_LABELS[rule.action] || rule.action}
                                            </span>
                                            {ACTION_ICONS[rule.action]}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            {formatTriggerTime(rule.triggerAfterHours)}
                                        </p>
                                    </div>
                                    {isCurrent && (
                                        <ChevronRight className="w-3 h-3 text-amber-500" />
                                    )}
                                </div>
                            )
                        })}
                        {rules.length > 3 && (
                            <div className="px-3 py-1.5 text-[10px] text-muted-foreground text-center">
                                +{rules.length - 3} more steps
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Last Action */}
            {lastActionTaken && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-slate-50 text-[10px]">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    <span className="text-slate-600">Last: <strong>{ACTION_LABELS[lastActionTaken] || lastActionTaken}</strong></span>
                </div>
            )}
        </div>
    )
}
