'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { User } from '@/types'
import { getOrgUnits, getPositions, assignUserToPosition, getCurrentAssignments, endPositionAssignment, getCurrentAssignmentForUser } from '@/lib/services'
import { useCompany } from '@/contexts/CompanyContext'
import type { OrgUnit, Position } from '@/types/org-schema'
import { useUserMutations } from '@/hooks/queries/useUserQueries'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'

// Constant for optional select items (cannot use empty string)
const OPTIONAL_SELECT_NONE = 'OPTIONAL_SELECT_NONE'

// Role dropdown only has admin, manager, employee. Map owner/group_admin -> admin so the Select can display.
const EDITABLE_ROLES = ['admin', 'manager', 'employee'] as const
type EditableRole = typeof EDITABLE_ROLES[number]
function roleForSelect(role: string | undefined): EditableRole {
  const r = (role ?? '').toLowerCase().trim()
  if (r === 'owner' || r === 'group_admin') return 'admin'
  if (EDITABLE_ROLES.includes(r as EditableRole)) return r as EditableRole
  return 'employee'
}

interface EditUserDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  onUserUpdated: (updatedUser: User) => void
}

export function EditUserDrawer({
  open,
  onOpenChange,
  user,
  onUserUpdated,
}: EditUserDrawerProps) {
  const { companyId, groupId } = useCompany()
  const { user: currentUser } = useAuthStore()

  const [loading, setLoading] = useState(false)
  const [positions, setPositions] = useState<Position[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [initialPositionId, setInitialPositionId] = useState(OPTIONAL_SELECT_NONE)
  const [hasActualAssignment, setHasActualAssignment] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'employee' as string,
    position: OPTIONAL_SELECT_NONE,
    designation: '',
    phone: '',
  })

  // Track which user we last synced so we can reset synchronously during render
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null)
  if (open && user && syncedUserId !== user.id) {
    setSyncedUserId(user.id)
    setFormData({
      name: user.name || '',
      email: user.email || '',
      role: roleForSelect(user.role),
      position: OPTIONAL_SELECT_NONE,
      designation: user.designation || '',
      phone: user.contact?.phone || '',
    })
  }

  const { updateUser } = useUserMutations(companyId || undefined, groupId ?? undefined)

  // Load org units and positions when drawer opens
  useEffect(() => {
    if (open && companyId) {
      loadOrgUnitsAndPositions()
    }
  }, [open, companyId])

  async function loadOrgUnitsAndPositions() {
    if (!companyId) return
    try {
      setLoadingData(true)
      const positionsData = await getPositions(companyId, groupId ?? undefined)
      setPositions(positionsData)
    } catch (error) {
      console.error('Error loading positions:', error)
      toast.error('Failed to load data')
    } finally {
      setLoadingData(false)
    }
  }

  // Load position assignment and update position field once positions are available
  useEffect(() => {
    async function loadUserAssignment() {
      if (!user || !companyId || positions.length === 0) return
      setLoadingData(true)
      try {
        const activeAssignment = await getCurrentAssignmentForUser(companyId, user.id, groupId ?? undefined)
        const actualPositionId = activeAssignment?.positionId ||
          (user.position ? (positions.find(p => p.title === user.position)?.id || OPTIONAL_SELECT_NONE) : OPTIONAL_SELECT_NONE)

        setHasActualAssignment(!!activeAssignment)
        setInitialPositionId(actualPositionId)
        setFormData(prev => ({
          ...prev,
          position: actualPositionId,
        }))
      } catch (err) {
        console.error('Error loading user assignment:', err)
      } finally {
        setLoadingData(false)
      }
    }
    loadUserAssignment()
  }, [user, positions, companyId])

  const filteredPositions = positions

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId || !user || !currentUser?.id) return

    if (!formData.name || !formData.email || !formData.role) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      setLoading(true)
      const positionId = formData.position === OPTIONAL_SELECT_NONE ? '' : formData.position

      const positionChanged = positionId && positionId !== OPTIONAL_SELECT_NONE && positionId !== initialPositionId
      const selectedPosition = positions.find(p => p.id === formData.position)

      const updates: Partial<User> = {
        name: formData.name,
        email: formData.email,
        role: formData.role as 'admin' | 'manager' | 'employee',
        contact: {
          phone: formData.phone,
          slack: '',
        },
        designation: formData.designation || selectedPosition?.title || '',
      }

      // Only update position profile if changed. The positionCode is handled by assignUserToPosition.
      if (positionChanged || (!initialPositionId && positionId)) {
        updates.position = selectedPosition?.title || ''
      }

      await updateUser.mutateAsync({ userId: user.id, data: updates })
      const needsAssignmentCreation = positionId && positionId !== OPTIONAL_SELECT_NONE && !hasActualAssignment

      if (positionChanged || needsAssignmentCreation) {
        try {
          if (positionChanged && initialPositionId && initialPositionId !== OPTIONAL_SELECT_NONE && hasActualAssignment) {
            const existingAssignments = await getCurrentAssignments(companyId, initialPositionId, groupId ?? undefined)
            const userExistingAssignment = existingAssignments.find(a => a.userId === user.id)
            if (userExistingAssignment) {
              await endPositionAssignment(companyId, userExistingAssignment.id, new Date().toISOString(), currentUser.id, groupId ?? undefined)
            }
          }

          const newPositionAssignments = await getCurrentAssignments(companyId, positionId, groupId ?? undefined)
          const alreadyAssigned = newPositionAssignments.find(a => a.userId === user.id)

          if (!alreadyAssigned) {
            const { positionCode: assignedPositionCode } = await assignUserToPosition(
              companyId,
              positionId,
              user.id,
              {
                assignmentType: 'permanent',
                startAt: new Date().toISOString(),
                endAt: null,
                reason: needsAssignmentCreation && !positionChanged
                  ? 'Assignment created to match user profile (was missing)'
                  : 'Position updated from user profile',
                notes: needsAssignmentCreation && !positionChanged
                  ? 'Auto-created: User had position string but no assignment document'
                  : 'Position assigned via user profile edit',
                designation: formData.designation,
              },
              currentUser.id,
              groupId ?? undefined
            )

            // Invalidate users list to ensure consistency across the app
            const { useQueryClient } = await import('@tanstack/react-query')
            // Note: In an event handler we use queryClient.invalidateQueries directly
            // but we need access to it. We'll rely on the existing refresh logic below.
          }
        } catch (assignmentError: any) {
          console.error('Error updating position assignment:', assignmentError)
          throw assignmentError
        }
      } else if ((!positionId || positionId === OPTIONAL_SELECT_NONE) && initialPositionId && initialPositionId !== OPTIONAL_SELECT_NONE && hasActualAssignment) {
        try {
          const existingAssignments = await getCurrentAssignments(companyId, initialPositionId, groupId ?? undefined)
          const userExistingAssignment = existingAssignments.find(a => a.userId === user.id)
          if (userExistingAssignment) {
            await endPositionAssignment(companyId, userExistingAssignment.id, new Date().toISOString(), currentUser.id, groupId ?? undefined)
          }
        } catch (assignmentError) {
          console.error('Error ending position assignment:', assignmentError)
        }
      }

      const { UserService } = await import('@/lib/services')
      const refreshedUser = await UserService.getUser(companyId, user.id, groupId ?? undefined)
      if (refreshedUser) {
        onUserUpdated(refreshedUser)
        // If editing the currently logged-in user, update authStore so profile page reflects changes
        if (currentUser && user.id === currentUser.id) {
          useAuthStore.getState().setUser(refreshedUser)
        }
        toast.success('User updated successfully')
        onOpenChange(false)
      }
    } catch (error: any) {
      console.error('Error updating user:', error)
      toast.error(error.message || 'Failed to update user')
    } finally {
      setLoading(false)
    }
  }

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '')
    let formatted = digits
    if (digits && !digits.startsWith('91')) {
      formatted = '91' + digits
    }
    if (formatted.length > 2) {
      formatted = '+' + formatted.substring(0, 2) + ' ' + formatted.substring(2, 12)
    } else if (formatted.length > 0) {
      formatted = '+' + formatted
    }
    setFormData(prev => ({ ...prev, phone: formatted }))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Edit User</SheetTitle>
          <SheetDescription>
            Update user information and permissions.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-4 pb-6 border-b border-border">
              <h3 className="text-base font-semibold text-foreground mb-4">Basic Information</h3>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring bg-muted text-foreground"
                  required
                  disabled
                />
                <p className="text-xs text-muted-foreground mt-1.5">Email cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Role *
                </label>
                <Select
                  value={formData.role || 'employee'}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                  required
                >
                  <SelectTrigger className="bg-background text-foreground border-border">
                    <SelectValue placeholder="Select role *" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 pb-6 border-b border-border">
              <h3 className="text-base font-semibold text-foreground mb-4">Role & Position</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Position
                  </label>
                  <Select
                    value={formData.position}
                    onValueChange={(value) => {
                      const selectedPos = filteredPositions.find(p => p.id === value)
                      setFormData(prev => ({
                        ...prev,
                        position: value,
                        designation: value === OPTIONAL_SELECT_NONE ? '' : (prev.designation && prev.designation !== '' ? prev.designation : (selectedPos?.title || ''))
                      }))
                    }}
                    disabled={loadingData}
                  >
                    <SelectTrigger className="bg-background text-foreground border-border">
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={OPTIONAL_SELECT_NONE}>None</SelectItem>
                      {filteredPositions.map((pos) => (
                        <SelectItem key={pos.id} value={pos.id}>
                          {pos.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
                    placeholder="Enter designation"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">Defaults to position title if empty</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 pb-6">
              <h3 className="text-base font-semibold text-foreground mb-4">Contact Information</h3>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
                  placeholder="+91 9876543210"
                />
                <p className="text-xs text-muted-foreground mt-1">Format: +91 followed by 10-digit number</p>
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-border">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />}
                {loading ? 'Updating...' : 'Update User'}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
