import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ApprovalInstance } from '@/types/approval-line-schema'

/**
 * useApprovalInstance - Real-time hook for task approval status
 * 
 * This hook provides real-time updates for a task's approval instance,
 * enabling the UI to display workflow status and allow approvers to respond.
 * 
 * Part of the INDEPENDENT approval system - entirely separate from escalation.
 */
export function useApprovalInstance(companyId: string | undefined, instanceId: string | undefined) {
    const [instance, setInstance] = useState<ApprovalInstance | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        if (!companyId || !instanceId) {
            setLoading(false)
            setInstance(null)
            return
        }

        setLoading(true)
        setError(null)

        const unsub = onSnapshot(
            doc(db, 'companies', companyId, 'approvalInstances', instanceId),
            (docSnap) => {
                if (docSnap.exists()) {
                    setInstance({ id: docSnap.id, ...docSnap.data() } as ApprovalInstance)
                } else {
                    setInstance(null)
                }
                setLoading(false)
            },
            (err) => {
                console.error('Error fetching approval instance:', err)
                setError(err)
                setLoading(false)
            }
        )

        return () => unsub()
    }, [companyId, instanceId])

    // Derived state for common UI needs
    const isPending = instance?.status === 'in_progress'
    const isApproved = instance?.status === 'approved'
    const isRejected = instance?.status === 'rejected'
    const currentStage = instance?.stageInstances?.find(s => s.status === 'active')
    const completedStages = instance?.stageInstances?.filter(s => s.status === 'approved').length || 0
    const totalStages = instance?.stageInstances?.length || 0

    return {
        instance,
        loading,
        error,
        // Convenience flags
        isPending,
        isApproved,
        isRejected,
        currentStage,
        completedStages,
        totalStages,
        // Progress percentage
        progress: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0
    }
}
