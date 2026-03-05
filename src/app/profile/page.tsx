'use client'

import { useState, useEffect, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { UserService } from '@/lib/services'
import { useCompany } from '@/contexts/CompanyContext'
import { useQueryClient } from '@tanstack/react-query'
import { User } from '@/types'
import { getUserAssignments, getPosition, getOrgUnit } from '@/lib/services/org'
import { PositionAssignment, Position, OrgUnit } from '@/types/org-schema'
import toast from 'react-hot-toast'
import { User as UserIcon, Mail, Phone, MessageSquare, Save, Camera, Lock, Building2, Briefcase, Calendar } from 'lucide-react'
import { uploadFile } from '@/lib/services/storage/storage-service'
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal'
import { formatDate } from '@/lib/utils/date-utils'

export default function ProfilePage() {
  const { user: authUser } = useAuthStore()
  const { companyId, groupId } = useCompany()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [orgLoading, setOrgLoading] = useState(true)
  const [currentAssignment, setCurrentAssignment] = useState<PositionAssignment | null>(null)
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null)
  const [currentOrgUnit, setCurrentOrgUnit] = useState<OrgUnit | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    slack: '',
    skills: [] as string[],
  })
  const [skillInput, setSkillInput] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (authUser) {
      setFormData({
        name: authUser.name || '',
        email: authUser.email || '',
        phone: authUser.contact?.phone || '',
        slack: authUser.contact?.slack || '',
        skills: Array.isArray(authUser.skills) ? authUser.skills : [],
      })

      // If this user is logging in with a temporary password, force open the change password modal.
      if (authUser.mustChangePassword) {
        setIsChangePasswordOpen(true)
      }
    }
  }, [authUser])

  // Fetch org structure data
  useEffect(() => {
    const loadOrgData = async () => {
      if (!authUser || !companyId) {
        setOrgLoading(false)
        return
      }

      try {
        setOrgLoading(true)

        // Get user's position assignments
        const assignments = await getUserAssignments(companyId, authUser.id, groupId ?? undefined)

        // Find the active assignment
        const activeAssignment = assignments.find(a => a.status === 'active')

        if (activeAssignment) {
          setCurrentAssignment(activeAssignment)

          // Get position details
          const position = await getPosition(companyId, activeAssignment.positionId, groupId ?? undefined)
          setCurrentPosition(position)

          // Get org unit details
          if (position?.orgUnitId) {
            const orgUnit = await getOrgUnit(companyId, position.orgUnitId, groupId ?? undefined)
            setCurrentOrgUnit(orgUnit)
          }
        }
      } catch (error) {
        console.error('Error loading org data:', error)
      } finally {
        setOrgLoading(false)
      }
    }

    loadOrgData()
  }, [authUser, companyId, groupId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authUser || !companyId) return

    try {
      setLoading(true)

      const updatedUser: Partial<User> = {
        name: formData.name,
        email: formData.email,
        skills: formData.skills,
        contact: {
          phone: formData.phone,
          slack: formData.slack,
        },
      }

      await UserService.updateUser(companyId, authUser.id, updatedUser, authUser.id, groupId ?? undefined)

      // Update auth store with new user data (pass groupId so enterpriseGroupId is preserved)
      const refreshedUser = await UserService.getUser(companyId, authUser.id, groupId ?? undefined)
      if (refreshedUser) {
        useAuthStore.getState().setUser(refreshedUser)
        // Immediately sync formData with refreshed user to display saved skills
        setFormData({
          name: refreshedUser.name || '',
          email: refreshedUser.email || '',
          phone: refreshedUser.contact?.phone || '',
          slack: refreshedUser.contact?.slack || '',
          skills: Array.isArray(refreshedUser.skills) ? refreshedUser.skills : [],
        })
      }

      // Invalidate users cache so people page reflects the changes immediately
      queryClient.invalidateQueries({ queryKey: ['users', companyId, groupId ?? ''] })

      toast.success('Profile updated successfully')
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Failed to update profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, skillInput.trim()],
      })
      setSkillInput('')
    }
  }

  const handleRemoveSkill = (skill: string) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter(s => s !== skill),
    })
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !authUser || !companyId) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      toast.error('Image size must be less than 5MB')
      return
    }

    try {
      setUploadingAvatar(true)
      setUploadProgress(0)

      // Generate unique file path
      const fileExtension = file.name.split('.').pop()
      const fileName = `profile-pics/${authUser.id}/${Date.now()}.${fileExtension}`

      // Upload file with progress tracking
      const uploadedFile = await uploadFile(file, fileName, (progress) => {
        setUploadProgress(progress.percentage)
      })

      // Update user avatar in database
      await UserService.updateUser(companyId, authUser.id, {
        avatar: uploadedFile.url,
      }, authUser.id, groupId ?? undefined)

      // Refresh user data in auth store (pass groupId so enterpriseGroupId is preserved)
      const refreshedUser = await UserService.getUser(companyId, authUser.id, groupId ?? undefined)
      if (refreshedUser) {
        useAuthStore.getState().setUser(refreshedUser)
      }

      // Invalidate users cache so people page reflects the changes immediately
      queryClient.invalidateQueries({ queryKey: ['users', companyId, groupId ?? ''] })

      toast.success('Profile picture updated successfully')
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast.error('Failed to upload profile picture. Please try again.')
    } finally {
      setUploadingAvatar(false)
      setUploadProgress(0)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  if (!authUser) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Not Logged In</h3>
            <p className="text-gray-600">Please log in to view your profile.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600">Manage your personal information and preferences</p>
          </div>
        </div>

        {/* Profile Section */}
        <div className="bg-white rounded-lg border shadow-sm">
          {/* Avatar Section */}
          <div className="px-6 py-6 border-b border-gray-200">
            <div className="flex items-center space-x-6">
              <div className="relative group">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden cursor-pointer transition-opacity hover:opacity-80"
                  onClick={handleAvatarClick}
                  title="Click to upload profile picture"
                >
                  {uploadingAvatar ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-1" />
                      <span className="text-xs text-gray-600">{Math.round(uploadProgress)}%</span>
                    </div>
                  ) : authUser.avatar ? (
                    <img
                      src={authUser.avatar}
                      alt={authUser.name}
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl font-medium text-gray-500">
                      {authUser.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  title="Upload profile picture"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={uploadingAvatar}
                    className="text-sm text-primary hover:text-primary/80 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingAvatar ? 'Uploading...' : 'Upload Photo'}
                  </button>
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{authUser.name}</h2>
                {currentPosition ? (
                  <p className="text-gray-600">{currentPosition.title}</p>
                ) : (
                  <p className="text-gray-600">{authUser.position}</p>
                )}
                <div className="flex items-center mt-2 space-x-2">
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${authUser.role === 'admin'
                    ? 'bg-red-100 text-red-800'
                    : authUser.role === 'manager'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                    }`}>
                    {authUser.role}
                  </span>
                  {currentOrgUnit && (
                    <span className="text-sm text-gray-500">{currentOrgUnit.name}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Org Structure Information */}
          {currentAssignment && currentPosition && (
            <div className="px-6 py-4 bg-blue-50 border-t border-b border-blue-100">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">Current Position Assignment</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start space-x-3">
                  <Briefcase className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-xs text-blue-700 font-medium">Position</p>
                    <p className="text-sm text-blue-900">{currentPosition.title}</p>
                  </div>
                </div>
                {currentOrgUnit && (
                  <div className="flex items-start space-x-3">
                    <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-blue-700 font-medium">Org Unit</p>
                      <p className="text-sm text-blue-900">{currentOrgUnit.name}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start space-x-3">
                  <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-xs text-blue-700 font-medium">Since</p>
                    <p className="text-sm text-blue-900">
                      {formatDate(currentAssignment.startAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <UserIcon className="w-5 h-5 mr-2" />
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-gray-50"
                    required
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Mail className="w-5 h-5 mr-2" />
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                {/* Slack Username Hidden as per requirements */}
                {/* 
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MessageSquare className="w-4 h-4 inline mr-1" />
                    Slack Username
                  </label>
                  <input
                    type="text"
                    value={formData.slack}
                    onChange={(e) => setFormData({ ...formData, slack: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="@username"
                  />
                </div> 
                */}
              </div>
            </div>

            {/* Skills */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills</h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Add a skill (e.g., Welding, Quality Control)"
                  />
                  <Button type="button" onClick={handleAddSkill} variant="outline">
                    Add
                  </Button>
                </div>
                {formData.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full flex items-center gap-2"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="hover:text-red-600 transition-colors"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsChangePasswordOpen(true)}
              >
                <Lock className="w-4 h-4 mr-2" />
                Change Password
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
      <ChangePasswordModal
        open={isChangePasswordOpen}
        onOpenChange={setIsChangePasswordOpen}
        email={authUser.email}
        companyId={companyId || 'default'}
        groupId={groupId || undefined}
      />
    </DashboardLayout>
  )
}

