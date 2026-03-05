import { useState, useEffect } from 'react'
import { doc, onSnapshot, query, where, collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { TaskEscalationRegistration } from '@/types/workflow-schema'

/**
 * useEscalationStatus - Real-time hook for task escalation status
 * 
 * This hook provides real-time updates for a task's escalation registration,
 * enabling the UI to display escalation monitoring status.
 * 
 * Part of the INDEPENDENT escalation system - entirely separate from approval.
 */
export function useEscalationStatus(companyId: string | undefined, taskId: string | undefined, groupId?: string | null) {
    const [registration, setRegistration] = useState<TaskEscalationRegistration | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        // Validate that both companyId and taskId are non-empty strings
        if (!companyId || !taskId || typeof companyId !== 'string' || typeof taskId !== 'string' || companyId.trim() === '' || taskId.trim() === '') {
            setLoading(false)
            setRegistration(null)
            setError(null)
            return
        }

        setLoading(true)
        setError(null)

        // Find the active escalation registration for this task
        const fetchRegistration = async () => {
            try {
                const effectiveGroupId = groupId || companyId
                const q = query(
                    collection(db, 'enterpriseGroups', effectiveGroupId, 'companies', companyId, 'taskEscalationRegistrations'),
                    where('taskId', '==', taskId),
                    where('status', '==', 'active')
                )
                const snapshot = await getDocs(q)

                if (!snapshot.empty && snapshot.docs[0]) {
                    const regDoc = snapshot.docs[0]
                    const regData = { id: regDoc.id, ...regDoc.data() } as TaskEscalationRegistration
                    setRegistration(regData)

                    // Now subscribe to real-time updates for this specific registration
                    const effectiveGroupId = groupId || companyId
                    const unsub = onSnapshot(
                        doc(db, 'enterpriseGroups', effectiveGroupId, 'companies', companyId, 'taskEscalationRegistrations', regDoc.id),
                        (docSnap) => {
                            if (docSnap.exists()) {
                                setRegistration({ id: docSnap.id, ...docSnap.data() } as TaskEscalationRegistration)
                            } else {
                                setRegistration(null)
                            }
                        },
                        (err) => {
                            console.error('Error in escalation snapshot:', err)
                            // Only set error if it's not a permission error (which is expected for some users)
                            if (!err.message?.includes('permission')) {
                                setError(err)
                            }
                        }
                    )
                    // Return unsub for cleanup
                    return unsub
                } else {
                    setRegistration(null)
                }
                setLoading(false)
            } catch (err: any) {
                // Handle permission errors gracefully - they're expected when user doesn't have access
                if (err.code === 'permission-denied' || err.message?.includes('permission')) {
                    console.log('Escalation monitoring not available for this task (insufficient permissions)')
                    setRegistration(null)
                    setError(null) // Don't treat permission errors as errors
                } else {
                    console.error('Error fetching escalation registration:', err)
                    setError(err as Error)
                }
                setLoading(false)
            }
        }

        let unsubscribe: (() => void) | undefined

        fetchRegistration().then((unsub) => {
            unsubscribe = unsub
            setLoading(false)
        }).catch((err) => {
            // Handle any errors from the promise
            if (err.code === 'permission-denied' || err.message?.includes('permission')) {
                console.log('Escalation monitoring not available (insufficient permissions)')
                setRegistration(null)
                setError(null)
            } else {
                console.error('Error in escalation fetch promise:', err)
                setError(err)
            }
            setLoading(false)
        })

        return () => {
            if (unsubscribe) unsubscribe()
        }
    }, [companyId, taskId, groupId])

    // Derived state for common UI needs
    const isActive = registration?.status === 'active'
    const currentLevel = registration?.currentEscalationLevel || 0
    const nextCheckAt = registration?.nextCheckAt
    const lastActionTaken = registration?.lastActionTaken

    // Calculate time until next check
    const timeUntilNextCheck = nextCheckAt
        ? Math.max(0, new Date(nextCheckAt).getTime() - Date.now())
        : null

    return {
        registration,
        loading,
        error,
        // Convenience flags
        isActive,
        currentLevel,
        nextCheckAt,
        lastActionTaken,
        timeUntilNextCheck,
        // Human-readable time
        timeUntilNextCheckFormatted: timeUntilNextCheck
            ? formatDuration(timeUntilNextCheck)
            : null
    }
}

function formatDuration(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
        return `${hours}h ${minutes}m`
    }
    return `${minutes} minutes`
}
