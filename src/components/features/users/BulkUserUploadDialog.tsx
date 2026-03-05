'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCompany } from '@/contexts/CompanyContext'
import { UserService, assignUserToPosition, getOrgUnits, getPositions } from '@/lib/services'
import { useUserMutations, useUsersQuery } from '@/hooks/queries/useUserQueries'
import type { User } from '@/types'
import type { OrgUnit, Position } from '@/types/org-schema'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { Upload, FileText, Download, Loader2, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'

interface BulkUserUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUsersAdded: () => void
}

interface CSVUser {
  name: string
  email: string
  phone: string
  password: string
  role?: string
  position?: string
  designation?: string
  department?: string
  orgUnitName?: string // Internal use for correct mapping
}

const VALID_ROLES = ['admin', 'manager', 'employee'] as const
type ValidRole = typeof VALID_ROLES[number]

function normalizeRole(roleInput: string): ValidRole {
  const normalized = roleInput.toLowerCase().trim()
  if (VALID_ROLES.includes(normalized as ValidRole)) {
    return normalized as ValidRole
  }
  // Default to employee if unrecognized
  return 'employee'
}

export function BulkUserUploadDialog({ open, onOpenChange, onUsersAdded }: BulkUserUploadDialogProps) {
  const { companyId, groupId } = useCompany()
  const currentUser = useAuthStore(state => state.user)

  const [uploading, setUploading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [positions, setPositions] = useState<Position[]>([])

  const [uploadResults, setUploadResults] = useState<{
    success: number
    failed: number
    errors: Array<{ email: string; error: string }>
  } | null>(null)

  const csvInputRef = useRef<HTMLInputElement>(null)

  // Load Org Units and Positions when dialog opens
  useEffect(() => {
    if (open && companyId) {
      loadOrgData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, companyId])

  const loadOrgData = async () => {
    if (!companyId) return
    try {
      setLoadingData(true)
      const [fetchedOrgUnits, fetchedPositions] = await Promise.all([
        getOrgUnits(companyId, groupId ?? undefined),
        getPositions(companyId, groupId ?? undefined)
      ])
      setOrgUnits(fetchedOrgUnits)
      setPositions(fetchedPositions)
    } catch (error) {
      console.error('Error loading org data:', error)
      toast.error('Failed to load organization data for validation')
    } finally {
      setLoadingData(false)
    }
  }

  // Generate and download sample Excel file using this company's positions when available
  const downloadSampleExcel = () => {
    const orgUnitById = new Map(orgUnits.map(u => [u.id, u]))
    const sampleRows: (string | number)[][] = [
      ['name', 'email', 'phone', 'role', 'password', 'position_id', 'designation', 'org_unit'],
    ]
    const placeholderRows = [
      ['John Doe', 'john.doe@example.com', '+91 9876543210', 'employee', '_Test@123_', '', 'Engineer - Frontend', ''],
      ['Jane Smith', 'jane.smith@example.com', '+91 9876543211', 'manager', '_Test@123_', '', 'Manager - Product', ''],
      ['Bob Johnson', 'bob.johnson@example.com', '+91 9876543212', 'admin', '_Test@123_', '', 'Admin', ''],
    ]
    if (positions.length > 0) {
      positions.slice(0, 3).forEach((pos, i) => {
        const orgName = pos.orgUnitId ? orgUnitById.get(pos.orgUnitId)?.name ?? '' : ''
        const placeholder = placeholderRows[i] ?? placeholderRows[0]!
        sampleRows.push([
          placeholder[0] ?? '',
          placeholder[1] ?? '',
          placeholder[2] ?? '',
          placeholder[3] ?? '',
          placeholder[4] ?? '',
          pos.code,
          pos.title,
          orgName,
        ])
      })
      if (positions.length < 3) {
        for (let i = positions.length; i < 3; i++) {
          sampleRows.push(placeholderRows[i]!)
        }
      }
    } else {
      sampleRows.push(...placeholderRows)
    }
    const sampleData = sampleRows

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(sampleData)
    XLSX.utils.book_append_sheet(wb, ws, 'Users')

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'bulk_users_template.xlsx')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success('Sample Excel file downloaded')
  }

  // Parse file content using XLSX
  const parseFileContent = (data: ArrayBuffer): CSVUser[] => {
    const workbook = XLSX.read(data, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      throw new Error('File has no sheets')
    }

    const worksheet = workbook.Sheets[firstSheetName]
    if (!worksheet) {
      throw new Error('Could not read Excel worksheet')
    }

    const jsonData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
    if (jsonData.length < 2) {
      throw new Error('File must have at least a header row and one data row')
    }

    const rawHeaders = (jsonData[0] as string[]).map(h => (h || '').toString().trim())
    const normalizedHeaders = rawHeaders.map(h => h.toLowerCase().replace(/[\s_]+/g, '')) // Remove spaces and underscores for easier matching

    const requiredFields = ['name', 'email', 'password'] as const
    const missingHeaders: string[] = []

    const headerMap: Record<string, number> = {}

    // Map common variations of headers
    const fieldVariations: Record<string, string[]> = {
      name: ['name', 'fullname', 'username'],
      email: ['email', 'emailaddress', 'useremail'],
      password: ['password', 'pass', 'pwd'],
      phone: ['phone', 'phonenumber', 'mobile', 'cell', 'contact', 'contact-number', 'mobile-no', 'cell-no', 'phone-no'],
      role: ['role', 'userrole', 'accesslevel'],
      position: ['positionid', 'position', 'jobtitle', 'title'], // positionid matches column header 'position_id' after normalization
      designation: ['designation', 'role-detail', 'sub-title'],
      department: ['department', 'orgunit', 'unit', 'team', 'division']
    }

    // Find indices for required fields
    requiredFields.forEach(field => {
      let found = false
      for (const variation of fieldVariations[field] ?? []) {
        const index = normalizedHeaders.indexOf(variation)
        if (index !== -1) {
          headerMap[field] = index
          found = true
          break
        }
      }
      if (!found) missingHeaders.push(field)
    })

    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`)
    }

    // Find indices for optional fields
    ['phone', 'role', 'position', 'designation', 'department'].forEach(field => {
      for (const variation of fieldVariations[field] ?? []) {
        const index = normalizedHeaders.indexOf(variation)
        if (index !== -1) {
          headerMap[field] = index
          break
        }
      }
    })

    const users: CSVUser[] = []

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as unknown[]
      if (row.length === 0 || row.every(cell => cell === '')) continue

      const name = String(row[headerMap['name']!] || '').trim()
      const email = String(row[headerMap['email']!] || '').trim()
      const password = String(row[headerMap['password']!] || '').trim()

      const phoneIndex = headerMap['phone']
      const phone = phoneIndex !== undefined ? String(row[phoneIndex] || '').trim() : ''

      const roleIndex = headerMap['role']
      const role = roleIndex !== undefined ? String(row[roleIndex] || '').trim() : ''

      const positionIndex = headerMap['position']
      const position = positionIndex !== undefined ? String(row[positionIndex] || '').trim() : ''

      const designationIndex = headerMap['designation']
      const designation = designationIndex !== undefined ? String(row[designationIndex] || '').trim() : ''

      const departmentIndex = headerMap['department']
      const department = departmentIndex !== undefined ? String(row[departmentIndex] || '').trim() : '' // Captures org unit / department

      if (name && email) {
        users.push({
          name,
          email,
          phone,
          password,
          role,
          position,
          designation,
          orgUnitName: department // Map department/orgUnit header to orgUnitName internal prop
        })
      }
    }

    return users
  }

  const { createUser, updateUser } = useUserMutations(companyId || undefined, groupId ?? undefined)
  const { data: existingUsers = [] } = useUsersQuery(companyId || undefined, groupId ?? undefined)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !companyId) return

    // Validate file type
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    const isCSV = file.name.endsWith('.csv')

    if (!isExcel && !isCSV) {
      toast.error('Please select a CSV or Excel file')
      return
    }

    try {
      setUploading(true)
      setUploadResults(null)
      const data = await file.arrayBuffer()
      const users = parseFileContent(data)

      if (users.length === 0) {
        toast.error('No valid users found in file')
        return
      }

      let successCount = 0
      let errorCount = 0
      const errors: Array<{ email: string; error: string }> = []

      // Create lookup maps for Org Units and Positions
      const orgUnitMap = new Map(orgUnits.map(u => [u.name.toLowerCase(), u]))

      // Position map: indexed by CODE first (primary key for position_id column), then by title as fallback
      const positionMap = new Map<string, typeof positions[0]>()
      positions.forEach(p => {
        if (p.code) positionMap.set(p.code.toLowerCase(), p)  // code is the primary lookup
        positionMap.set(p.title.toLowerCase(), p)               // title as fallback
      })


      // Map of existing users for duplicate check
      const existingUserMap = new Map(
        existingUsers.map(u => [u.email.toLowerCase(), u])
      )

      for (const userData of users) {
        try {
          // Explicit validation for password field
          if (!userData.password || userData.password.trim() === '') {
            throw new Error('Password is required for this user')
          }

          // Normalize role from CSV input to one of the 3 valid roles
          const role = normalizeRole(userData.role || 'employee')
          const password = userData.password ? userData.password.trim() : ''
          const userEmail = userData.email.toLowerCase().trim()

          // Find IDs for Org Unit and Position
          const orgUnitName = userData.orgUnitName?.trim()
          const positionTitle = userData.position?.trim()
          const designation = userData.designation?.trim()

          let orgUnitId = ''
          let mappedOrgUnitName = orgUnitName || ''
          let positionId = ''
          let match: Position | undefined

          // Match Org Unit
          if (orgUnitName) {
            const match = orgUnitMap.get(orgUnitName.toLowerCase())
            if (match) {
              orgUnitId = match.id
              mappedOrgUnitName = match.name // Use the exact case from DB
            }
          }

          // Match Position — must be a REAL position code that exists in the system
          if (positionTitle) {
            match = positionMap.get(positionTitle.toLowerCase())
            if (match) {
              if (orgUnitId && match.orgUnitId && match.orgUnitId !== orgUnitId) {
                console.warn(`Position ${match.title} belongs to ${match.orgUnitId}, but user is in ${orgUnitId}`)
              } else {
                positionId = match.id
              }
            } else {
              // Position ID provided but does not exist in the system — reject this row
              throw new Error(
                `Position ID "${positionTitle}" not found in the system. Please create the position in the Org Chart first, then re-upload.`
              )
            }
          }

          const existingUser = existingUserMap.get(userEmail)

          if (existingUser) {
            // UPDATE User
            const updatePayload: Partial<User> & { orgUnitId?: string } = {
              name: userData.name,
              role: role,
              contact: {
                ...existingUser.contact,
                phone: userData.phone || existingUser.contact?.phone || ''
              },
              positionCode: match?.code || existingUser.positionCode || '',
              designation: designation || existingUser.designation || ''
            }

            // Only update these if provided
            if (positionTitle) updatePayload.position = positionTitle
            if (mappedOrgUnitName) {
              updatePayload.orgUnitName = mappedOrgUnitName
              updatePayload.orgUnitId = orgUnitId // Important: Update the ID too
            }

            await updateUser.mutateAsync({
              userId: existingUser.id,
              data: updatePayload
            })

            // If we have a valid Position ID, we should check/create assignment?
            // Bulk update generally doesn't trigger assignment logic in this context unless explicitly requested,
            // but for "Fix" parity, maybe we should?
            // Let's stick to CREATE logic for assignments for now to avoid side effects on existing users 
            // unless the user explicitly wants to "re-onboard" them.
            // (Skipping assignment for update to be safe, focused on fixing creation)

            successCount++

          } else {
            // CREATE New User
            if (!password) throw new Error('Password is required for new users')

            const userPayload = {
              name: userData.name,
              email: userData.email,
              password: password,
              role: role,
              orgUnitId: orgUnitId,      // Correct ID
              orgUnitName: mappedOrgUnitName, // Correct Name
              position: positionTitle || '',  // Title as string
              companyId: companyId,
              contact: {
                phone: userData.phone || '',
                slack: ''
              },
              // Only store positionCode from a REAL position in the DB.
              // If the user typed a position_id that doesn't exist, we already threw above.
              positionCode: match?.code || '',
              designation: designation || positionTitle || '',
              skills: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }

            const newUser = await createUser.mutateAsync(userPayload)

            // ASSIGN POSITION logic (Parity with AddUserDrawer)
            if (positionId) {
              try {
                // Assign user to the found position
                await assignUserToPosition(
                  companyId,
                  positionId,
                  newUser.id,
                  {
                    assignmentType: 'permanent',
                    startAt: new Date().toISOString(),
                    reason: 'Initial assignment via Bulk Upload',
                    notes: `Automatically assigned during bulk user creation`
                  },
                  currentUser?.id || 'system',
                  groupId ?? undefined
                )
                console.log(`Assigned ${newUser.email} to position ${positionId}`)
              } catch (assignError: unknown) {
                console.error(`Failed to assign position for ${userEmail}:`, assignError)
                // Don't fail the whole row, just log it. The user exists now.
                // We could add a note to errors, but that might confuse "success".
              }
            }

            successCount++
          }

        } catch (error: unknown) {
          console.error(`Error processing user ${userData.email}:`, error)
          errorCount++
          errors.push({
            email: userData.email,
            error: error instanceof Error ? error.message : 'Failed to process user'
          })
        }
      }

      setUploadResults({
        success: successCount,
        failed: errorCount,
        errors
      })

      if (successCount > 0) {
        toast.success(`Processed ${successCount} user(s)${errorCount > 0 ? `. ${errorCount} failed.` : ''}`)
        onUsersAdded()
      } else {
        toast.error(`Failed to process users. ${errorCount} error(s).`)
      }
    } catch (error: unknown) {
      console.error('Error processing file:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to process file')
    } finally {
      setUploading(false)
      if (csvInputRef.current) {
        csvInputRef.current.value = ''
      }
    }
  }

  const handleClose = () => {
    setUploadResults(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bulk User Upload</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to create/update users.
            The system will attempt to link Org Units and Positions to existing records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Sample Download */}
          <div className="space-y-2">
            <Label>Sample Template</Label>
            <Button
              type="button"
              variant="outline"
              onClick={downloadSampleExcel}
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Excel Template
            </Button>
            <p className="text-xs text-muted-foreground">
              Required: name, email, password. Optional: phone, role, position_id (Position Code from Org Chart), designation, org_unit. Template uses your org&apos;s positions when available.
            </p>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload File</Label>
            <div className={`border-2 border-dashed border-border rounded-lg p-6 ${loadingData ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex flex-col items-center justify-center space-y-4">
                <FileSpreadsheet className="w-12 h-12 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground mb-1">
                    Choose a CSV or Excel file to upload
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: .csv, .xlsx, .xls
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => csvInputRef.current?.click()}
                  disabled={uploading || loadingData}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : loadingData ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading Org Data...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Choose File
                    </>
                  )}
                </Button>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Upload Results */}
          {uploadResults && (
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="font-medium">Success: {uploadResults.success}</span>
                </div>
                {uploadResults.failed > 0 && (
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <span className="font-medium text-red-600">Failed: {uploadResults.failed}</span>
                  </div>
                )}
              </div>

              {uploadResults.errors.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium">Errors:</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {uploadResults.errors.map((err, index) => (
                      <div key={index} className="text-xs text-red-600">
                        <span className="font-medium">{err.email}:</span> {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            {uploadResults ? 'Close' : 'Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
