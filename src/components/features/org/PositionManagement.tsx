'use client'

import { useState } from 'react'
import { Plus, Briefcase, Edit2, Archive, Users, Search, Upload, Trash2, Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import type { Position, OrgUnit } from '@/types/org-schema'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { usePositionsQuery, useOrgUnitsQuery, usePositionMutations } from '@/hooks/queries/useOrgQueries'
import toast from 'react-hot-toast'
import { PositionImportDialog } from './PositionImportDialog'

// Feature flag to control visibility of skills and responsibilities fields
const SHOW_SKILLS_FIELDS = false

export function PositionManagement() {
  const { currentCompany } = useCompany()
  const { user } = useAuthStore()
  const companyId = currentCompany?.id
  const groupId = user?.enterpriseGroupId ?? null
  const { data: positionsData = [], isLoading: loading, refetch: refetchPositions } = usePositionsQuery(companyId, groupId)
  const { data: orgUnitsData = [] } = useOrgUnitsQuery(companyId, groupId)
  const positions = positionsData.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
  const orgUnits = orgUnitsData.sort((a, b) => a.name.localeCompare(b.name))
  const { createPosition: createPositionMutation, updatePosition: updatePositionMutation, deletePosition: deletePositionMutation, deletePositions: deletePositionsMutation } = usePositionMutations(companyId, groupId)
  const [submitting, setSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<Position | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; position: Position | null }>({
    open: false,
    position: null,
  })
  const [hasLowerLevel, setHasLowerLevel] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkArchiveDialogOpen, setBulkArchiveDialogOpen] = useState(false)
  const [isBulkArchiving, setIsBulkArchiving] = useState(false)

  // Form state
  const [formData, setFormData] = useState<Partial<Position>>({
    title: '',
    code: '',
    description: '',
    orgUnitId: '',
    level: 1,
    scope: {
      orgUnits: [],
      locations: [],
      productLines: [],
      processes: [],
      equipmentTypes: [],
    },
    responsibilities: [],
    requiredSkills: [],
    optionalSkills: [],
    certifications: [],
    reportsToPositionId: null,
    employmentType: 'full_time',
    approvalAuthority: {
      canApproveProjects: false,
      canApproveBudgets: false,
      canApproveQuality: false,
      canApproveSafety: false,
      canApproveTimeOff: false,
      customApprovals: [],
    },
    status: 'active',
    recruitmentPriority: 'low',
  })

  // Input fields for arrays
  const [newResponsibility, setNewResponsibility] = useState('')
  const [newRequiredSkill, setNewRequiredSkill] = useState('')
  const [newOptionalSkill, setNewOptionalSkill] = useState('')
  const [newCertification, setNewCertification] = useState('')

  function handleEdit(position: Position) {
    setEditingPosition(position)
    // Recalculate level from org unit and reports to position to ensure it's correct
    const calculatedLevel = calculatePositionLevel(position.orgUnitId ?? '', position.reportsToPositionId)
    setFormData({
      ...position,
      level: calculatedLevel,
      recruitmentPriority: position.recruitmentPriority || 'low',
    })
    setHasLowerLevel(false) // Headcount is now dynamic
    setIsDialogOpen(true)
  }

  function resetForm() {
    setEditingPosition(null)
    setHasLowerLevel(false)
    setFormData({
      title: '',
      code: '',
      description: '',
      orgUnitId: '',
      level: 1,
      scope: {
        orgUnits: [],
        locations: [],
        productLines: [],
        processes: [],
        equipmentTypes: [],
      },
      responsibilities: [],
      requiredSkills: [],
      optionalSkills: [],
      certifications: [],
      reportsToPositionId: null,
      employmentType: 'full_time',
      approvalAuthority: {
        canApproveProjects: false,
        canApproveBudgets: false,
        canApproveQuality: false,
        canApproveSafety: false,
        canApproveTimeOff: false,
        customApprovals: [],
      },
      status: 'active',
      recruitmentPriority: 'low',
    })
    setIsDialogOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId || submitting) return

    // Calculate level from org unit and reports to position
    if (formData.orgUnitId) {
      formData.level = calculatePositionLevel(formData.orgUnitId, formData.reportsToPositionId || null)
    }

    // Clear reportsToPositionId if level is 1 (top level)
    if (formData.level === 1) {
      formData.reportsToPositionId = null
    }

    try {
      setSubmitting(true)
      const userId = user?.id || 'current-user-id'

      if (editingPosition) {
        await updatePositionMutation.mutateAsync({ positionId: editingPosition.id, updates: formData, userId })
      } else {
        await createPositionMutation.mutateAsync({
          data: { ...formData, companyId: companyId! } as Omit<Position, 'id' | 'createdAt' | 'updatedAt'>,
          userId,
        })
      }
      resetForm()
      toast.success(editingPosition ? 'Position updated' : 'Position created')
    } catch (error) {
      console.error('Error saving position:', error)
    } finally {
      setSubmitting(false)
    }
  }

  function handleDeleteClick(position: Position) {
    setDeleteDialog({ open: true, position })
  }

  async function handleDeleteConfirm() {
    if (!deleteDialog.position || !companyId || !groupId || submitting) return

    try {
      setSubmitting(true)
      const userId = user?.id || 'current-user-id'
      await deletePositionMutation.mutateAsync({ positionId: deleteDialog.position.id, userId })
      toast.success('Position archived successfully')
      setSelectedIds(prev => prev.filter(id => id !== deleteDialog.position?.id))
      setDeleteDialog({ open: false, position: null })
    } catch (error) {
      console.error('Error deleting position:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredPositions.map(p => p.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectRow = (checked: boolean, id: string) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id])
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id))
    }
  }

  async function handleBulkArchive() {
    if (!companyId || !groupId || selectedIds.length === 0 || isBulkArchiving) return

    try {
      setIsBulkArchiving(true)
      const userId = user?.id || 'current-user-id'
      await deletePositionsMutation.mutateAsync({ positionIds: selectedIds, userId })
      toast.success(`${selectedIds.length} positions archived successfully`)
      setSelectedIds([])
      setBulkArchiveDialogOpen(false)
    } catch (error) {
      console.error('Error archiving positions:', error)
    } finally {
      setIsBulkArchiving(false)
    }
  }

  function getOrgUnitName(orgUnitId: string): string {
    const orgUnit = orgUnits.find(d => d.id === orgUnitId)
    return orgUnit?.name || 'Unknown'
  }

  function getPositionTitle(positionId: string | null): string {
    if (!positionId) return '-'
    const pos = positions.find(p => p.id === positionId)
    return pos?.title || 'Unknown'
  }

  // Calculate org unit level based on hierarchy depth
  function calculateOrgUnitLevel(orgUnitId: string): number {
    if (!orgUnitId) return 1

    const orgUnit = orgUnits.find(ou => ou.id === orgUnitId)
    if (!orgUnit) return 1

    // Count depth by traversing up the parent chain
    let level = 1
    let currentOrgUnit: OrgUnit | undefined = orgUnit
    const visited = new Set<string>() // Prevent infinite loops

    while (currentOrgUnit?.parentOrgUnitId && !visited.has(currentOrgUnit.id)) {
      visited.add(currentOrgUnit.id)
      level++
      currentOrgUnit = orgUnits.find(ou => ou.id === currentOrgUnit!.parentOrgUnitId)
    }

    return level
  }

  // Calculate position level based on org unit and reports to position
  function calculatePositionLevel(orgUnitId: string, reportsToPositionId: string | null): number {
    // If reports to a position, level is reporting position's level + 1
    if (reportsToPositionId) {
      const reportingPosition = positions.find(p => p.id === reportsToPositionId)
      if (reportingPosition) {
        return reportingPosition.level + 1
      }
    }

    // Otherwise, use org unit level
    return calculateOrgUnitLevel(orgUnitId)
  }

  function addToArray(field: keyof Position, value: string) {
    if (!value.trim()) return
    const currentArray = (formData[field] as string[]) || []
    setFormData({
      ...formData,
      [field]: [...currentArray, value.trim()],
    })
  }

  function removeFromArray(field: keyof Position, index: number) {
    const currentArray = (formData[field] as string[]) || []
    setFormData({
      ...formData,
      [field]: currentArray.filter((_, i) => i !== index),
    })
  }

  // Filter positions based on search term
  const filteredPositions = positions.filter(pos =>
    pos.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pos.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pos.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getOrgUnitName(pos.orgUnitId ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (pos.requiredSkills && pos.requiredSkills.some(skill =>
      skill.toLowerCase().includes(searchTerm.toLowerCase())
    ))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            Manage organizational positions, roles, and reporting structure
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search Box */}
          {!loading && positions.length > 0 && (
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search positions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
          )}
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Position
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingPosition ? 'Edit Position' : 'Create Position'}
                </DialogTitle>
                <DialogDescription>
                  {editingPosition
                    ? 'Update position information'
                    : 'Add a new position to your organization'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Position Title *</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g., Production Line Supervisor"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="code">Position Code *</Label>
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        placeholder="e.g., PLS-001"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe the position's role and purpose..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="orgUnit">Org Unit *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between font-normal",
                              !formData.orgUnitId && "text-muted-foreground"
                            )}
                          >
                            {formData.orgUnitId
                              ? orgUnits.find((ou) => ou.id === formData.orgUnitId)?.name +
                              ` (${orgUnits.find((ou) => ou.id === formData.orgUnitId)?.code})`
                              : orgUnits.length === 0
                                ? "No org units - Create one first"
                                : "Select org unit"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search org unit..." />
                            <CommandList>
                              <CommandEmpty>No org unit found.</CommandEmpty>
                              <CommandGroup>
                                {orgUnits.map((orgUnit) => (
                                  <CommandItem
                                    key={orgUnit.id}
                                    value={orgUnit.name}
                                    onSelect={() => {
                                      const calculatedLevel = calculatePositionLevel(
                                        orgUnit.id,
                                        formData.reportsToPositionId || null
                                      )
                                      setFormData({
                                        ...formData,
                                        orgUnitId: orgUnit.id,
                                        level: calculatedLevel,
                                        reportsToPositionId:
                                          calculatedLevel === 1 ? null : formData.reportsToPositionId,
                                      })
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        orgUnit.id === formData.orgUnitId
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {orgUnit.name} ({orgUnit.code})
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {orgUnits.length === 0 && (
                        <p className="text-xs text-amber-600">
                          ⚠️ No org units available. Create org units first in the Org Units tab.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="level">Org Level</Label>
                      <Input
                        id="level"
                        type="number"
                        min="1"
                        value={formData.level || calculatePositionLevel(formData.orgUnitId || '', formData.reportsToPositionId || null)}
                        disabled
                        readOnly
                        className="bg-muted cursor-not-allowed"
                      />
                      <p className="text-xs text-muted-foreground">
                        {formData.reportsToPositionId
                          ? "Calculated from Reports To position level + 1"
                          : "Inherited from Org Unit hierarchy (1 = highest level)"}
                      </p>
                    </div>

                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="employmentType">Employment Type</Label>
                      <Select
                        value={formData.employmentType}
                        onValueChange={(value: any) => setFormData({ ...formData, employmentType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="full_time">Full Time</SelectItem>
                          <SelectItem value="part_time">Part Time</SelectItem>
                          <SelectItem value="temporary">Temporary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="recruitmentPriority">Recruitment Priority (for Vacant Slots)</Label>
                      <Select
                        value={formData.recruitmentPriority || 'low'}
                        onValueChange={(value: any) => setFormData({ ...formData, recruitmentPriority: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high" className="text-red-500 font-medium">High</SelectItem>
                          <SelectItem value="medium" className="text-blue-500 font-medium">Medium</SelectItem>
                          <SelectItem value="low" className="text-gray-500 font-medium">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reportsTo">Reports To</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            disabled={formData.level === 1}
                            className={cn(
                              "w-full justify-between font-normal text-left h-auto py-2",
                              !formData.reportsToPositionId && "text-muted-foreground",
                              formData.level === 1 && "bg-muted cursor-not-allowed"
                            )}
                          >
                            <span className="truncate">
                              {formData.reportsToPositionId
                                ? positions.find((p) => p.id === formData.reportsToPositionId)?.title +
                                ` (${positions.find((p) => p.id === formData.reportsToPositionId)?.code})`
                                : formData.level === 1
                                  ? "Top level position (no reporting required)"
                                  : "Select reporting position"}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search position..." />
                            <CommandList>
                              <CommandEmpty>No position found.</CommandEmpty>
                              <CommandGroup>
                                {positions
                                  .filter((p) => p.id !== editingPosition?.id)
                                  .map((pos) => (
                                    <CommandItem
                                      key={pos.id}
                                      value={pos.title}
                                      onSelect={() => {
                                        const reportsToId = pos.id
                                        const calculatedLevel = calculatePositionLevel(
                                          formData.orgUnitId || '',
                                          reportsToId
                                        )
                                        setFormData({
                                          ...formData,
                                          reportsToPositionId: reportsToId,
                                          level: calculatedLevel,
                                        })
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          pos.id === formData.reportsToPositionId
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      {pos.title} ({pos.code})
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {formData.level === 1 && (
                        <p className="text-xs text-muted-foreground">
                          Top level positions do not report to anyone
                        </p>
                      )}
                      {positions.length === 0 && formData.level !== 1 && (
                        <p className="text-xs text-muted-foreground">
                          No positions available. Create positions to select as parent.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Lower Level Positions */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="hasLowerLevel"
                        checked={hasLowerLevel}
                        onCheckedChange={(checked) => setHasLowerLevel(!!checked)}
                      />
                      <Label htmlFor="hasLowerLevel" className="cursor-pointer">
                        This position has lower-level reports (e.g., Lead, Supervisor)
                      </Label>
                    </div>
                  </div>
                </div>

                {SHOW_SKILLS_FIELDS && (
                  <>
                    {/* Responsibilities */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Responsibilities</h3>
                      <div className="flex gap-2">
                        <Input
                          value={newResponsibility}
                          onChange={(e) => setNewResponsibility(e.target.value)}
                          placeholder="Add a responsibility..."
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addToArray('responsibilities', newResponsibility)
                              setNewResponsibility('')
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            addToArray('responsibilities', newResponsibility)
                            setNewResponsibility('')
                          }}
                        >
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {formData.responsibilities?.map((resp, index) => (
                          <Badge key={index} variant="secondary">
                            {resp}
                            <button
                              type="button"
                              onClick={() => removeFromArray('responsibilities', index)}
                              className="ml-2 text-xs hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Skills */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Required Skills</h3>
                      <div className="flex gap-2">
                        <Input
                          value={newRequiredSkill}
                          onChange={(e) => setNewRequiredSkill(e.target.value)}
                          placeholder="Add a required skill..."
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addToArray('requiredSkills', newRequiredSkill)
                              setNewRequiredSkill('')
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            addToArray('requiredSkills', newRequiredSkill)
                            setNewRequiredSkill('')
                          }}
                        >
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {formData.requiredSkills?.map((skill, index) => (
                          <Badge key={index} variant="default">
                            {skill}
                            <button
                              type="button"
                              onClick={() => removeFromArray('requiredSkills', index)}
                              className="ml-2 text-xs hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>

                      <h3 className="text-lg font-semibold mt-4">Optional Skills</h3>
                      <div className="flex gap-2">
                        <Input
                          value={newOptionalSkill}
                          onChange={(e) => setNewOptionalSkill(e.target.value)}
                          placeholder="Add an optional skill..."
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addToArray('optionalSkills', newOptionalSkill)
                              setNewOptionalSkill('')
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            addToArray('optionalSkills', newOptionalSkill)
                            setNewOptionalSkill('')
                          }}
                        >
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {formData.optionalSkills?.map((skill, index) => (
                          <Badge key={index} variant="outline">
                            {skill}
                            <button
                              type="button"
                              onClick={() => removeFromArray('optionalSkills', index)}
                              className="ml-2 text-xs hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>

                      <h3 className="text-lg font-semibold mt-4">Certifications</h3>
                      <div className="flex gap-2">
                        <Input
                          value={newCertification}
                          onChange={(e) => setNewCertification(e.target.value)}
                          placeholder="Add a certification..."
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addToArray('certifications', newCertification)
                              setNewCertification('')
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            addToArray('certifications', newCertification)
                            setNewCertification('')
                          }}
                        >
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {formData.certifications?.map((cert, index) => (
                          <Badge key={index} variant="secondary">
                            {cert}
                            <button
                              type="button"
                              onClick={() => removeFromArray('certifications', index)}
                              className="ml-2 text-xs hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={resetForm} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        {editingPosition ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      editingPosition ? 'Update Position' : 'Create Position'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading positions...</p>
        </div>
      ) : positions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No positions yet</p>
            <p className="text-muted-foreground mb-4">
              Create your first position to define organizational roles
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Position
            </Button>
          </CardContent>
        </Card>
      ) : filteredPositions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No positions found</p>
            <p className="text-muted-foreground mb-4">
              No positions match your search "{searchTerm}"
            </p>
            <Button onClick={() => setSearchTerm('')} variant="outline">
              Clear Search
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardDescription>
              {searchTerm
                ? `Positions (${filteredPositions.length} of ${positions.length})`
                : `All Positions (${positions.length})`
              }
            </CardDescription>
            {selectedIds.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkArchiveDialogOpen(true)}
                className="animate-in fade-in slide-in-from-right-2 border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 hover:text-amber-700"
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive Selected ({selectedIds.length})
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[calc(100vh-400px)] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={filteredPositions.length > 0 && selectedIds.length === filteredPositions.length}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      />
                    </TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Org Unit</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Reports To</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPositions.map((position) => (
                    <TableRow key={position.id} className={selectedIds.includes(position.id) ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(position.id)}
                          onCheckedChange={(checked) => handleSelectRow(!!checked, position.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{position.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{position.code}</Badge>
                      </TableCell>
                      <TableCell>{getOrgUnitName(position.orgUnitId ?? '')}</TableCell>
                      <TableCell>{position.level}</TableCell>
                      <TableCell>{getPositionTitle(position.reportsToPositionId)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {(position.employmentType || 'full_time').replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            position.status === 'active'
                              ? 'default'
                              : position.status === 'inactive'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {position.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(position)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(position)}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, position: null })}
        title="Archive Position"
        description={`Are you sure you want to archive the position "${deleteDialog.position?.title}"? This will remove it from the organization chart.`}
        confirmText="Archive"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />

      <ConfirmationDialog
        open={bulkArchiveDialogOpen}
        onOpenChange={setBulkArchiveDialogOpen}
        title="Archive Multiple Positions"
        description={`Are you sure you want to archive ${selectedIds.length} selected positions? This action cannot be undone.`}
        confirmText="Archive All"
        cancelText="Cancel"
        onConfirm={handleBulkArchive}
        variant="destructive"
      />

      <PositionImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onPositionsImported={() => refetchPositions()}
      />
    </div>
  )
}

