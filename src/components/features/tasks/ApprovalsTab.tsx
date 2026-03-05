'use client'

import { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth'
import { collection, query, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Filter, ExternalLink, CheckCircle, XCircle, Clock, AlertTriangle, History } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

type TabType = 'pending' | 'history'
type FilterStatus = 'all' | 'urgent' | 'on-time'

interface ApprovalsTabProps {
  onCountChange?: (count: number) => void
}

export function ApprovalsTab({ onCountChange }: ApprovalsTabProps) {
  const { companyId, groupId } = useCompany()
  const { user } = useAuthStore()
  const { isAuthenticated, initialized } = useFirebaseAuth()

  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject'
    item: any
  } | null>(null)
  const [actionComment, setActionComment] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)

  const [allApprovalInstances, setAllApprovalInstances] = useState<any[]>([])

  useEffect(() => {
    if (!initialized || !isAuthenticated || !companyId || !user?.id || !groupId) {
      setAllApprovalInstances([])
      setLoading(false)
      return
    }

    const segments = companySubcollectionPathSegments(groupId, companyId, 'approvalInstances')
    const q = query(collection(db, segments[0], ...segments.slice(1)))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const instances = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as any
      }))
      setAllApprovalInstances(instances)
      setLoading(false)
    }, (error) => {
      console.error("Error loading approvals:", error)
      setAllApprovalInstances([])
      setLoading(false)
    })

    return () => unsubscribe()
  }, [companyId, groupId, user?.id, isAuthenticated, initialized])

  const { pendingApprovals, historyApprovals } = useMemo(() => {
    const pending: any[] = []
    const history: any[] = []

    allApprovalInstances.forEach(instance => {
      let userInvolved = false
      let userAction: { decision: string; respondedAt: string; comments?: string; stageName?: string } | null = null
      let isCurrentApprover = false
      let activeStage: any = null

      instance.stageInstances?.forEach((stage: any) => {
        if (stage.status === 'active') {
          activeStage = stage
        }
        stage.assignedApprovers?.forEach((approver: any) => {
          if (approver.userId === user?.id) {
            userInvolved = true

            if (approver.status === 'approved' || approver.status === 'rejected' ||
                approver.decision === 'approved' || approver.decision === 'rejected') {
              userAction = {
                decision: approver.status || approver.decision,
                respondedAt: approver.respondedAt,
                comments: approver.comments,
                stageName: stage.stageName
              }
            }

            if (stage.status === 'active' && approver.status === 'pending') {
              isCurrentApprover = true
            }
          }
        })
      })

      if (!userInvolved) return

      const timeoutHours = activeStage?.timeoutHours || 24
      const startTime = activeStage?.startedAt || instance.startedAt || instance.createdAt
      const dueDate = new Date(startTime)
      dueDate.setHours(dueDate.getHours() + timeoutHours)

      const item = {
        ...instance,
        activeStage: activeStage || instance.stageInstances?.[0],
        dueAt: dueDate.toISOString(),
        userAction,
        isCurrentApprover
      }

      if (isCurrentApprover && instance.status === 'in_progress') {
        pending.push(item)
      } else if (userAction) {
        history.push(item)
      }
    })

    pending.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    history.sort((a, b) => new Date(b.userAction?.respondedAt || b.updatedAt).getTime() - new Date(a.userAction?.respondedAt || a.updatedAt).getTime())

    return { pendingApprovals: pending, historyApprovals: history }
  }, [allApprovalInstances, user?.id])

  useEffect(() => {
    onCountChange?.(pendingApprovals.length)
  }, [pendingApprovals.length, onCountChange])

  const getTimeStatus = (dueAt: string) => {
    const now = new Date()
    const due = new Date(dueAt)
    const diffMs = due.getTime() - now.getTime()
    const hoursLeft = diffMs / (1000 * 60 * 60)

    if (diffMs < 0) {
      const hoursOverdue = Math.abs(diffMs) / (1000 * 60 * 60)
      if (hoursOverdue < 24) {
        return { text: `${Math.round(hoursOverdue)}h overdue`, status: 'overdue' as const, urgent: true }
      }
      return { text: `${Math.round(hoursOverdue / 24)}d overdue`, status: 'overdue' as const, urgent: true }
    }

    if (hoursLeft < 4) {
      return { text: `${Math.round(hoursLeft)}h left`, status: 'at-risk' as const, urgent: true }
    }
    if (hoursLeft < 24) {
      return { text: `${Math.round(hoursLeft)}h left`, status: 'on-time' as const, urgent: false }
    }
    return { text: `${Math.round(hoursLeft / 24)}d left`, status: 'on-time' as const, urgent: false }
  }

  const currentList = activeTab === 'pending' ? pendingApprovals : historyApprovals

  const filteredList = currentList.filter(item => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        item.resourceTitle?.toLowerCase().includes(q) ||
        item.approvalLineName?.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
      if (!matchesSearch) return false
    }

    if (activeTab === 'pending' && statusFilter !== 'all') {
      const timeStatus = getTimeStatus(item.dueAt)
      if (statusFilter === 'urgent' && !timeStatus.urgent) return false
      if (statusFilter === 'on-time' && timeStatus.urgent) return false
    }

    return true
  })

  const urgentCount = pendingApprovals.filter(a => getTimeStatus(a.dueAt).urgent).length
  const onTimeCount = pendingApprovals.length - urgentCount
  const approvedCount = historyApprovals.filter(a => a.userAction?.decision === 'approved').length
  const rejectedCount = historyApprovals.filter(a => a.userAction?.decision === 'rejected').length

  const handleApprove = async () => {
    if (!actionModal || !companyId || !groupId || !user) return

    setProcessing(true)
    try {
      const { TaskApprovalService } = await import('@/lib/services/tasks/task-approval-service')
      await TaskApprovalService.submitDecision(
        companyId,
        actionModal.item.id,
        user.id,
        'approved',
        actionComment,
        groupId
      )
      toast.success('Approval submitted successfully')
      setActionModal(null)
      setActionComment('')
    } catch (error) {
      console.error('Error approving:', error)
      toast.error('Failed to submit approval')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!actionModal || !companyId || !groupId || !user || !rejectionReason.trim()) return

    setProcessing(true)
    try {
      const { TaskApprovalService } = await import('@/lib/services/tasks/task-approval-service')
      await TaskApprovalService.submitDecision(
        companyId,
        actionModal.item.id,
        user.id,
        'rejected',
        rejectionReason + (actionComment ? `\n${actionComment}` : ''),
        groupId
      )
      toast.success('Task rejected successfully')
      setActionModal(null)
      setActionComment('')
      setRejectionReason('')
    } catch (error) {
      console.error('Error rejecting:', error)
      toast.error('Failed to reject task')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingApprovals.length}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{urgentCount}</p>
              <p className="text-sm text-muted-foreground">Urgent</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{approvedCount}</p>
              <p className="text-sm text-muted-foreground">Approved</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <XCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rejectedCount}</p>
              <p className="text-sm text-muted-foreground">Rejected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-tabs: Pending / History */}
      <div className="flex border-b mb-4">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'pending'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Pending
          {pendingApprovals.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
              {pendingApprovals.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="w-4 h-4 inline mr-2" />
          History
          {historyApprovals.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">
              {historyApprovals.length}
            </span>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search approvals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {activeTab === 'pending' && (
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
            <SelectTrigger className="w-[160px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="urgent">Urgent Only</SelectItem>
              <SelectItem value="on-time">On Time</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-20 bg-muted rounded animate-pulse"></div>
          <div className="h-20 bg-muted rounded animate-pulse"></div>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-card">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
            {activeTab === 'pending' ? (
              <CheckCircle className="w-6 h-6 text-muted-foreground" />
            ) : (
              <History className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <p className="font-medium">
            {activeTab === 'pending' ? 'No pending approvals' : 'No approval history yet'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {activeTab === 'pending'
              ? 'You have no items waiting for your approval.'
              : 'Your completed approvals will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map((item) => {
            const timeStatus = activeTab === 'pending' ? getTimeStatus(item.dueAt) : null

            return (
              <div
                key={item.id}
                className={`bg-card rounded-lg border p-4 transition-shadow hover:shadow-sm ${
                  timeStatus?.urgent ? 'border-red-300 dark:border-red-800' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold">{item.resourceTitle || 'Task Approval'}</h3>

                      {/* Hide time countdown for system approvals (Reporter Approval) */}
                      {activeTab === 'pending' && timeStatus &&
                       !(item.isSystemApproval || item.approvalLineId === '__SYSTEM_REPORTER_APPROVAL__') && (
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          timeStatus.status === 'overdue'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : timeStatus.status === 'at-risk'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {timeStatus.text}
                        </span>
                      )}

                      {activeTab === 'history' && item.userAction && (
                        <Badge
                          variant={item.userAction.decision === 'approved' ? 'default' : 'destructive'}
                          className={item.userAction.decision === 'approved' ? 'bg-green-600' : ''}
                        >
                          {item.userAction.decision === 'approved' ? 'You Approved' : 'You Rejected'}
                        </Badge>
                      )}

                      <Badge variant="outline" className="text-xs">
                        {/* For system approvals, show "Pending Approval" instead of "In Progress" */}
                        {item.status === 'approved' ? 'Completed' :
                         item.status === 'rejected' ? 'Rejected' :
                         item.status === 'in_progress' && (item.isSystemApproval || item.approvalLineId === '__SYSTEM_REPORTER_APPROVAL__') ? 'Pending Approval' :
                         item.status === 'in_progress' ? 'In Progress' : item.status}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">
                      {/* For system approvals (Reporter Approval), show simplified text without stage info */}
                      {item.isSystemApproval || item.approvalLineId === '__SYSTEM_REPORTER_APPROVAL__'
                        ? 'Reporter Approval'
                        : `${item.approvalLineName} - Stage: ${item.activeStage?.stageName || item.userAction?.stageName || 'N/A'}`}
                    </p>

                    {activeTab === 'history' && item.userAction?.respondedAt && (
                      <div className="text-sm text-muted-foreground mb-2">
                        <span>Responded on {format(new Date(item.userAction.respondedAt), 'MMM d, yyyy at h:mm a')}</span>
                        {item.userAction.comments && (
                          <p className="mt-1 italic text-xs">"{item.userAction.comments}"</p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      {item.resourceId && item.context?.projectId && (
                        <Link
                          href={`/projects/${item.context.projectId}/tasks/${item.resourceId}`}
                          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                        >
                          View Task
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {activeTab === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => setActionModal({ type: 'approve', item })}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setActionModal({ type: 'reject', item })}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">
              {actionModal.type === 'approve' ? 'Approve' : 'Reject'} Request
            </h3>

            <p className="text-sm text-muted-foreground mb-4">
              {actionModal.item.resourceTitle}
            </p>

            {actionModal.type === 'reject' && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Reason for rejection <span className="text-red-500">*</span>
                </label>
                <Input
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason..."
                />
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Comments (optional)
              </label>
              <textarea
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                placeholder="Add any comments..."
                rows={3}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setActionModal(null)
                  setActionComment('')
                  setRejectionReason('')
                }}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button
                onClick={actionModal.type === 'approve' ? handleApprove : handleReject}
                disabled={processing || (actionModal.type === 'reject' && !rejectionReason.trim())}
                className={actionModal.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                variant={actionModal.type === 'reject' ? 'destructive' : 'default'}
              >
                {processing ? 'Processing...' : actionModal.type === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
