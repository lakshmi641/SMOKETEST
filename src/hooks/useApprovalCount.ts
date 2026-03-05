'use client'

import { useState, useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { collection, query, onSnapshot, where, or, and } from 'firebase/firestore'
import { getFirestoreInstance } from '@/lib/firebase'
import { useFirebaseAuth } from './useFirebaseAuth'
import { companyCollectionPathSegments } from '@/lib/firestore-paths'

interface ApprovalStageInstance {
  id: string
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'escalated' | 'skipped'
  assignedApprovers: string[]
  approvals: Array<{
    userId: string
  }>
}

interface NewApprovalInstance {
  id: string
  status: 'in_progress' | 'approved' | 'rejected' | 'cancelled'
  stageInstances: Array<{
    status: 'active' | 'pending' | 'approved' | 'rejected'
    assignedApprovers: Array<{
      userId: string
      status: 'pending' | 'approved' | 'rejected'
    }>
  }>
}

/**
 * Hook to get the count of pending approvals for the current user.
 * Used for displaying badge count in the sidebar navigation.
 */
export function useApprovalCount() {
  const { companyId, groupId } = useCompany()
  const { user } = useAuthStore()
  const { isAuthenticated, initialized } = useFirebaseAuth()
  const [count, setCount] = useState(0)
  const [counts, setCounts] = useState({ traditional: 0, workflow: 0, direct: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Wait for auth to be initialized and user to be authenticated
    if (!initialized) {
      return
    }

    if (!isAuthenticated || !companyId || !user?.id) {
      setCount(0)
      setLoading(false)
      return
    }

    setLoading(true)

    const db = getFirestoreInstance()
    // 1. Monitor Traditional Approval Stages
    const q1 = query(
      collection(db, ...companyCollectionPathSegments(groupId || '', companyId, 'approvalStageInstances'))
    )

    const unsubscribe1 = onSnapshot(
      q1,
      (snapshot) => {
        const traditionalCount = snapshot.docs
          .map(doc => doc.data() as ApprovalStageInstance)
          .filter(stage => stage.assignedApprovers?.includes(user.id))
          .filter(stage => ['in_progress', 'escalated'].includes(stage.status))
          .filter(stage => !stage.approvals?.some(a => a.userId === user.id))
          .length

        setCounts(prev => ({ ...prev, traditional: traditionalCount }))
      },
      (error) => {
        console.warn('Approval count listener 1 error:', error.message)
        setCounts(prev => ({ ...prev, traditional: 0 }))
      }
    )

    // 2. Monitor BPMN-driven Workflow Tasks
    // Simplified query to avoid composite index requirements
    const q2 = query(
      collection(db, ...companyCollectionPathSegments(groupId || '', companyId, 'tasks')),
      where('assignedUserId', '==', user.id)
    )

    const unsubscribe2 = onSnapshot(
      q2,
      (snapshot) => {
        const tasks = snapshot.docs.map(doc => doc.data())

        // Filter client-side to avoid index/permission issues
        const workflowCount = tasks.filter(t =>
          t.workflowInstanceId &&
          t.workflowStatus === 'active' &&
          t.status !== 'completed'
        ).length

        setCounts(prev => ({ ...prev, workflow: workflowCount }))
      },
      (error) => {
        console.warn('Approval count listener 2 error:', error.message)
        setCounts(prev => ({ ...prev, workflow: 0 }))
      }
    )

    // 3. Monitor Direct Approval Instances
    const q3 = query(
      collection(db, ...companyCollectionPathSegments(groupId || '', companyId, 'approvalInstances')),
      where('status', '==', 'in_progress')
    )

    const unsubscribe3 = onSnapshot(
      q3,
      (snapshot) => {
        const directCount = snapshot.docs
          .map(doc => doc.data() as NewApprovalInstance)
          .filter(instance => {
            const activeStage = instance.stageInstances?.find(s => s.status === 'active')
            if (!activeStage) return false
            return activeStage.assignedApprovers?.some(a => a.userId === user.id && a.status === 'pending')
          })
          .length

        setCounts(prev => ({ ...prev, direct: directCount }))
      },
      (error) => {
        console.warn('Approval count listener 3 error:', error.message)
        setCounts(prev => ({ ...prev, direct: 0 }))
      }
    )

    return () => {
      unsubscribe1()
      unsubscribe2()
      unsubscribe3()
    }
  }, [companyId, groupId, user?.id, isAuthenticated, initialized])

  useEffect(() => {
    setCount(counts.traditional + counts.workflow + counts.direct)
    setLoading(false)
  }, [counts])

  return { count, loading }
}
