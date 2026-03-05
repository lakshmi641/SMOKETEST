'use client'

import { useState, useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import Link from 'next/link'

interface ApprovalStageInstance {
  id: string
  workflowInstanceId: string
  stageName: string
  stageOrder: number
  type: 'sequential' | 'parallel'
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'escalated' | 'skipped'
  requiredApprovals: number
  currentApprovals: number
  assignedApprovers: string[]
  approvals: Array<{
    id: string
    userId: string
    userName?: string
    approvedAt: string
    comments?: string
  }>
  dueAt: string
  escalationLevel: number
  timeoutHours: number
}

interface ApprovalInboxProps {
  compact?: boolean
  maxItems?: number
}

export default function ApprovalInbox({ compact = false, maxItems = 10 }: ApprovalInboxProps) {
  const { companyId } = useCompany()
  const { user } = useAuthStore()
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalStageInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject'
    stage: ApprovalStageInstance
  } | null>(null)
  const [actionComment, setActionComment] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)





  useEffect(() => {
    if (!companyId || !user?.id || !auth.currentUser) return

    // Query stages where the current user is an assigned approver
    // Fetch all and filter client-side to avoid index/permission issues
    const q = query(
      collection(db, `companies/${companyId}/approvalStageInstances`)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const approvals = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }) as ApprovalStageInstance)
        // Client-side filtering
        .filter(stage => stage.assignedApprovers?.includes(user.id))
        .filter(stage => ['in_progress', 'escalated'].includes(stage.status))
        // Filter out already approved by this user
        .filter(stage => !stage.approvals.some(a => a.userId === user.id))
        // Sort by due date (earliest first)
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())

      setPendingApprovals(approvals.slice(0, maxItems))
      setLoading(false)
    }, (error) => {
      console.error("Error loading approvals:", error)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [companyId, user?.id, maxItems])

  const getTimeUntilDue = (dueAt: string) => {
    const now = new Date()
    const due = new Date(dueAt)
    const diffMs = due.getTime() - now.getTime()

    if (diffMs < 0) {
      const hoursOverdue = Math.abs(diffMs) / (1000 * 60 * 60)
      if (hoursOverdue < 24) {
        return { text: `${Math.round(hoursOverdue)}h overdue`, urgent: true }
      }
      return { text: `${Math.round(hoursOverdue / 24)}d overdue`, urgent: true }
    }

    const hoursLeft = diffMs / (1000 * 60 * 60)
    if (hoursLeft < 4) {
      return { text: `${Math.round(hoursLeft)}h left`, urgent: true }
    }
    if (hoursLeft < 24) {
      return { text: `${Math.round(hoursLeft)}h left`, urgent: false }
    }
    return { text: `${Math.round(hoursLeft / 24)}d left`, urgent: false }
  }

  const handleApprove = async () => {
    if (!actionModal || !companyId || !user) return

    setProcessing(true)
    try {
      const stageRef = doc(db, `companies/${companyId}/approvalStageInstances/${actionModal.stage.id}`)

      const newApproval = {
        id: `approval-${Date.now()}`,
        userId: user.id,
        userName: user.name || user.email || 'Unknown',
        approvedAt: new Date().toISOString(),
        comments: actionComment || undefined,
        isDelegated: false,
      }

      const newApprovals = [...actionModal.stage.approvals, newApproval]
      const newApprovalCount = actionModal.stage.currentApprovals + 1
      const stageCompleted = newApprovalCount >= actionModal.stage.requiredApprovals

      await updateDoc(stageRef, {
        approvals: newApprovals,
        currentApprovals: newApprovalCount,
        status: stageCompleted ? 'approved' : 'in_progress',
        ...(stageCompleted && { completedAt: new Date().toISOString() }),
        updatedAt: serverTimestamp(),
      })

      // Create notification for workflow owner
      await addDoc(collection(db, `companies/${companyId}/notifications`), {
        type: 'approval_received',
        title: 'Approval Received',
        message: `${user.name || 'A user'} approved stage "${actionModal.stage.stageName}"`,
        workflowInstanceId: actionModal.stage.workflowInstanceId,
        stageId: actionModal.stage.id,
        read: false,
        createdAt: serverTimestamp(),
      })

      setActionModal(null)
      setActionComment('')
    } catch (error) {
      console.error('Error approving:', error)
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!actionModal || !companyId || !user || !rejectionReason.trim()) return

    setProcessing(true)
    try {
      const stageRef = doc(db, `companies/${companyId}/approvalStageInstances/${actionModal.stage.id}`)

      const newRejection = {
        id: `rejection-${Date.now()}`,
        userId: user.id,
        userName: user.name || user.email || 'Unknown',
        rejectedAt: new Date().toISOString(),
        reason: rejectionReason,
        comments: actionComment || undefined,
      }

      await updateDoc(stageRef, {
        rejections: [...(actionModal.stage as unknown as { rejections: unknown[] }).rejections || [], newRejection],
        currentRejections: ((actionModal.stage as unknown as { currentRejections: number }).currentRejections || 0) + 1,
        status: 'rejected',
        completedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      })

      // Create notification for workflow owner
      await addDoc(collection(db, `companies/${companyId}/notifications`), {
        type: 'approval_rejected',
        title: 'Approval Rejected',
        message: `${user.name || 'A user'} rejected stage "${actionModal.stage.stageName}": ${rejectionReason}`,
        workflowInstanceId: actionModal.stage.workflowInstanceId,
        stageId: actionModal.stage.id,
        read: false,
        createdAt: serverTimestamp(),
      })

      setActionModal(null)
      setActionComment('')
      setRejectionReason('')
    } catch (error) {
      console.error('Error rejecting:', error)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className={compact ? 'p-4' : 'p-6'}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (pendingApprovals.length === 0) {
    return (
      <div className={`${compact ? 'p-4' : 'p-6'} bg-white rounded-lg shadow-sm border border-gray-200`}>
        <h3 className={`${compact ? 'text-sm' : 'text-lg'} font-semibold text-gray-900 mb-2`}>
          Pending Approvals
        </h3>
        <p className="text-gray-500 text-sm">No pending approvals</p>
      </div>
    )
  }

  return (
    <>
      <div className={`${compact ? '' : 'bg-white rounded-lg shadow-sm border border-gray-200 p-6'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`${compact ? 'text-sm' : 'text-lg'} font-semibold text-gray-900`}>
            Pending Approvals ({pendingApprovals.length})
          </h3>
          {!compact && (
            <Link href="/workflows/instances" className="text-sm text-blue-600 hover:text-blue-800">
              View All
            </Link>
          )}
        </div>

        <div className="space-y-3">
          {pendingApprovals.map((stage) => {
            const timeStatus = getTimeUntilDue(stage.dueAt)
            return (
              <div
                key={stage.id}
                className={`border rounded-lg p-4 ${timeStatus.urgent ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
                  }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{stage.stageName}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {stage.type === 'parallel'
                        ? `${stage.currentApprovals}/${stage.requiredApprovals} approved`
                        : 'Waiting for your approval'}
                    </div>
                    <div className={`text-xs mt-1 ${timeStatus.urgent ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                      {timeStatus.text}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => setActionModal({ type: 'approve', stage })}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setActionModal({ type: 'reject', stage })}
                      className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {stage.escalationLevel > 0 && (
                  <div className="mt-2 text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded inline-block">
                    Escalated {stage.escalationLevel}x
                  </div>
                )}

                <div className="mt-2">
                  <Link
                    href={`/workflows/instances/${stage.workflowInstanceId}`}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    View Details &rarr;
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {actionModal.type === 'approve' ? 'Approve' : 'Reject'} {actionModal.stage.stageName}
            </h3>

            {actionModal.type === 'reject' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comments (optional)
              </label>
              <textarea
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                placeholder="Add any additional comments..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setActionModal(null)
                  setActionComment('')
                  setRejectionReason('')
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={processing}
              >
                Cancel
              </button>
              <button
                onClick={actionModal.type === 'approve' ? handleApprove : handleReject}
                disabled={processing || (actionModal.type === 'reject' && !rejectionReason.trim())}
                className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${actionModal.type === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
                  }`}
              >
                {processing ? 'Processing...' : actionModal.type === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
