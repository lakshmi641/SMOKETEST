'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WorkspaceService, ExternalNotificationService } from '@/lib/services'
import { UserService } from '@/lib/services/users/user-services'
import { getUsersByPosition } from '@/lib/services/org/org-services'
import { v4 as uuidv4 } from 'uuid'
import { PermissionService } from '@/lib/services/permission-service'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { X, Loader2, Users, FolderKanban, CheckCircle2, Eye, Lock, LockKeyhole, Crown, Shield, Key, Check } from 'lucide-react'
import type { Workspace } from '@/types/workspace-schema'
import type { User } from '@/types/index'
import type { Position } from '@/types/org-schema' // Import Position type
import toast from 'react-hot-toast'
import { useWorkspaceMutations } from '@/hooks/queries/useWorkspaceQueries'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MemberSelect } from '@/components/common/MemberSelect'
import { useProjectsQuery } from '@/hooks/queries/useProjectQueries'

interface WorkspaceFormProps {
  workspace?: Workspace | null
  onSave: (workspace: Workspace) => void | Promise<void>
  onCancel: () => void
}

export function WorkspaceForm({ workspace, onSave, onCancel }: WorkspaceFormProps) {
  const { groupId, companyId, currentCompany, currentCompanyUser } = useCompany()
  const { user: currentUser } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [positions, setPositions] = useState<Position[]>([]) // Add positions state
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [memberSearchOpen, setMemberSearchOpen] = useState(false)
  const [memberSearchValue, setMemberSearchValue] = useState('')

  // Initialize with current user as default member for new workspaces
  const getInitialMembers = () => {
    // Backward compatibility: check both old and new field names
    const oldSpocIds = (workspace as any)?.spocIds;
    const members = workspace?.members || oldSpocIds;
    if (members && Array.isArray(members)) {
      return members
    }
    // For new workspaces, add current user as default member
    if (!workspace && currentUser?.id) {
      return [currentUser.id]
    }
    return []
  }

  const getInitialOwnerId = () => {
    // Backward compatibility: check both old and new field names
    const oldAdminIds = (workspace as any)?.adminIds;
    const ownerId = workspace?.ownerId ||
      (Array.isArray(oldAdminIds) && oldAdminIds.length > 0 ? oldAdminIds[0] : null) ||
      workspace?.createdBy ||
      currentUser?.id ||
      '';
    return ownerId
  }

  const [formData, setFormData] = useState({
    name: workspace?.name || '',
    description: workspace?.description || '',
    teamName: workspace?.teamName || workspace?.name || '', // Use name as fallback
    ownerId: getInitialOwnerId(),
    members: getInitialMembers(),
    positionMembers: (workspace?.positionMembers || []) as string[],
    status: (workspace?.status || 'active') as 'active' | 'archived',
    visibility: (workspace?.visibility || 'standard') as 'standard' | 'confidential' | 'private' | 'secret',
  })

  useEffect(() => {
    const loadData = async () => {
      if (!companyId) return

      try {
        setLoadingUsers(true)
        const [usersData, positionsData] = await Promise.all([
          UserService.getUsers(companyId, groupId ?? undefined),
          import('@/lib/services/org/org-services').then(mod => mod.getPositions(companyId, groupId ?? undefined))
        ])
        setUsers(usersData)
        setPositions(positionsData)
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('Failed to load workspace data')
      } finally {
        setLoadingUsers(false)
      }
    }

    loadData()
  }, [companyId, groupId])



  // Add current user as default member and owner for new workspaces when currentUser becomes available
  useEffect(() => {
    if (!workspace && currentUser?.id) {
      setFormData(prev => {
        // Only add if not already included
        const updates: any = {}
        if (!prev.members.includes(currentUser.id!)) {
          updates.members = [...prev.members, currentUser.id!]
        }
        if (!prev.ownerId) {
          updates.ownerId = currentUser.id!
        }

        if (Object.keys(updates).length > 0) {
          return { ...prev, ...updates }
        }
        return prev
      })
    }
  }, [currentUser?.id, workspace])

  // Sync form data with workspace prop when it changes (essential for edit mode)
  useEffect(() => {
    if (workspace) {
      // Backward compatibility: check both old and new field names
      const oldAdminIds = (workspace as any).adminIds;
      const ownerId = workspace.ownerId ||
        (Array.isArray(oldAdminIds) && oldAdminIds.length > 0 ? oldAdminIds[0] : null) ||
        workspace.createdBy || '';

      const oldSpocIds = (workspace as any).spocIds;
      const members = workspace.members || oldSpocIds || [];

      setFormData(prev => ({
        ...prev,
        name: workspace.name || '',
        description: workspace.description || '',
        teamName: workspace.teamName || workspace.name || '',
        ownerId: ownerId,
        members: Array.isArray(members) ? members : [],
        positionMembers: workspace.positionMembers || [],
        status: (workspace.status || 'active') as 'active' | 'archived',
        visibility: (workspace.visibility || 'standard') as 'standard' | 'confidential' | 'private' | 'secret',
      }))
    }
  }, [workspace])

  const { data: allProjectsData = [] } = useProjectsQuery(
    companyId ?? undefined,
    groupId ?? undefined,
    currentUser?.id,
    currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'
  )

  const workspaceProjects = useMemo(
    () => workspace ? allProjectsData.filter(p => p.workspaceId === workspace.id) : [],
    [allProjectsData, workspace]
  )

  const { createWorkspace, updateWorkspace } = useWorkspaceMutations(groupId ?? undefined, companyId ?? undefined)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!companyId) {
      toast.error('Company ID is required')
      return
    }

    if (!formData.name.trim()) {
      toast.error('Workspace name is required')
      return
    }

    // Check permissions before updating workspace
    if (workspace) {
      const userId = currentUser?.id
      const isCreator = workspace.createdBy === userId
      const oldAdminIds = (workspace as any).adminIds || [];
      const ownerId = workspace.ownerId || (Array.isArray(oldAdminIds) && oldAdminIds.length > 0 ? oldAdminIds[0] : null);
      const isOwner = ownerId === userId;
      const isGlobalAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'
      const oldSpocIds = (workspace as any).spocIds || [];
      const members = workspace.members || oldSpocIds;
      const isMember = userId && Array.isArray(members) && members.includes(userId)

      if (!isCreator && !isOwner && !isGlobalAdmin && !isMember) {
        toast.error('You do not have permission to update this workspace. Only workspace owners, admins, and members can update workspaces.')
        return
      }
    }

    try {
      setLoading(true)

      let workspaceId: string

      if (workspace) {
        // Update existing workspace
        const updateData: Partial<Workspace> = {
          name: formData.name.trim(),
          description: formData.description.trim(),
          teamName: formData.teamName.trim(),
          ownerId: formData.ownerId || currentUser?.id || '',
          members: formData.members || [],
          positionMembers: formData.positionMembers || [],
          status: formData.status,
          visibility: formData.visibility,
        }

        await updateWorkspace.mutateAsync({ workspaceId: workspace.id, data: updateData })
        workspaceId = workspace.id
      } else {
        // Create new workspace
        const teamName = formData.teamName.trim() || formData.name.trim()
        const workspaceData: any = {
          name: formData.name.trim(),
          description: formData.description.trim() || '',
          teamName: teamName,
          ownerId: formData.ownerId || currentUser?.id || '',
          members: formData.members || [],
          positionMembers: formData.positionMembers || [],
          status: formData.status || 'active',
          visibility: formData.visibility || 'standard',
          tags: [],
          color: '#3b82f6',
          createdBy: currentUser?.id || '',
        }

        workspaceId = await createWorkspace.mutateAsync(workspaceData)
      }

      // Fetch the created/updated workspace (enterprise path)
      const savedWorkspace = groupId ? await WorkspaceService.getWorkspace(groupId, companyId, workspaceId) : null
      if (savedWorkspace) {
        await onSave(savedWorkspace)
      }
    } catch (error) {
      console.error('Error saving workspace:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleMember = (userId: string) => {
    const isSelected = formData.members.includes(userId)
    if (isSelected) {
      if (userId === formData.ownerId) {
        toast.error('You cannot remove the workspace owner')
        return
      }

      // Check if user is a member of any project in this workspace
      if (workspace) {
        const isInProject = workspaceProjects.some(p =>
          p.manager === userId || (Array.isArray(p.team) && p.team.includes(userId))
        )

        if (isInProject) {
          toast.error('Member is part of a project in this workspace. Remove as project member first.')
          return
        }
      }

      setFormData({
        ...formData,
        members: formData.members.filter(id => id !== userId)
      })
    } else {
      setFormData({
        ...formData,
        members: [...formData.members, userId]
      })
    }
  }

  const removeMember = (userId: string) => {
    // Don't allow removing the owner
    if (userId === formData.ownerId) {
      toast.error('You cannot remove the workspace owner')
      return
    }

    // Check if user is a member of any project in this workspace
    if (workspace) {
      const isInProject = workspaceProjects.some(p =>
        p.manager === userId || (Array.isArray(p.team) && p.team.includes(userId))
      )

      if (isInProject) {
        toast.error('Member is part of a project in this workspace. Remove as project member first.')
        return
      }
    }

    setFormData({
      ...formData,
      members: formData.members.filter(id => id !== userId)
    })
  }

  const changeOwner = (userId: string) => {
    // Check if the actor has authority to change owner
    const isGlobalAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'
    const isCurrentOwner = formData.ownerId === currentUser?.id
    const isCreator = workspace ? currentUser?.id === workspace.createdBy : true

    if (!isGlobalAdmin && !isCurrentOwner && !isCreator) {
      toast.error('Only workspace owners or global admins can change the owner')
      return
    }

    setFormData(prev => ({
      ...prev,
      ownerId: userId,
      // Ensure new owner is in members list
      members: prev.members.includes(userId) ? prev.members : [...prev.members, userId]
    }))
  }

  // Include current user in list so they appear as default member when not yet in company users
  const effectiveUsers = useMemo(() => {
    const list = [...users]
    if (currentUser?.id && !list.some(u => u.id === currentUser.id)) {
      list.unshift({
        id: currentUser.id,
        email: currentUser.email ?? '',
        name: currentUser.name ?? 'You',
        role: currentUser.role ?? 'employee',
        orgUnitId: currentUser.orgUnitId,
        orgUnitName: currentUser.orgUnitName,
        position: currentUser.position ?? '',
        avatar: currentUser.avatar ?? null,
        skills: currentUser.skills ?? [],
        contact: currentUser.contact ?? { phone: '', slack: '' },
      } as User)
    }
    return list
  }, [users, currentUser])

  const selectedMembers = effectiveUsers.filter(user => formData.members.includes(user.id))
  const availableMembers = effectiveUsers.filter(user => !formData.members.includes(user.id))

  const filteredMembers = memberSearchValue
    ? effectiveUsers.filter(user =>
      user.name?.toLowerCase().includes(memberSearchValue.toLowerCase()) ||
      user.email.toLowerCase().includes(memberSearchValue.toLowerCase())
    )
    : users

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-pink-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-teal-500',
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  return (
    <div className="flex gap-6 min-h-0 flex-1">
      {/* Left Side - Form (scrollable so action buttons are always reachable) */}
      <div className="flex-1 max-w-2xl min-w-0 flex flex-col min-h-0 overflow-y-auto max-h-[calc(100vh-6rem)]">
        <form onSubmit={handleSubmit} className="space-y-6 pb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              {workspace ? 'Edit Workspace' : 'Create a new workspace'}
            </h1>
            {!workspace && (
              <p className="text-sm text-muted-foreground">
                Set up a workspace for your team to collaborate on projects
              </p>
            )}
          </div>

          {/* Workspace Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Workspace name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder='For example: "Marketing" or "Design"'
              required
              className="w-full"
            />
          </div>

          {/* Members & Positions */}
          <div className="space-y-2">
            <Label>Workspace Members</Label>
            <MemberSelect
              // Not managing single selection value, acting as a picker
              onValueChange={(selected) => {
                if (!selected) return

                if (selected.type === 'user') {
                  toggleMember(selected.id)
                } else {
                  // Position selected - add position to positionMembers AND add users from position
                  const positionId = selected.id

                  // First, add the position itself to positionMembers
                  setFormData(prev => {
                    const newPositionMembers = prev.positionMembers.includes(positionId)
                      ? prev.positionMembers
                      : [...prev.positionMembers, positionId]

                    return {
                      ...prev,
                      positionMembers: newPositionMembers
                    }
                  })

                  // Then, auto-add users currently in this position
                  if (companyId) {
                    getUsersByPosition(companyId, positionId, groupId ?? undefined)
                      .then((assignedUserIds) => {
                        // Fallback: Check for users with matching position title in their profile
                        // This handles legacy data or cases where assignment record is missing but string is present
                        const position = positions.find(p => p.id === positionId)
                        const titleUserIds = (position && position.title)
                          ? effectiveUsers.filter(u => u.position === position.title).map(u => u.id)
                          : []

                        // Combine both sources
                        const userIds = Array.from(new Set([...(assignedUserIds || []), ...titleUserIds]))

                        if (userIds && userIds.length > 0) {
                          setFormData(prev => {
                            const newMembers = [...prev.members]
                            let addedCount = 0

                            userIds.forEach(uid => {
                              if (!newMembers.includes(uid)) {
                                newMembers.push(uid)
                                addedCount++
                              }
                            })

                            if (addedCount > 0) {
                              // Defer the toast to avoid "Cannot update a component while rendering a different component"
                              setTimeout(() => {
                                toast.success(`Added position and ${addedCount} user(s) from position`)
                              }, 0)
                              return {
                                ...prev,
                                members: newMembers
                              }
                            }
                            return prev // No changes
                          })
                        } else {
                          setTimeout(() => {
                            toast.success('Position added (no active users found for this position)')
                          }, 0)
                        }
                      })
                      .catch(err => {
                        console.error('Failed to fetch position users:', err)
                      })
                  }
                }
              }}
              placeholder="Search users or positions..."
              className="w-full"
            />

            {/* Selected Members Chips - scrollable when many */}
            {(selectedMembers.length > 0 || formData.positionMembers.length > 0) && (
              <div className="flex flex-wrap gap-2 mt-2 max-h-48 overflow-y-auto overflow-x-hidden rounded-md border bg-muted/30 p-2">
                {/* Standalone User Members (Those NOT in a selected position) */}
                {(() => {
                  // Get all user IDs that are part of selected positions
                  const positionUserIds = new Set<string>()
                  formData.positionMembers.forEach(posId => {
                    const position = positions.find(p => p.id === posId)
                    if (position) {
                      effectiveUsers.filter(u => u.position === position.title).forEach(u => positionUserIds.add(u.id))
                    }
                  })

                  return selectedMembers
                    .filter(user => !positionUserIds.has(user.id))
                    .map((user) => {
                      const isCurrentUser = user.id === currentUser?.id
                      return (
                        <Badge
                          key={user.id}
                          variant="secondary"
                          className="flex items-center gap-1.5 px-2 py-1"
                        >
                          {user.avatar ? (
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="w-4 h-4 rounded-full"
                            />
                          ) : (
                            <div className={cn(
                              "w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-medium",
                              getAvatarColor(user.name || user.email)
                            )}>
                              {getInitials(user.name || user.email)}
                            </div>
                          )}
                          <span className="text-xs">{user.name || user.email}</span>
                          {!isCurrentUser && (
                            <button
                              type="button"
                              onClick={() => removeMember(user.id)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </Badge>
                      )
                    })
                })()}

                {/* Position Members */}
                {formData.positionMembers.map((posId) => {
                  const position = positions.find(p => p.id === posId)
                  // Find users for this position
                  const positionUsers = effectiveUsers.filter(u => u.position === position?.title)
                  const userNames = positionUsers.map(u => u.name).join(', ')
                  const displayLabel = userNames
                    ? `${userNames} (${position?.title || posId})`
                    : position?.title || posId

                  return (
                    <Badge
                      key={posId}
                      variant="outline"
                      className="flex items-center gap-1.5 px-2 py-1 border-dashed border-purple-300 bg-purple-50"
                    >
                      <Users className="w-3 h-3 text-purple-600" />
                      <span className="text-xs font-medium text-purple-700">
                        {displayLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          positionMembers: prev.positionMembers.filter(id => id !== posId)
                        }))}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  )
                })}
              </div>
            )}
          </div>



          {/* Vertical Visibility (Inheritance Policy) */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-base font-medium">Visibility</Label>

            <div className="space-y-3">
              <label className={cn(
                "flex items-start gap-3 cursor-pointer group p-3 rounded-lg border-2 transition-all",
                formData.visibility === 'standard'
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}>
                <input
                  type="radio"
                  name="visibility"
                  value="standard"
                  checked={formData.visibility === 'standard'}
                  onChange={(e) => setFormData({ ...formData, visibility: e.target.value as 'standard' | 'confidential' | 'private' | 'secret' })}
                  className="mt-1 w-4 h-4 text-primary focus:ring-primary"
                />
                <div className="flex-1 flex items-start gap-2">
                  <Eye className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">Standard</div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Full recursive visibility. Access is inherited by the entire management chain up to the CEO.
                    </p>
                  </div>
                </div>
              </label>

              <label className={cn(
                "flex items-start gap-3 cursor-pointer group p-3 rounded-lg border-2 transition-all",
                formData.visibility === 'confidential'
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}>
                <input
                  type="radio"
                  name="visibility"
                  value="confidential"
                  checked={formData.visibility === 'confidential'}
                  onChange={(e) => setFormData({ ...formData, visibility: e.target.value as 'standard' | 'confidential' | 'private' | 'secret' })}
                  className="mt-1 w-4 h-4 text-primary focus:ring-primary"
                />
                <div className="flex-1 flex items-start gap-2">
                  <Lock className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">Confidential</div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Restricted inheritance. Only the Direct Manager inherits access. Blocked for Skip-Levels.
                    </p>
                  </div>
                </div>
              </label>

              <label className={cn(
                "flex items-start gap-3 cursor-pointer group p-3 rounded-lg border-2 transition-all",
                (formData.visibility === 'private' || formData.visibility === 'secret')
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}>
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={formData.visibility === 'private' || formData.visibility === 'secret'}
                  onChange={(e) => setFormData({ ...formData, visibility: e.target.value === 'private' ? 'private' : 'secret' as 'standard' | 'confidential' | 'private' | 'secret' })}
                  className="mt-1 w-4 h-4 text-primary focus:ring-primary"
                />
                <div className="flex-1 flex items-start gap-2">
                  <LockKeyhole className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">Private / Secret</div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Zero inheritance. Not visible to managers unless explicitly invited.
                    </p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {workspace ? 'Update workspace' : 'Create new workspace'}
            </Button>
          </div>
        </form>
      </div>

      {/* Right Side - Preview Panel (wider for 2-col member grid) */}
      <div className="w-96 border-l pl-6 flex-shrink-0 flex flex-col min-h-0 min-w-[20rem]">
        <div className="space-y-6 pb-6">
          {/* Members Section - 2 members per row, scrollable */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Workspace Members</h3>
              </div>
              {selectedMembers.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {selectedMembers.length}
                </span>
              )}
            </div>

            {/* Selected Members List - 2 per row, scrolls when many */}
            {(selectedMembers.length > 0 || formData.positionMembers.length > 0) ? (
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto overflow-x-hidden pr-1">
                {/* Users (Standalone only) */}
                {(() => {
                  // Get all user IDs that are part of selected positions
                  const positionUserIds = new Set<string>()
                  formData.positionMembers.forEach(posId => {
                    const position = positions.find(p => p.id === posId)
                    if (position) {
                      effectiveUsers.filter(u => u.position === position.title).forEach(u => positionUserIds.add(u.id))
                    }
                  })

                  return selectedMembers
                    .filter(user => !positionUserIds.has(user.id))
                    .map((user) => {
                      const isOwner = user.id === formData.ownerId
                      const isGlobalAdmin = user.role === 'admin' || user.role === 'owner'
                      const canManage = (formData.ownerId === currentUser?.id ||
                        currentCompanyUser?.role === 'owner' ||
                        currentCompanyUser?.role === 'admin')

                      return (
                        <div key={user.id} className="flex items-center gap-2 py-2 px-2 rounded-md border bg-card group min-w-0">
                          {user.avatar ? (
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="w-7 h-7 rounded-full flex-shrink-0"
                            />
                          ) : (
                            <div className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0",
                              getAvatarColor(user.name || user.email)
                            )}>
                              {getInitials(user.name || user.email)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{user.name || user.email}</p>
                            <div className="flex items-center gap-1 flex-wrap">
                              {isOwner && (
                                <Badge variant="outline" className="h-3.5 px-1 text-[9px] border-amber-500/50 text-amber-600 bg-amber-50 gap-0 shrink-0">
                                  <Crown className="w-2.5 h-2.5" />
                                </Badge>
                              )}
                              {isGlobalAdmin && (
                                <Badge variant="outline" className="h-3.5 px-1 text-[9px] border-red-500/50 text-red-600 bg-red-50 shrink-0">
                                  <Shield className="w-2.5 h-2.5" />
                                </Badge>
                              )}
                            </div>
                            {user.name && (
                              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                            )}
                          </div>
                          {canManage && !isOwner && (
                            <button
                              type="button"
                              onClick={() => changeOwner(user.id)}
                              title="Make Owner"
                              className={cn(
                                "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted flex-shrink-0",
                                "text-muted-foreground hover:text-amber-600"
                              )}
                            >
                              <Crown className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    })
                })()}

                {/* Positions */}
                {formData.positionMembers.map(posId => {
                  const position = positions.find(p => p.id === posId)
                  // Find users for this position
                  const positionUsers = effectiveUsers.filter(u => u.position === position?.title)
                  const userNames = positionUsers.map(u => u.name).join(', ')

                  return (
                    <div key={posId} className="flex items-center gap-2 py-2 px-2 rounded-md border bg-card min-w-0">
                      <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 border border-purple-200 flex-shrink-0">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {userNames || 'No users assigned'}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {position?.title || 'Position'}
                        </p>
                        <Badge variant="outline" className="h-3.5 px-1 text-[9px] border-purple-200 text-purple-600 bg-purple-50 mt-0.5">
                          Position
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-4">
                No members added yet
              </div>
            )}
          </div>

          {/* Projects Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Projects</h3>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3 py-2 opacity-50">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                  <FolderKanban className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="h-3 bg-muted rounded w-24 mb-1"></div>
                  <div className="h-2 bg-muted rounded w-16"></div>
                </div>
              </div>
              <div className="flex items-center gap-3 py-2 opacity-50">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                  <FolderKanban className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="h-3 bg-muted rounded w-24 mb-1"></div>
                  <div className="h-2 bg-muted rounded w-16"></div>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Projects will appear here once the workspace is created
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
