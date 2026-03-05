'use client'

import { useState, useMemo } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCompanyConfig } from '@/hooks/useCompanyConfig'
import { User } from '@/types'
import { useCompany } from '@/contexts/CompanyContext'
import { ViewToggle, ViewType } from '@/components/ui/view-toggle'
import { ActionMenu, createViewAction, createEditAction, createDeleteAction } from '@/components/ui/action-menu'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AddUserDrawer, EditUserDrawer, UserProfileView, BulkUserUploadDialog } from '@/components/features/users'
import { Users, Plus, Mail, Phone, MessageSquare, Search, X, Upload, Trash2 } from 'lucide-react'
import { useUsersQuery, useUserMutations } from '@/hooks/queries/useUserQueries'
import { usePositionsQuery, useActiveAssignmentsQuery } from '@/hooks/queries/useOrgQueries'
import { useAuthStore } from '@/store/authStore'
import { toTitleCase } from '@/lib/utils/string-utils'
import toast from 'react-hot-toast'



export default function PeoplePage() {
  const { companyId, groupId, isLoading: companyLoading } = useCompany()
  const { user: authUser } = useAuthStore()
  const companyConfig = useCompanyConfig()

  const [viewType, setViewType] = useState<ViewType>('table')
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    user: User | null
  }>({ open: false, user: null })
  const [addUserDrawerOpen, setAddUserDrawerOpen] = useState(false)
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false)
  const [editUserDrawer, setEditUserDrawer] = useState<{
    open: boolean
    user: User | null
  }>({ open: false, user: null })
  const [viewUserProfile, setViewUserProfile] = useState<{
    open: boolean
    user: User | null
  }>({ open: false, user: null })
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)

  // TanStack Query – load users from enterprise path when groupId is set (from CompanyContext)
  // Use authUser.enterpriseGroupId as fallback (matching AssignmentManagement pattern)
  const effectiveGroupId = groupId ?? authUser?.enterpriseGroupId ?? null
  const { data: usersFromQuery = [], isLoading: usersLoading, refetch } = useUsersQuery(companyId || undefined, effectiveGroupId ?? undefined, {
    mergeCompanyProfiles: true
  })
  const { deleteUser, createUser, updateUser } = useUserMutations(companyId || undefined, effectiveGroupId ?? undefined)

  // Fetch active assignments and positions to dynamically resolve "Unknown Position"
  // Note: effectiveGroupId is required for the correct Firestore path; skip until it's available
  const { data: positions = [], isLoading: positionsLoading } = usePositionsQuery(companyId || undefined, effectiveGroupId ?? undefined, undefined)
  const { data: activeAssignmentsList = [], isLoading: assignmentsLoading } = useActiveAssignmentsQuery(companyId || undefined, effectiveGroupId ?? undefined, { enabled: !!companyId && !!effectiveGroupId })

  // Ensure current user is in the list and enrich all users with direct database position data if missing/inaccurate
  const users = useMemo(() => {
    let list = [...usersFromQuery]
    if (authUser?.id && !list.some(u => u.id === authUser.id)) {
      list.unshift({
        id: authUser.id,
        email: authUser.email ?? '',
        name: authUser.name ?? 'You',
        role: authUser.role ?? 'employee',
        companyId: authUser.companyId ?? '',
        position: authUser.position ?? '',
        orgUnitId: authUser.orgUnitId,
        orgUnitName: authUser.orgUnitName,
        avatar: authUser.avatar,
        skills: authUser.skills ?? [],
        contact: authUser.contact ?? { phone: '', slack: '' },
        createdAt: authUser.createdAt ?? new Date().toISOString(),
        updatedAt: authUser.updatedAt ?? new Date().toISOString(),
      } as User)
    }

    // Map database assignments to user if they have an "Unknown Position" or blank position
    // Only enrich after all data has loaded to prevent premature 'Unassigned' labelling
    const assignmentsReady = !assignmentsLoading && !positionsLoading

    list = list.map(u => {
      let displayPosition = u.position
      let displayDesignation = u.designation
      let displayPositionCode = u.positionCode

      // Only try to fix if position looks missing/wrong
      if (!displayPosition || displayPosition === 'Unknown Position' || displayPosition === 'Unassigned') {
        if (assignmentsReady) {
          const assignment = activeAssignmentsList.find(a => a.userId === u.id)
          if (assignment) {
            const position = positions.find(p => p.id === assignment.positionId)
            if (position) {
              displayPosition = position.title
              displayDesignation = (assignment as any).designation || position.title
              // Use position.code as fallback when user has no positionCode
              if (!displayPositionCode) {
                displayPositionCode = position.code
              }
              return {
                ...u,
                position: displayPosition,
                designation: displayDesignation,
                positionCode: displayPositionCode,
              }
            }
          } else {
            // Assignments loaded and this user has none
            displayPosition = 'Unassigned'
            displayDesignation = ''
          }
        }
        // If still loading: keep the display value as-is (don't override yet)
      } else if (!displayPositionCode && assignmentsReady) {
        // Position text is already correct but positionCode is missing — try to fill from DB
        const assignment = activeAssignmentsList.find(a => a.userId === u.id)
        if (assignment) {
          const position = positions.find(p => p.id === assignment.positionId)
          if (position) {
            displayPositionCode = position.code
          }
        }
      }

      return {
        ...u,
        position: displayPosition,
        designation: displayDesignation,
        positionCode: displayPositionCode,
      }
    })

    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [usersFromQuery, authUser, activeAssignmentsList, positions, assignmentsLoading, positionsLoading])

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-amber-100 text-amber-700'
      case 'admin':
        return 'bg-purple-100 text-purple-700'
      case 'manager':
        return 'bg-blue-100 text-blue-700'
      case 'employee':
        return 'bg-success/10 text-success'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const handleDeleteUser = async (user: User) => {
    if (!companyId) return

    try {
      await deleteUser.mutateAsync(user.id)
      toast.success(`${user.name} has been deleted successfully`)
      setDeleteDialog({ open: false, user: null })
    } catch (error) {
      console.error('Error deleting user:', error)
    }
  }

  const handleViewUser = (user: User) => {
    setViewUserProfile({ open: true, user })
  }

  const handleEditUser = (user: User) => {
    setEditUserDrawer({ open: true, user })
  }

  // Filter users based on search term (name and email) and role
  const filteredUsers = users
    .filter(
      user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.designation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.position || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(user => roleFilter === 'all' || user.role === roleFilter)

  const allFilteredIds = new Set(filteredUsers.map(u => u.id))
  const isAllSelected = filteredUsers.length > 0 && allFilteredIds.size === selectedIds.size && [...allFilteredIds].every(id => selectedIds.has(id))
  const isSomeSelected = selectedIds.size > 0

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredUsers.map(u => u.id)))
    }
  }

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (!companyId || selectedIds.size === 0) return
    try {
      for (const id of selectedIds) {
        await deleteUser.mutateAsync(id)
      }
      toast.success(`${selectedIds.size} user(s) deleted successfully`)
      setSelectedIds(new Set())
      setBulkDeleteDialogOpen(false)
    } catch (error) {
      console.error('Error deleting users:', error)
      toast.error('Failed to delete some users')
    }
  }

  const loading = companyLoading || usersLoading || positionsLoading || assignmentsLoading

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout contentClassName="overflow-hidden flex flex-col" contentAreaOverflowHidden>
      <div className="pt-6 flex-1 flex flex-col min-h-0 space-y-6">
        {/* Header Section - Static */}
        <div className="flex-shrink-0 flex items-center justify-between">
          <div>
            <p className="text-muted-foreground">Manage your {companyConfig.name} team members</p>
          </div>
          <div className="flex items-center gap-4">
            <ViewToggle currentView={viewType} onViewChange={setViewType} />
            <Button variant="outline" onClick={() => setBulkUploadDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload
            </Button>
            <Button onClick={() => setAddUserDrawerOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>

        {/* Stats Overview - Static */}
        <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-card rounded-lg border shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold text-card-foreground">{users.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </div>

          <div className="bg-card rounded-lg border shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold text-success">{users.length}</p>
              </div>
              <Users className="h-8 w-8 text-success" />
            </div>
          </div>


        </div>

        {/* Search and filters - Static */}
        <div className="flex-shrink-0 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Search by name or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
            </SelectContent>
          </Select>
          {isSomeSelected && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete selected ({selectedIds.size})
            </Button>
          )}
        </div>

        {/* User List - Scrollable */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="bg-card rounded-lg border shadow-sm flex flex-col h-full overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex-shrink-0 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-card-foreground">
                Team Members {(searchTerm || roleFilter !== 'all') && `(${filteredUsers.length} of ${users.length})`}
              </h2>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar">
              {viewType === 'table' ? (
                <div className="overflow-x-auto min-h-full">
                  <table className="w-full min-w-[1000px] table-fixed">
                    <colgroup>
                      <col style={{ width: 64 }} />
                      <col style={{ width: 180 }} />
                      <col style={{ width: 220 }} />
                      <col style={{ width: 150 }} />
                      <col style={{ width: 120 }} />
                      <col style={{ width: 300 }} />
                      <col style={{ width: 160 }} />
                      <col style={{ width: 100 }} />
                    </colgroup>
                    <thead className="sticky top-0 bg-card z-10">
                      <tr className="border-b border-border">
                        <th className="text-left py-4 px-6 bg-card w-12 sticky left-0 z-20 border-r">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all"
                          />
                        </th>
                        <th className="text-left py-4 px-4 font-medium text-muted-foreground bg-card sticky left-[64px] z-20 border-r">Name</th>
                        <th className="text-left py-4 px-6 font-medium text-muted-foreground bg-card">Designation</th>
                        <th className="text-left py-4 px-6 font-medium text-muted-foreground bg-card">Position ID</th>
                        <th className="text-left py-4 px-6 font-medium text-muted-foreground bg-card">Role</th>
                        <th className="text-left py-4 px-6 font-medium text-muted-foreground bg-card">Email</th>
                        <th className="text-left py-4 px-4 font-medium text-muted-foreground bg-card">Phone</th>
                        <th className="text-left py-4 px-6 font-medium text-muted-foreground bg-card w-20 sticky right-0 z-20 border-l shadow-[[-4px_0_4px_rgba(0,0,0,0.05)]]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-12">
                            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-card-foreground mb-2">No Users Found</h3>
                            <p className="text-muted-foreground mb-4">
                              {searchTerm ? 'Try adjusting your search terms.' : 'Get started by adding your first team member.'}
                            </p>
                            {searchTerm && (
                              <Button variant="outline" onClick={() => setSearchTerm('')}>
                                Clear Search
                              </Button>
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => (
                          <tr key={user.id} className="border-b border-border hover:bg-muted/50 align-top group">
                            <td className="py-4 px-6 w-12 align-middle sticky left-0 bg-card/95 backdrop-blur-sm z-10 border-r group-hover:bg-muted/95">
                              <Checkbox
                                checked={selectedIds.has(user.id)}
                                onCheckedChange={() => toggleSelectOne(user.id)}
                                aria-label={`Select ${user.name}`}
                              />
                            </td>
                            <td className="py-4 px-4 align-middle sticky left-[64px] bg-card/95 backdrop-blur-sm z-10 border-r group-hover:bg-muted/95">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 shrink-0 rounded-full bg-muted flex items-center justify-center">
                                  {user.avatar ? (
                                    <img
                                      src={user.avatar}
                                      alt={user.name}
                                      className="w-8 h-8 rounded-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-sm font-medium text-muted-foreground">
                                      {user.name.charAt(0)}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium text-card-foreground truncate" title={user.name}>{toTitleCase(user.name)}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6 align-middle">
                              <div className="text-sm font-medium text-card-foreground line-clamp-3 leading-tight overflow-hidden" title={user.designation || user.position}>
                                {toTitleCase(user.designation || user.position)}
                              </div>
                            </td>
                            <td className="py-4 px-6 align-middle">
                              {user.positionCode ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded border border-[#FDE68A] bg-[#FFF9EB] text-[#B7791F] text-[11px] font-mono font-medium whitespace-nowrap">
                                  {user.positionCode}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/30">---</span>
                              )}
                            </td>
                            <td className="py-4 px-6 align-middle">
                              <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${getRoleColor(user.role)}`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-muted-foreground align-middle min-w-0">
                              <span className="block whitespace-nowrap" title={user.email}>{user.email}</span>
                            </td>
                            <td className="py-4 px-4 text-muted-foreground align-middle whitespace-nowrap">
                              {user.contact?.phone || 'Not provided'}
                            </td>
                            <td className="py-4 px-6 w-20 align-middle sticky right-0 bg-card/95 backdrop-blur-sm z-10 border-l shadow-[[-4px_0_4px_rgba(0,0,0,0.05)]] group-hover:bg-muted/95">
                              <ActionMenu
                                items={[
                                  createViewAction(() => handleViewUser(user)),
                                  createEditAction(() => handleEditUser(user)),
                                  createDeleteAction(() => setDeleteDialog({ open: true, user }))
                                ]}
                                size="sm"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-card-foreground mb-2">No Users Found</h3>
                      <p className="text-muted-foreground mb-4">
                        {searchTerm ? 'Try adjusting your search terms.' : 'Get started by adding your first team member.'}
                      </p>
                      {searchTerm ? (
                        <Button variant="outline" onClick={() => setSearchTerm('')}>
                          Clear Search
                        </Button>
                      ) : (
                        <Button onClick={() => setAddUserDrawerOpen(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add First User
                        </Button>
                      )}
                    </div>
                  ) : (
                    filteredUsers.map((user) => (
                      <div key={user.id} className="border border-border rounded-lg p-6 hover:shadow-md transition-shadow bg-card">
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0 pt-1">
                            <Checkbox
                              checked={selectedIds.has(user.id)}
                              onCheckedChange={() => toggleSelectOne(user.id)}
                              aria-label={`Select ${user.name}`}
                            />
                          </div>
                          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                            {user.avatar ? (
                              <img
                                src={user.avatar}
                                alt={user.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-lg font-medium text-muted-foreground">
                                {user.name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="font-medium text-card-foreground">{toTitleCase(user.name)}</h3>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(user.role)}`}>
                                {user.role}
                              </span>
                            </div>
                            <div className="flex flex-col mb-1">
                              <p className="text-sm font-medium text-foreground line-clamp-3 leading-tight mb-0.5">{toTitleCase(user.designation || user.position)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {user.positionCode && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-[#FDE68A] bg-[#FFF9EB] text-[#B7791F] text-[10px] font-mono font-medium whitespace-nowrap">
                                  {user.positionCode}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                              <div className="flex items-center space-x-1">
                                <Mail className="w-4 h-4" />
                                <span>{user.email}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Phone className="w-4 h-4" />
                                <span>{user.contact?.phone || 'Not provided'}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <MessageSquare className="w-4 h-4" />
                                <span>{user.contact?.slack || 'Not provided'}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(Array.isArray(user.skills) ? user.skills : []).map((skill, index) => (
                                <span key={index} className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <ActionMenu
                              items={[
                                createViewAction(() => handleViewUser(user)),
                                createEditAction(() => handleEditUser(user)),
                                createDeleteAction(() => setDeleteDialog({ open: true, user }))
                              ]}
                              size="sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog - single delete */}
      <ConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, user: null })}
        title="Delete User"
        description={`Are you sure you want to delete ${deleteDialog.user?.name}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={() => deleteDialog.user && handleDeleteUser(deleteDialog.user)}
      />

      {/* Confirmation Dialog - bulk delete */}
      <ConfirmationDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title="Delete selected users"
        description={`Are you sure you want to delete ${selectedIds.size} user(s)? This action cannot be undone.`}
        confirmText="Delete all"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleBulkDelete}
      />

      {/* Add User Drawer */}
      <AddUserDrawer
        open={addUserDrawerOpen}
        onOpenChange={setAddUserDrawerOpen}
        onUserAdded={() => {
          // Success is handled by TanStack Query invalidation
        }}
      />

      {/* Edit User Drawer */}
      <EditUserDrawer
        open={editUserDrawer.open}
        onOpenChange={(open) => setEditUserDrawer({ open, user: null })}
        user={editUserDrawer.user}
        onUserUpdated={() => {
          // Success is handled by TanStack Query invalidation
        }}
      />

      {/* View User Profile */}
      <UserProfileView
        open={viewUserProfile.open}
        onOpenChange={(open) => setViewUserProfile({ open, user: null })}
        user={viewUserProfile.user}
      />

      {/* Bulk User Upload Dialog */}
      <BulkUserUploadDialog
        open={bulkUploadDialogOpen}
        onOpenChange={setBulkUploadDialogOpen}
        onUsersAdded={() => {
          refetch()
        }}
      />
    </DashboardLayout >
  )
}
