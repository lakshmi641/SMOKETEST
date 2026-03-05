'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Drawer, DrawerContent, DrawerFooter } from '@/components/ui/drawer'
import { useCompany } from '@/contexts/CompanyContext'
import { getPositions } from '@/lib/services'
import { User } from '@/types'
import type { Position } from '@/types/org-schema'
import { useUserMutations } from '@/hooks/queries/useUserQueries'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

// Constant for optional select items (cannot use empty string)
const OPTIONAL_SELECT_NONE = 'OPTIONAL_SELECT_NONE'

interface AddUserDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUserAdded: (user: User) => void
}

export function AddUserDrawer({ open, onOpenChange, onUserAdded }: AddUserDrawerProps) {
  const { companyId, groupId } = useCompany()

  const initialFormData = {
    name: '',
    email: '',
    password: '',
    role: '',
    position: OPTIONAL_SELECT_NONE,
    designation: '',
    phone: '',
  }

  const [loading, setLoading] = useState(false)
  const [positions, setPositions] = useState<Position[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState(initialFormData)

  const { createUser } = useUserMutations(companyId || undefined, groupId ?? undefined)

  const resetForm = useCallback(() => {
    setFormData(initialFormData)
    setShowPassword(false)
  }, [])

  // Load positions when drawer opens; reset form so each open starts fresh
  useEffect(() => {
    if (open && companyId) {
      resetForm()
      loadOrgUnitsAndPositions()
    }
  }, [open, companyId, resetForm])

  async function loadOrgUnitsAndPositions() {
    if (!companyId) return

    try {
      setLoadingData(true)
      const positionsData = await getPositions(companyId, groupId ?? undefined)
      setPositions(positionsData)
    } catch (error) {
      console.error('Error loading org units and positions:', error)
      toast.error('Failed to load data')
    } finally {
      setLoadingData(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!companyId) {
      toast.error('Company not found')
      return
    }

    // Basic validation
    if (!formData.name || !formData.email || !formData.password || !formData.role) {
      toast.error('Please fill in all required fields')
      return
    }

    if (!formData.email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long')
      return
    }

    try {
      setLoading(true)

      const positionId = formData.position === OPTIONAL_SELECT_NONE ? '' : formData.position
      const selectedPosition = positions.find(p => p.id === positionId)

      const userData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role as 'admin' | 'manager' | 'employee',
        position: selectedPosition?.title || '',
        designation: formData.designation || selectedPosition?.title || '',
        companyId: companyId,
        contact: {
          phone: formData.phone,
          slack: ''
        },
        skills: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const newUser = await createUser.mutateAsync(userData)

      // Also create the position assignment
      if (positionId && positionId !== OPTIONAL_SELECT_NONE) {
        try {
          const { assignUserToPosition } = await import('@/lib/services')
          const { useAuthStore } = await import('@/store/authStore')
          const currentUser = useAuthStore.getState().user

          const { assignment, positionCode: assignedPositionCode } = await assignUserToPosition(
            companyId,
            positionId,
            newUser.id,
            {
              assignmentType: 'permanent',
              startAt: new Date().toISOString(),
              reason: 'Initial assignment on user creation',
              notes: `Automatically assigned during user creation`,
              designation: formData.designation
            },
            currentUser?.id || 'system',
            groupId ?? undefined
          )

          // Update the new user object with the generated positionCode for immediate UI display
          newUser.positionCode = assignedPositionCode;
        } catch (assignError: any) {
          console.error('[AddUserDrawer] Failed to assign position:', assignError)
          toast.error(`User created, but position assignment failed: ${assignError.message}`)
        }
      }

      onUserAdded(newUser)
      resetForm()
      onOpenChange(false)
      toast.success('User created and assigned successfully!')
    } catch (error: any) {
      console.error('Error creating user:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const newFormData = { ...prev, [field]: value }

      // If position changes, default designation to position title if blank
      if (field === 'position' && value !== OPTIONAL_SELECT_NONE) {
        const selectedPos = positions.find(p => p.id === value)
        if (selectedPos && !prev.designation) {
          newFormData.designation = selectedPos.title
        }
      } else if (field === 'position' && value === OPTIONAL_SELECT_NONE) {
        newFormData.designation = ''
      }

      return newFormData
    })
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

  const filteredPositions = positions

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title="Add New User" description="Create a new team member">
      <DrawerContent className="bg-background">
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4 pb-6 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-foreground">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter full name"
                    required
                    className="bg-background text-foreground border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-foreground">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Enter email address"
                    required
                    className="bg-background text-foreground border-border"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="password" className="text-foreground">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Enter password"
                    required
                    className="bg-background text-foreground border-border pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 pb-6 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">Role & Position</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => handleInputChange('role', value)}
                    required
                  >
                    <SelectTrigger className="bg-background text-foreground text-sm h-10">
                      <SelectValue placeholder="Select role *" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="position" className="text-foreground">Position</Label>
                  <Select
                    value={formData.position}
                    onValueChange={(value) => handleInputChange('position', value)}
                    disabled={loadingData}
                  >
                    <SelectTrigger className="bg-background text-foreground border-border text-sm h-10">
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
                {formData.position !== OPTIONAL_SELECT_NONE && (
                  <div className="md:col-span-2">
                    <Label htmlFor="designation" className="text-foreground">Designation</Label>
                    <Input
                      id="designation"
                      value={formData.designation}
                      onChange={(e) => handleInputChange('designation', e.target.value)}
                      placeholder="e.g., Manager - Sales"
                      className="bg-background text-foreground border-border"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Specific identifier for this user's role.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 pb-6 ">
              <h3 className="text-base font-semibold text-foreground">Contact Information</h3>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="+91 9876543210"
                  className="bg-background text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">Format: +91 followed by 10-digit number</p>
              </div>
            </div>
          </form>
        </div>
      </DrawerContent>
      <DrawerFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          type="button"
        >
          {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />}
          Create User
        </Button>
      </DrawerFooter>
    </Drawer>
  )
}
