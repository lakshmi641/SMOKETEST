'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCompany, useIsCompanyAdmin } from '@/contexts/CompanyContext'
import { useProjectCustomFields } from '@/hooks/useProjectCustomFields'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type {
  CustomFieldType,
  CustomFieldDefinition,
  CustomFieldOption,
  NumberFormat,
  ProjectCustomFieldWithDefinition,
} from '@/types/custom-field'
import type { FormulaDefinition } from '@/types/formula'
import { FormulaEditor } from './formula'
import {
  ChevronDown,
  CheckSquare,
  Calendar,
  User,
  Type,
  Hash,
  Search,
  Filter,
  MoreVertical,
  Trash2,
  Plus,
  X,
  Eye,
  FunctionSquare,
} from 'lucide-react'
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

interface CreateCustomFieldModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  companyId: string
  onFieldCreated?: () => void
  initialFieldType?: CustomFieldType | null // Pre-select field type when opening from dropdown
  editingField?: any // Field to edit (ProjectCustomFieldWithDefinition)
}

const FIELD_TYPE_OPTIONS: Array<{ value: CustomFieldType; label: string }> = [
  { value: 'single', label: 'Single select' },
  { value: 'multi', label: 'Multi select' },
  { value: 'date', label: 'Date' },
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
]

const COLOR_OPTIONS = [
  { value: 'blue', label: 'Blue', color: '#3b82f6' },
  { value: 'green', label: 'Green', color: '#10b981' },
  { value: 'red', label: 'Red', color: '#ef4444' },
  { value: 'orange', label: 'Orange', color: '#f59e0b' },
  { value: 'purple', label: 'Purple', color: '#8b5cf6' },
  { value: 'pink', label: 'Pink', color: '#ec4899' },
  { value: 'yellow', label: 'Yellow', color: '#eab308' },
  { value: 'gray', label: 'Gray', color: '#6b7280' },
]

const NUMBER_FORMAT_OPTIONS: Array<{ value: NumberFormat; label: string }> = [
  { value: 'number', label: 'Number' },
  { value: 'percent', label: 'Percent' },
  { value: 'currency', label: 'Currency' },
  { value: 'custom', label: 'Custom label' },
  { value: 'none', label: 'None' },
]

