'use client'

import { useState, useMemo } from 'react'
import { UserCheck, History, Calendar, Plus, X, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils/date-utils'
import type { Position, PositionAssignment } from '@/types/org-schema'
import type { User } from '@/types'
import { getPositionAssignmentHistory } from '@/lib/services/org'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { usePositionsQuery, useActiveAssignmentsQuery, useAssignmentMutations } from '@/hooks/queries/useOrgQueries'
import { useUsersQuery } from '@/hooks/queries/useUserQueries'
import { UserSelect } from '@/components/features/users/UserSelect'

export function AssignmentManagement() {
  const { currentCompany } = useCompany()
  const { user } = useAuthStore()
  const companyId = currentCompany?.id
  const groupId = user?.enterpriseGroupId ?? null
  const { data: positions = [], isLoading: positionsLoading } = usePositionsQuery(companyId, groupId)
  const { data: users = [], isLoading: usersLoading } = useUsersQuery(companyId, groupId)
  const { data: activeAssignmentsList = [], isLoading: assignmentsLoading } = useActiveAssignmentsQuery(companyId, groupId)
  const { assignUserToPosition: assignUserMutation, endAssignment: endAssignmentMutation } = useAssignmentMutations(companyId, groupId)

  const assignments = useMemo(() => {
    return positions.map((position) => {
      const currentAssignments = activeAssignmentsList.filter((a) => a.positionId === position.id)
      const assignedUsers = currentAssignments
        .map((a) => users.find((u) => u.id === a.userId))
        .filter((u): u is User => u !== undefined)
      return { position, currentAssignments, assignedUsers }
    })
  }, [positions, activeAssignmentsList, users])

  const loading = positionsLoading || usersLoading || assignmentsLoading
  const [userSearch, setUserSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [assignmentHistory, setAssignmentHistory] = useState<PositionAssignment[]>([])
  const [endAssignmentDialogOpen, setEndAssignmentDialogOpen] = useState(false)
  const [assignmentToEnd, setAssignmentToEnd] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    positionId: '',
    userId: '',
    assignmentType: 'permanent' as 'permanent' | 'temporary' | 'acting',
    startAt: new Date().toISOString().split('T')[0],
    endAt: '',
    reason: '',
    notes: '',
  })

  function handleAssignClick(position: Position) {
    setSelectedPosition(position)

    // Get current assignments for this position to check if selected user is already assigned
    const positionAssignments = assignments.find(a => a.position.id === position.id)
    const assignedUserIds = new Set(
      positionAssignments?.currentAssignments.map(a => a.userId) || []
    )

    // Clear userId if the currently selected user is already assigned to this position
    const newUserId = formData.userId && assignedUserIds.has(formData.userId)
      ? ''
      : formData.userId

    setFormData({
      ...formData,
      positionId: position.id,
      userId: newUserId,
    })
    setIsDialogOpen(true)
  }

  async function handleViewHistory(position: Position) {
    setSelectedPosition(position)
    if (!companyId || !groupId) return

    try {
      const history = await getPositionAssignmentHistory(companyId, position.id, groupId)
      setAssignmentHistory(history)
      setHistoryDialogOpen(true)
    } catch (error) {
      console.error('Error loading assignment history:', error)
    }
  }

  function resetForm() {
    setSelectedPosition(null)
    setFormData({
      positionId: '',
      userId: '',
      assignmentType: 'permanent',
      startAt: new Date().toISOString().split('T')[0],
      endAt: '',
      reason: '',
      notes: '',
    })
    setIsDialogOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId || !groupId || submitting) return
    if (!formData.userId) return

    try {
      setSubmitting(true)
      const userId = user?.id || 'current-user-id'
      await assignUserMutation.mutateAsync({
        positionId: formData.positionId,
        userId: formData.userId,
        data: {
          assignmentType: formData.assignmentType,
          startAt: formData.startAt ? new Date(formData.startAt).toISOString() : new Date().toISOString(),
          endAt: formData.endAt ? new Date(formData.endAt).toISOString() : null,
          reason: formData.reason || 'Manual assignment',
          notes: formData.notes,
        },
        assignedBy: userId,
      })
      resetForm()
    } catch (error) {
      console.error('Error assigning user:', error)
    } finally {
      setSubmitting(false)
    }
  }

  function handleEndAssignmentClick(assignmentId: string) {
    setAssignmentToEnd(assignmentId)
    setEndAssignmentDialogOpen(true)
  }

  function getAssignmentDetails(assignmentId: string) {
    for (const { position, currentAssignments, assignedUsers } of assignments) {
      const assignment = currentAssignments.find(a => a.id === assignmentId)
      if (assignment) {
        const user = assignedUsers.find(u => u.id === assignment.userId)
        return {
          assignment,
          position,
          user,
        }
      }
    }
    return null
  }

  async function handleEndAssignment() {
    if (!companyId || !groupId || !assignmentToEnd || submitting) return

    try {
      setSubmitting(true)
      const userId = user?.id || 'current-user-id'
      await endAssignmentMutation.mutateAsync({
        assignmentId: assignmentToEnd,
        endAt: new Date().toISOString(),
        userId,
      })
      setEndAssignmentDialogOpen(false)
      setAssignmentToEnd(null)
    } catch (error) {
      console.error('Error ending assignment:', error)
    } finally {
      setSubmitting(false)
    }
  }

  function getUserName(userId: string): string {
    const user = users.find(u => u.id === userId)
    return user?.name || 'Unknown User'
  }


  // Filter out users who are already assigned to the selected position
  const availableUsers = useMemo(() => {
    if (!selectedPosition) {
      return users
    }

    // Get current assignments for the selected position
    const positionAssignments = assignments.find(a => a.position.id === selectedPosition.id)
    const assignedUserIds = new Set(
      positionAssignments?.currentAssignments.map(a => a.userId) || []
    )

    // Filter out users who are already assigned
    return users.filter(user => !assignedUserIds.has(user.id))
  }, [users, selectedPosition, assignments])

  // Filter assignments table by user name, email, or position title/code
  const filteredAssignments = useMemo(() => {
    const term = userSearch.trim().toLowerCase()
    if (!term) return assignments
    return assignments.filter(({ position, assignedUsers }) => {
      const positionMatches =
        (position.title || '').toLowerCase().includes(term) ||
        (position.code || '').toLowerCase().includes(term)
      const userMatches = assignedUsers.some(
        u =>
          (u.name || '').toLowerCase().includes(term) ||
          (u.email || '').toLowerCase().includes(term)
      )
      return positionMatches || userMatches
    })
  }, [assignments, userSearch])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-muted-foreground">
            Assign people to positions and track assignment history
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by user, email, or position..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Assign Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Assign User to Position
              {selectedPosition && ` - ${selectedPosition.title}`}
            </DialogTitle>
            <DialogDescription>
              {selectedPosition ? (
                <>
                  Assign a user to this position.
                  <br />
                  Currently assigned: {assignments.find(a => a.position.id === selectedPosition.id)?.currentAssignments.length || 0} users
                </>
              ) : (
                'Assign a user to this position.'
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user">Select User *</Label>
              {availableUsers.length === 0 ? (
                <div className="rounded-md border border-input bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
                  {users.length === 0 ? (
                    "No users found. Please create users first in the Users section."
                  ) : (
                    "All users are already assigned to this position."
                  )}
                </div>
              ) : (
                <UserSelect
                  users={availableUsers}
                  value={formData.userId}
                  onValueChange={(value) => setFormData({ ...formData, userId: value })}
                  placeholder="Search and select a user..."
                  disabled={submitting}
                />
              )}
              {availableUsers.length === 0 && users.length > 0 && (
                <p className="text-xs text-amber-600">
                  ⚠️ All available users are already assigned to this position. End an existing assignment to assign a different user.
                </p>
              )}
              {users.length === 0 && (
                <p className="text-xs text-amber-600">
                  ⚠️ No users available. Create users in the Settings → Users section before assigning positions.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assignmentType">Assignment Type</Label>
                <Select
                  value={formData.assignmentType}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, assignmentType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">Permanent</SelectItem>
                    <SelectItem value="temporary">Temporary</SelectItem>
                    <SelectItem value="acting">Acting</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startAt">Start Date *</Label>
                <Input
                  id="startAt"
                  type="date"
                  value={formData.startAt}
                  onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                  required
                />
              </div>
            </div>

            {formData.assignmentType !== 'permanent' && (
              <div className="space-y-2">
                <Label htmlFor="endAt">End Date (Optional)</Label>
                <Input
                  id="endAt"
                  type="date"
                  value={formData.endAt}
                  onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                />
              </div>
            )}


            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this assignment..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Assigning...
                  </>
                ) : (
                  'Assign User'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* End Assignment Confirmation Dialog */}
      <AlertDialog open={endAssignmentDialogOpen} onOpenChange={setEndAssignmentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center justify-center mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <X className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <AlertDialogTitle>End assignment</AlertDialogTitle>
            <AlertDialogDescription asChild>
              {assignmentToEnd ? (() => {
                const details = getAssignmentDetails(assignmentToEnd)
                if (details) {
                  const { user, position } = details
                  return (
                    <p>
                      Are you sure you want to end <strong>{user?.name || 'Unknown User'}'s</strong> assignment to the position <strong>{position.title}</strong>?
                    </p>
                  )
                }
                return <p>Are you sure you want to end this assignment?</p>
              })() : <p>Are you sure you want to end this assignment?</p>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndAssignment}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? 'Ending...' : 'End Assignment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Assignment History
              {selectedPosition && ` - ${selectedPosition.title}`}
            </DialogTitle>
            <DialogDescription>
              View all past and current assignments for this position
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {assignmentHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No assignment history available
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignmentHistory.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">
                        {getUserName(assignment.userId)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{assignment.assignmentType}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(assignment.startAt)}</TableCell>
                      <TableCell>
                        {assignment.endAt ? formatDate(assignment.endAt) : 'Current'}
                      </TableCell>
                      <TableCell>{assignment.reason}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            assignment.status === 'active'
                              ? 'default'
                              : assignment.status === 'ended'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {assignment.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading assignments...</p>
        </div>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <UserCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No positions available</p>
            <p className="text-muted-foreground mb-4">
              Create positions first before assigning users
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardDescription>
              {userSearch.trim()
                ? `Showing ${filteredAssignments.length} of ${assignments.length} positions`
                : 'Current assignments and vacant positions'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[calc(100vh-400px)] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Position</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Assigned People</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.length === 0 && userSearch.trim() ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No positions or users match &quot;{userSearch.trim()}&quot;. Try a different search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAssignments.map(({ position, currentAssignments, assignedUsers }) => (
                      <TableRow key={position.id}>
                        <TableCell className="font-medium">{position.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{position.code}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{currentAssignments.length} users</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            {currentAssignments.length > 0 ? (
                              currentAssignments.map((assignment) => {
                                const user = assignedUsers.find(u => u.id === assignment.userId)
                                if (!user) {
                                  return (
                                    <div key={assignment.id} className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/30 rounded">
                                      <UserCheck className="w-4 h-4 text-orange-500" />
                                      <p className="text-xs text-orange-600 dark:text-orange-400">User not found</p>
                                    </div>
                                  )
                                }
                                return (
                                  <div key={assignment.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                                      {user.avatar ? (
                                        <img
                                          src={user.avatar}
                                          alt={user.name}
                                          className="w-8 h-8 rounded-full object-cover"
                                        />
                                      ) : (
                                        user.name.charAt(0).toUpperCase()
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm truncate">{user.name}</p>
                                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                      {assignment.assignmentType}
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEndAssignmentClick(assignment.id)}
                                      disabled={submitting}
                                      className="h-6 w-6 p-0"
                                      title="End assignment"
                                    >
                                      <span className="text-xs">×</span>
                                    </Button>
                                  </div>
                                )
                              })
                            ) : (
                              <Badge variant="secondary">No assignments</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewHistory(position)}
                            >
                              <History className="h-4 h-4 mr-1" />
                              History
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleAssignClick(position)}
                            >
                              <Plus className="h-4 h-4 mr-1" />
                              Assign
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )
      }
    </div >
  )
}