export function CreateCustomFieldModal({
  open,
  onOpenChange,
  projectId,
  companyId,
  onFieldCreated,
  initialFieldType = null,
  editingField = null,
}: CreateCustomFieldModalProps) {
  const { currentCompany } = useCompany()
  const { user } = useAuthStore()
  const isAdmin = useIsCompanyAdmin()
  const { definitions, projectFields, loading, createDefinition, updateDefinition, archiveDefinition, enableField, updateProjectValue, refresh } =
    useProjectCustomFields(projectId, companyId)

  // If initialFieldType is provided, open on 'create' tab with that type, otherwise default to 'library'
  const [activeTab, setActiveTab] = useState<'create' | 'library'>(
    initialFieldType ? 'create' : 'library'
  )
  const [fieldName, setFieldName] = useState('')
  const [fieldType, setFieldType] = useState<CustomFieldType>(
    initialFieldType || 'single'
  )
  const [value, setValue] = useState('')
  const [units, setUnits] = useState('')
  const [addToLibrary, setAddToLibrary] = useState(false) // Optional, default false
  const [category] = useState<'General' | 'Technical' | 'Financial' | 'Other'>('General')

  // Update field type when initialFieldType changes (when modal opens with pre-selected type)
  useEffect(() => {
    if (initialFieldType) {
      setFieldType(initialFieldType)
      setActiveTab('create')
    }
  }, [initialFieldType])

  // Single/Multi select options
  const [options, setOptions] = useState<CustomFieldOption[]>([
    { id: '1', label: '', color: 'blue' },
  ])

  // Number field settings
  const [numberFormat, setNumberFormat] = useState<NumberFormat>('number')
  const [decimals, setDecimals] = useState(0)
  const [customLabel, setCustomLabel] = useState('')

  // Formula field settings
  const [formula, setFormula] = useState<FormulaDefinition | undefined>(undefined)

  // Library tab state
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<CustomFieldType | 'all'>('all')
  const [viewingField, setViewingField] = useState<CustomFieldDefinition | null>(null)
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Reset form when modal opens or when editingField changes
  useEffect(() => {
    if (open) {
      if (editingField) {
        // Populate form with editing field data
        const def = editingField.definition
        setFieldName(def.name)
        setFieldType(def.type)
        setValue(def.value || '')
        setUnits(def.units || '')
        // If field is archived (not in library), default checkbox to unchecked
        // If field is in library (isArchived: false), keep it checked
        setAddToLibrary(!def.isArchived)
        setOptions(def.options || [{ id: '1', label: '', color: 'blue' }])
        setNumberFormat(def.format || 'number')
        setDecimals(def.decimals || 0)
        setCustomLabel(def.customLabel || '')
        setFormula(def.formula || undefined)
        setActiveTab('create')
      } else {
        // Reset for new field
        setFieldName('')
        setFieldType(initialFieldType || 'single')
        setFieldType(initialFieldType || 'text')
        setValue('')
        setUnits('')
        setAddToLibrary(false) // Default to false - optional
        setOptions([{ id: '1', label: '', color: 'blue' }])
        setNumberFormat('number')
        setDecimals(0)
        setCustomLabel('')
        setFormula(undefined)
        setActiveTab(initialFieldType ? 'create' : 'library')
      }
      setSearchQuery('')
      setTypeFilter('all')
    }
  }, [open, initialFieldType, editingField])

  // Get enabled field IDs (must be before filteredDefinitions since it uses this)
  const enabledFieldIds = useMemo(
    () => new Set(projectFields.map(f => f.id)),
    [projectFields]
  )

  // Filter definitions for library tab - deduplicate by name and show all fields (available to everyone)
  const filteredDefinitions = useMemo(() => {
    // Show all non-archived fields to everyone (library is shared)
    let filtered = definitions.filter(d => !d.isArchived)

    // Deduplicate by name (keep the most recent one)
    const seen = new Map<string, CustomFieldDefinition>()
    filtered.forEach(def => {
      const existing = seen.get(def.name.toLowerCase())
      if (!existing || new Date(def.createdAt) > new Date(existing.createdAt)) {
        seen.set(def.name.toLowerCase(), def)
      }
    })
    filtered = Array.from(seen.values())

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(d => d.type === typeFilter)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        d =>
          d.name.toLowerCase().includes(query) ||
          (d.value && d.value.toLowerCase().includes(query)) ||
          (d.units && d.units.toLowerCase().includes(query))
      )
    }

    // Filter out fields already enabled for this project
    filtered = filtered.filter(d => !enabledFieldIds.has(d.id))

    // Sort by most recent
    return filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return dateB - dateA
    })
  }, [definitions, searchQuery, typeFilter, enabledFieldIds])

  // Memoize available fields for Formula Editor to prevent infinite loops
  const formulaAvailableFields = useMemo(() => {
    return projectFields
      .map(pf => {
        const def = pf.definition || definitions.find(d => d.id === pf.id)
        if (!def) return null

        return {
          ...pf,
          definition: def
        }
      })
      .filter((f): f is ProjectCustomFieldWithDefinition =>
        f !== null && f.definition.name !== 'Unknown'
      )
  }, [projectFields, definitions])

  const handleAddOption = () => {
    const newId = String(Date.now())
    setOptions([...options, { id: newId, label: '', color: 'blue' }])
  }

  const handleRemoveOption = (id: string) => {
    if (options.length > 1) {
      setOptions(options.filter(opt => opt.id !== id))
    }
  }

  const handleUpdateOption = (id: string, updates: Partial<CustomFieldOption>) => {
    setOptions(options.map(opt => (opt.id === id ? { ...opt, ...updates } : opt)))
  }

  const handleCreateField = async () => {
    if (!fieldName.trim()) {
      toast.error('Field name is required')
      return
    }

    if (!value.trim()) {
      toast.error('Value is required')
      return
    }

    if (!user?.id) {
      toast.error('User not authenticated')
      return
    }

    // Validate number field
    if (fieldType === 'number' && numberFormat === 'custom' && !customLabel.trim()) {
      toast.error('Custom label is required for custom format')
      return
    }

    // Validate formula field
    if (fieldType === 'formula' && !formula) {
      toast.error('Formula is required')
      return
    }

    // Check for duplicate field name (case-insensitive)
    const normalizedName = fieldName.trim().toLowerCase()

    // Check against existing project fields
    // Note: If editing, exclude the current field from check
    const duplicate = projectFields.find(f =>
      f.definition.name.toLowerCase() === normalizedName &&
      (!editingField || f.id !== editingField.id)
    )

    if (duplicate) {
      toast.error('A field with this name already exists in this project')
      return
    }

    try {
      if (editingField) {
        // Update existing field
        const definitionData: Partial<CustomFieldDefinition> = {
          name: fieldName.trim(),
          type: fieldType, // Include type to allow changing field type
          value: value.trim(),
          ...(units.trim() ? { units: units.trim() } : {}),
          // Include number field settings
          ...(fieldType === 'number'
            ? {
              format: numberFormat,
              decimals,
              // Only include customLabel if it has a value
              ...(numberFormat === 'custom' && customLabel.trim()
                ? { customLabel: customLabel.trim() }
                : {}),
            }
            : {}),
          // Include formula field settings
          ...(fieldType === 'formula' && formula
            ? {
              formula,
              format: numberFormat,
              decimals,
              ...(numberFormat === 'custom' && customLabel.trim()
                ? { customLabel: customLabel.trim() }
                : {}),
            }
            : {}),
          // Handle library visibility based on checkbox
          // If checked, ensure field is visible in library (not archived)
          // If unchecked, archive it (remove from library)
          isArchived: !addToLibrary,
        }

        if (updateDefinition) {
          await updateDefinition(editingField.definition.id, definitionData)
          toast.success(addToLibrary ? 'Field updated and added to library' : 'Field updated')
          onFieldCreated?.()
          onOpenChange(false)
        } else {
          toast.error('Update functionality not available')
        }
      } else {
        // Create new field
        const definitionData: Omit<CustomFieldDefinition, 'id' | 'createdAt' | 'updatedAt'> = {
          name: fieldName.trim(),
          type: fieldType,
          createdBy: user.id,
          category,
          value: value.trim(),
          ...(units.trim() ? { units: units.trim() } : {}),
          // Include number field settings
          ...(fieldType === 'number'
            ? {
              format: numberFormat,
              decimals,
              // Only include customLabel if it has a value
              ...(numberFormat === 'custom' && customLabel.trim()
                ? { customLabel: customLabel.trim() }
                : {}),
            }
            : {}),
          // Include formula field settings
          ...(fieldType === 'formula' && formula
            ? {
              formula,
              format: numberFormat,
              decimals,
              ...(numberFormat === 'custom' && customLabel.trim()
                ? { customLabel: customLabel.trim() }
                : {}),
            }
            : {}),
        }

        const fieldId = await createDefinition(definitionData, addToLibrary)

        // Update category if set (using a separate call or part of creation if supported)
        if (category !== 'General') {
          await updateDefinition(fieldId, { category })
        }

        // Enable field for project
        const nextOrder = projectFields.length > 0 ? Math.max(...projectFields.map(f => f.order)) + 1 : 0
        await enableField(fieldId, nextOrder)

        toast.success('Field created and added to project')
        onFieldCreated?.()
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Error creating/updating field:', error)
      toast.error(error instanceof Error ? error.message : `Failed to ${editingField ? 'update' : 'create'} field`)
    }
  }

  const handleAddFromLibrary = async (fieldId: string) => {
    // Check if field is already enabled
    if (enabledFieldIds.has(fieldId)) {
      const field = definitions.find(d => d.id === fieldId)
      toast.error(`Field "${field?.name || 'This field'}" is already added to this project`)
      return
    }

    // Check for duplicate by name (case-insensitive)
    const fieldToAdd = definitions.find(d => d.id === fieldId)
    if (fieldToAdd) {
      const duplicateField = projectFields.find(
        pf => pf.definition.name.toLowerCase() === fieldToAdd.name.toLowerCase()
      )
      if (duplicateField) {
        toast.error(`A field named "${fieldToAdd.name}" already exists in this project`)
        return
      }
    }

    try {
      const nextOrder = projectFields.length > 0 ? Math.max(...projectFields.map(f => f.order)) + 1 : 0
      await enableField(fieldId, nextOrder)
      toast.success('Field added to project')
      onFieldCreated?.()
      // Keep modal open so user can add more fields if needed
    } catch (error) {
      console.error('Error adding field:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add field')
    }
  }

  const handleDeleteFromLibrary = async () => {
    if (!deleteFieldId) return

    try {
      console.debug('[CustomField] delete start', {
        fieldId: deleteFieldId,
        userId: user?.id,
        isAdmin
      })
      await archiveDefinition(deleteFieldId)
      console.debug('[CustomField] delete success', { fieldId: deleteFieldId })
      toast.success('Field removed from library')
      await refresh()
      setShowDeleteDialog(false)
      setDeleteFieldId(null)
    } catch (error) {
      console.error('[CustomField] delete error', {
        fieldId: deleteFieldId,
        userId: user?.id,
        isAdmin,
        error
      })
      toast.error(error instanceof Error ? error.message : 'Failed to delete field')
    }
  }

  const getFieldTypeIcon = (type: CustomFieldType) => {
    switch (type) {
      case 'date':
        return <Calendar className="h-4 w-4" />
      case 'people':
        return <User className="h-4 w-4" />
      case 'text':
        return <Type className="h-4 w-4" />
      case 'number':
        return <Hash className="h-4 w-4" />
      case 'formula':
        return <FunctionSquare className="h-4 w-4" />
      case 'file':
        return <Plus className="h-4 w-4" /> // Placeholder for file icon
      default:
        return <Type className="h-4 w-4" />
    }
  }

  const formatNumberExample = (): string => {
    const value = 1234.567
    const formatted = value.toFixed(decimals)

    switch (numberFormat) {
      case 'percent':
        return `${formatted}%`
      case 'currency':
        return `$${formatted}`
      case 'custom':
        return `${formatted} ${customLabel || 'unit'}`
      case 'none':
        return formatted
      default:
        return formatted
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Custom Field</DialogTitle>
            <DialogDescription>
              Create a new custom field for this project or choose from your library.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'create' | 'library')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create new</TabsTrigger>
              <TabsTrigger value="library">Choose from library</TabsTrigger>
            </TabsList>

            {/* Create New Tab */}
            <TabsContent value="create" className="space-y-6 mt-6 pb-4">
              <div className="space-y-4">
                {/* 1. Field Name */}
                <div className="space-y-2">
                  <Label htmlFor="field-name" className="text-sm font-bold text-slate-700">
                    Field Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="field-name"
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    placeholder="e.g. Soil Test Report, Project Completion Date"
                    className="h-10"
                  />
                </div>

                {/* 2. Data Type */}
                <div className="space-y-2">
                  <Label htmlFor="field-type" className="text-sm font-bold text-slate-700">
                    Data Type <span className="text-red-500">*</span>
                  </Label>
                  <Select value={fieldType} onValueChange={(v) => setFieldType(v as CustomFieldType)}>
                    <SelectTrigger id="field-type" className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Short Text</SelectItem>
                      <SelectItem value="number">Number / Currency</SelectItem>
                      <SelectItem value="date">Date Picker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. Value */}
                <div className="space-y-2">
                  <Label htmlFor="value" className="text-sm font-bold text-slate-700">
                    Value <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="value"
                    type={fieldType === 'date' ? 'date' : 'text'}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={fieldType === 'date' ? "" : "Provide a value for this field..."}
                    className="h-10"
                  />
                </div>

                {/* 4. Units */}
                <div className="space-y-2">
                  <Label htmlFor="units" className="text-sm font-bold text-slate-700">Units</Label>
                  <Input
                    id="units"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    placeholder="e.g. Metric Tons, MW, etc. (Optional)"
                    className="h-10"
                  />
                </div>
              </div>

              {/* Advanced / Specific Settings Section */}
              <div className="pt-6 border-t border-slate-100">
                <div className="space-y-6">
                  {/* Number Field Settings */}

                  {/* Formula Field */}
                  {fieldType === 'formula' && (
                    <div className="space-y-2 p-4 bg-blue-50/30 rounded-xl border border-blue-100">
                      <Label className="text-xs font-bold text-blue-700">Formula Configuration</Label>
                      <FormulaEditor
                        formula={formula}
                        onChange={setFormula}
                        availableFields={formulaAvailableFields}
                        excludeFieldId={editingField?.definition?.id}
                        format={numberFormat}
                        decimals={decimals}
                        customLabel={customLabel}
                        onFormatChange={setNumberFormat}
                        onDecimalsChange={setDecimals}
                        onCustomLabelChange={setCustomLabel}
                      />
                    </div>
                  )}

                  {/* Library Toggle */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="add-to-library"
                        checked={addToLibrary}
                        onCheckedChange={(checked) => setAddToLibrary(checked as boolean)}
                      />
                      <Label htmlFor="add-to-library" className="text-sm text-slate-600 cursor-pointer">
                        Save this field to organization library
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="library" className="space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Find a field in ${currentCompany?.name || 'your org'}`}
                    className="pl-9"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Filter className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setTypeFilter('all')}>
                      All types
                    </DropdownMenuItem>
                    {FIELD_TYPE_OPTIONS.map(opt => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => setTypeFilter(opt.value)}
                      >
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div>
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-20 bg-muted animate-pulse rounded-md" />
                    ))}
                  </div>
                ) : filteredDefinitions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No fields in library.</p>
                    <p className="text-sm mt-1">
                      Create a new field and add it to library to reuse it.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredDefinitions.map(def => (
                      <div
                        key={def.id}
                        className="flex items-start gap-3 p-3 border rounded-md hover:bg-accent"
                      >
                        <div className="mt-1">{getFieldTypeIcon(def.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{def.name}</p>
                          {def.value && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {def.value} {def.units ? `(${def.units})` : ''}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              setViewingField(def)
                            }}
                            title="View configuration"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAddFromLibrary(def.id)
                                }}
                                disabled={enabledFieldIds.has(def.id)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                {enabledFieldIds.has(def.id) ? 'Already added' : 'Add to project'}
                              </DropdownMenuItem>
                              {(isAdmin || def.createdBy === user?.id) && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDeleteFieldId(def.id)
                                    setShowDeleteDialog(true)
                                  }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            {activeTab === 'create' && (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateField}>
                  {editingField ? 'Update field' : 'Create field'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Field Configuration Dialog */}
      <Dialog open={!!viewingField} onOpenChange={(open) => !open && setViewingField(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {viewingField && getFieldTypeIcon(viewingField.type)}
              <div>
                <DialogTitle className="text-2xl">Field Configuration</DialogTitle>
                <DialogDescription className="mt-1">
                  View the configuration for <span className="font-semibold text-foreground">"{viewingField?.name}"</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {viewingField && (
            <div className="space-y-6 py-4">
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase">Field Name</Label>
                    <p className="text-base font-medium">{viewingField.name}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase">Field Type</Label>
                    <div className="flex items-center gap-2">
                      {getFieldTypeIcon(viewingField.type)}
                      <p className="text-base font-medium capitalize">
                        {viewingField.type === 'single' ? 'Single Select' : viewingField.type === 'multi' ? 'Multi Select' : viewingField.type}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase">Value</Label>
                    <p className="text-sm text-muted-foreground leading-relaxed">{viewingField.value}</p>
                  </div>
                  {viewingField.units && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase">Units</Label>
                      <p className="text-sm text-muted-foreground leading-relaxed">{viewingField.units}</p>
                    </div>
                  )}
                </div>
              </div>

              {(viewingField.type === 'single' || viewingField.type === 'multi') && viewingField.options && viewingField.options.length > 0 && (
                <div className="rounded-lg border bg-card p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Options</h3>
                  <div className="flex flex-wrap gap-2">
                    {viewingField.options.map(opt => {
                      const colorData = COLOR_OPTIONS.find(c => c.value === opt.color) || COLOR_OPTIONS[0]
                      return (
                        <div
                          key={opt.id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium"
                          style={{
                            backgroundColor: (colorData?.color || '#cbd5e1') + '15',
                            borderColor: (colorData?.color || '#cbd5e1') + '40',
                            color: colorData?.color || '#64748b',
                          }}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: colorData?.color || '#cbd5e1' }}
                          />
                          <span>{opt.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {viewingField.type === 'number' && (
                <div className="rounded-lg border bg-card p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Number settings</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase">Format</Label>
                      <p className="text-base font-medium capitalize">{viewingField.format || 'number'}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase">Decimal Places</Label>
                      <p className="text-base font-medium">{viewingField.decimals ?? 0}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingField(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Field Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Field</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this field?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteFieldId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFromLibrary} className="bg-destructive hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

