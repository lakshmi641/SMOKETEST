'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { useProjectCustomFields } from '@/hooks/useProjectCustomFields'
import { useCompany } from '@/hooks/useCompany'
import { useAuthStore } from '@/store/authStore'
import { UserService } from '@/lib/services'
import type { User } from '@/types'
import type {
  CustomFieldDefinition,
  CustomFieldValue,
  CustomFieldOption,
  NumberFormat,
  ProjectCustomFieldWithDefinition,
} from '@/types/custom-field'
import type { GeneratedTask } from '@/types/task-template-schema'
import { useFormulaEvaluator } from '@/hooks/useFormulaEvaluator'
import {
  Calendar,
  Clock,
  X,
  ChevronDown,
  CheckSquare,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils/date-utils'
import toast from 'react-hot-toast'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface CustomFieldCellProps {
  taskId: string
  field: CustomFieldDefinition
  value: CustomFieldValue | undefined
  companyId: string
  projectId: string
  onValueChange?: (value: CustomFieldValue | null) => void
  task?: GeneratedTask
  allFields?: ProjectCustomFieldWithDefinition[]
  disabled?: boolean
}

const COLOR_MAP: Record<string, string> = {
  blue: '#3b82f6',
  green: '#10b981',
  red: '#ef4444',
  orange: '#f59e0b',
  purple: '#8b5cf6',
  pink: '#ec4899',
  yellow: '#eab308',
  gray: '#6b7280',
}

function formatDateValue(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '-'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dateOnly = new Date(date)
  dateOnly.setHours(0, 0, 0, 0)

  const isToday = dateOnly.getTime() === today.getTime()

  // Always show only date as requested
  if (isToday) {
    return 'Today'
  }

  return formatDate(date)
}

function FormulaFieldCell({
  field,
  task,
  allFields,
  value: fallbackValue,
  onValueChange
}: {
  field: CustomFieldDefinition
  task?: GeneratedTask
  allFields?: ProjectCustomFieldWithDefinition[]
  value: CustomFieldValue | undefined
  onValueChange?: (value: CustomFieldValue | null) => void
}) {
  const result = useFormulaEvaluator({
    formula: field.formula || { expression: '', ast: undefined as any, resultType: 'text', isSimpleMode: false },
    task,
    customFields: task?.customFields || {},
    allFieldDefinitions: allFields || [],
  })

  const formatNumber = (num: number): string => {
    const decimals = field.decimals || 0
    const formatted = num.toFixed(decimals)

    switch (field.format) {
      case 'percent':
        return `${formatted}%`
      case 'currency':
        return `$${formatted}`
      case 'custom':
        return `${formatted} ${field.customLabel || ''}`
      case 'none':
        return formatted
      default:
        return formatted
    }
  }

  // Save computed value if it differs from stored value
  useEffect(() => {
    if (result.success && result.value !== undefined && result.value !== fallbackValue && onValueChange) {
      // Use timeout to avoid render-cycle warnings
      const timer = setTimeout(() => {
        onValueChange(result.value)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [result.success, result.value, fallbackValue, onValueChange])

  // Use computed result if successful, otherwise fallback to prop value
  const value = result.success && result.value !== null ? result.value : fallbackValue

  // Check for error strings first (before date formatting)
  const isErrorString = typeof value === 'string' && value.startsWith('Error:')

  const displayValue = isErrorString ? (
    <span className="text-sm text-red-500">{value}</span>
  ) : typeof value === 'number' ? (
    <span className="text-sm text-muted-foreground">{formatNumber(value)}</span>
  ) : typeof value === 'string' && (field.formula?.resultType === 'date' || /^\d{4}-\d{2}-\d{2}T/.test(value)) ? (
    <span className="text-sm text-muted-foreground">{formatDateValue(value)}</span>
  ) : value !== null && value !== undefined ? (
    <span className="text-sm text-muted-foreground">{String(value)}</span>
  ) : (
    <span className="text-muted-foreground">—</span>
  )

  return (
    <div className="min-w-[150px]">
      {displayValue}
    </div>
  )
}

export function CustomFieldCell({
  taskId,
  field,
  value,
  companyId,
  projectId,
  onValueChange,
  task,
  allFields,
  disabled
}: CustomFieldCellProps) {
  const { updateTaskValue } = useProjectCustomFields(projectId, companyId)
  const { groupId } = useCompany()
  const { user: currentUser } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const initialValue = (value !== undefined && value !== null && value !== '') ? value : (field.value || null)
  const [localValue, setLocalValue] = useState<CustomFieldValue | null>(initialValue)
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date())
  const [textInputValue, setTextInputValue] = useState<string>('')
  const [numberInputValue, setNumberInputValue] = useState<string>('')
  const [peopleSearchQuery, setPeopleSearchQuery] = useState('')

  const filteredUsers = useMemo(() => {
    if (!peopleSearchQuery.trim()) return users
    const query = peopleSearchQuery.toLowerCase()
    return users.filter(u =>
      (u.name?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query))
    )
  }, [users, peopleSearchQuery])

  // Load users for People field
  useEffect(() => {
    if (field.type === 'people' && companyId) {
      loadUsers()
    }
  }, [field.type, companyId])

  // Initialize local values
  useEffect(() => {
    const newValue = (value !== undefined && value !== null && value !== '') ? value : (field.value || null)
    setLocalValue(newValue)
    if (field.type === 'text') {
      setTextInputValue(typeof value === 'string' ? value : '')
    } else if (field.type === 'number') {
      // Handle both number and string values
      const numVal = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : NaN)
      setNumberInputValue(!isNaN(numVal) ? String(numVal) : '')
    } else if (field.type === 'date' && typeof value === 'string') {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        const dateStr = date.toISOString().split('T')[0]
        if (dateStr) {
          setSelectedDate(dateStr)
          const timeStr = date.toTimeString().slice(0, 5)
          if (timeStr) {
            setSelectedTime(timeStr)
          }
        }
      }
    }
  }, [value, field.type])

  const loadUsers = async () => {
    try {
      setLoadingUsers(true)
      const usersData = await UserService.getUsers(companyId)
      setUsers(usersData)
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoadingUsers(false)
    }
  }

  // Format custom field value for activity log display
  const formatValueForLog = useCallback((val: CustomFieldValue | null | undefined): string => {
    if (val === null || val === undefined || val === '') return 'none'

    if (field.type === 'single') {
      const option = field.options?.find(opt => opt.id === val)
      return option?.label || String(val)
    }
    if (field.type === 'multi') {
      if (Array.isArray(val)) {
        const labels = val.map(id => {
          const option = field.options?.find(opt => opt.id === id)
          return option?.label || id
        })
        return labels.length > 0 ? labels.join(', ') : 'none'
      }
      return String(val)
    }
    if (field.type === 'people') {
      if (Array.isArray(val)) {
        const names = val.map(id => {
          const u = users.find(u => u.id === id)
          return u?.name || u?.email || id
        })
        return names.length > 0 ? names.join(', ') : 'none'
      }
      const u = users.find(u => u.id === val)
      return u?.name || u?.email || String(val)
    }
    if (field.type === 'date') {
      return formatDateValue(String(val))
    }
    return String(val)
  }, [field, users])

  const handleSave = useCallback(
    async (newValue: CustomFieldValue | null) => {
      // Skip save if value hasn't changed
      if (newValue === value || (newValue === null && (value === undefined || value === null || value === ''))) {
        setIsEditing(false)
        return
      }

      // Store old value for activity logging
      const oldValue = value

      // Optimistic update - update UI immediately
      setLocalValue(newValue)
      onValueChange?.(newValue as CustomFieldValue)

      try {
        await updateTaskValue(taskId, field.id, newValue as CustomFieldValue)
        setIsEditing(false)
        toast.success('Field updated')

        // Log activity only for UPDATES (not initial value setting)
        // Skip if oldValue was empty (null, undefined, '', or empty array)
        const oldValueIsEmpty = oldValue === null || oldValue === undefined || oldValue === '' ||
          (Array.isArray(oldValue) && oldValue.length === 0)

        if (!oldValueIsEmpty && currentUser?.id && projectId) {
          // Only log when editing an existing value
          import('@/lib/services/task-activity-service')
            .then(({ logFieldChanged }) => {
              return logFieldChanged(
                companyId,
                taskId,
                projectId,
                `customField_${field.id}`,
                field.name,
                formatValueForLog(oldValue),
                formatValueForLog(newValue),
                currentUser.id,
                currentUser.name || 'Unknown User',
                groupId ?? undefined
              )
            })
            .catch((err) => console.error('[Activity] Failed to log custom field change:', err))
        }
      } catch (error) {
        console.error('[CustomFieldCell.handleSave] Error updating field value:', error)
        toast.error('Failed to update field')
        // Rollback on error
        setLocalValue(value || null)
        onValueChange?.(value as CustomFieldValue)
      }
    },
    [taskId, field.id, field.name, updateTaskValue, onValueChange, value, currentUser, companyId, projectId, groupId, formatValueForLog]
  )

  // Single Select
  if (field.type === 'single') {
    // Use localValue for display to show immediate updates
    const currentValue = localValue || value
    const selectedOption = field.options?.find(opt => opt.id === currentValue)
    const displayValue = selectedOption ? (
      <Badge
        variant="outline"
        className="capitalize"
        style={{
          backgroundColor: COLOR_MAP[selectedOption.color] + '20',
          borderColor: COLOR_MAP[selectedOption.color],
          color: COLOR_MAP[selectedOption.color],
        }}
      >
        {selectedOption.label}
      </Badge>
    ) : (
      <span className="text-muted-foreground">-</span>
    )

    return (
      <Popover open={isEditing} onOpenChange={setIsEditing}>
        <PopoverTrigger asChild>
          <div
            className={cn("min-w-[150px]", disabled ? "cursor-default" : "cursor-pointer")}
            onClick={(e) => {
              e.stopPropagation()
              if (!disabled) setIsEditing(true)
            }}
          >
            {displayValue}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[200px] p-0"
          onClick={(e) => e.stopPropagation()}
          align="start"
        >
          <div className="py-1">
            {field.options?.map(opt => {
              const isSelected = currentValue === opt.id
              return (
                <div
                  key={opt.id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm",
                    isSelected && "bg-accent"
                  )}
                  onClick={() => {
                    handleSave(opt.id)
                    setIsEditing(false)
                  }}
                >
                  <div
                    className="w-3 h-3 rounded flex-shrink-0"
                    style={{ backgroundColor: COLOR_MAP[opt.color] }}
                  />
                  <span className="text-sm">{opt.label}</span>
                  {isSelected && (
                    <CheckSquare className="h-4 w-4 ml-auto text-primary" />
                  )}
                </div>
              )
            })}
            {field.options && field.options.length > 0 && (
              <div className="border-t my-1" />
            )}
            <div
              className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm text-muted-foreground"
              onClick={() => {
                handleSave(null)
                setIsEditing(false)
              }}
            >
              <X className="h-4 w-4" />
              <span className="text-sm">Clear</span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // Multi Select
  if (field.type === 'multi') {
    // Use localValue for display to show immediate updates
    const currentValue = localValue || value
    const selectedIds = Array.isArray(currentValue) ? currentValue : []
    const selectedOptions = field.options?.filter(opt => selectedIds.includes(opt.id)) || []
    const displayValue =
      selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map(opt => (
            <Badge
              key={opt.id}
              variant="outline"
              className="capitalize text-xs"
              style={{
                backgroundColor: COLOR_MAP[opt.color] + '20',
                borderColor: COLOR_MAP[opt.color],
                color: COLOR_MAP[opt.color],
              }}
            >
              {opt.label}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      )

    return (
      <Popover open={isEditing} onOpenChange={setIsEditing}>
        <PopoverTrigger asChild>
          <div
            className={cn("min-w-[200px]", disabled ? "cursor-default" : "cursor-pointer")}
            onClick={(e) => {
              e.stopPropagation()
              if (!disabled) setIsEditing(true)
            }}
          >
            {displayValue}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[200px] p-0"
          onClick={(e) => e.stopPropagation()}
          align="start"
        >
          <div className="py-1">
            {field.options?.map(opt => {
              const isSelected = selectedIds.includes(opt.id)
              return (
                <div
                  key={opt.id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm",
                    isSelected && "bg-accent"
                  )}
                  onClick={() => {
                    const oldValue = value
                    const newIds = isSelected
                      ? selectedIds.filter(id => id !== opt.id)
                      : [...selectedIds, opt.id]
                    // Update immediately but don't close popover
                    // Use empty array instead of null for multi-select fields
                    const saveValue: CustomFieldValue = newIds
                    setLocalValue(saveValue)
                    onValueChange?.(saveValue)
                    // Save in background
                    updateTaskValue(taskId, field.id, saveValue)
                      .then(() => {
                        // Log activity for custom field change
                        if (currentUser?.id && projectId) {
                          import('@/lib/services/task-activity-service')
                            .then(({ logFieldChanged }) => {
                              logFieldChanged(
                                companyId,
                                taskId,
                                projectId,
                                `customField_${field.id}`,
                                field.name,
                                formatValueForLog(oldValue),
                                formatValueForLog(saveValue),
                                currentUser.id,
                                currentUser.name || 'Unknown User',
                                groupId ?? undefined
                              )
                            })
                            .catch((err) => console.error('[Activity] Failed to log custom field change:', err))
                        }
                      })
                      .catch((error) => {
                        console.error('Error updating field value:', error)
                        toast.error('Failed to update field')
                        // Rollback on error
                        setLocalValue(value || [])
                        onValueChange?.(value as CustomFieldValue)
                      })
                  }}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      const newIds = checked
                        ? [...selectedIds, opt.id]
                        : selectedIds.filter(id => id !== opt.id)
                      handleSave(newIds.length > 0 ? newIds : null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0"
                  />
                  <div
                    className="w-3 h-3 rounded flex-shrink-0"
                    style={{ backgroundColor: COLOR_MAP[opt.color] }}
                  />
                  <span className="text-sm">{opt.label}</span>
                </div>
              )
            })}
            {field.options && field.options.length > 0 && (
              <div className="border-t my-1" />
            )}
            <div
              className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm text-muted-foreground"
              onClick={() => {
                handleSave(null)
                setIsEditing(false)
              }}
            >
              <X className="h-4 w-4" />
              <span className="text-sm">Clear</span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // Date Field
  if (field.type === 'date') {
    // Use localValue for immediate display
    const currentValue = localValue || value
    const displayValue = currentValue ? formatDateValue(currentValue as string) : <span className="text-muted-foreground">-</span>

    if (isEditing) {
      const generateTimeOptions = (): string[] => {
        const now = new Date()
        const currentHour = now.getHours()
        const currentMinute = now.getMinutes()
        const options: string[] = []

        // Generate times from current backward (last 12 hours)
        for (let i = 0; i < 12; i++) {
          const hour = (currentHour - i + 24) % 24
          const timeStr = `${String(hour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`
          options.push(timeStr)
        }

        return options
      }

      const handleDateSave = () => {
        if (!selectedDate) {
          handleSave(null)
          return
        }

        if (showTimePicker && selectedTime) {
          // Save with time
          const dateTime = `${selectedDate}T${selectedTime}:00`
          const fullDate = new Date(dateTime)
          if (!isNaN(fullDate.getTime())) {
            handleSave(fullDate.toISOString())
          }
        } else {
          // Save date only (midnight UTC to indicate no time)
          const dateOnly = `${selectedDate}T00:00:00.000Z`
          handleSave(dateOnly)
        }
      }

      // Calendar grid generation
      const monthStart = startOfMonth(calendarMonth)
      const monthEnd = endOfMonth(calendarMonth)
      const calendarStart = startOfWeek(monthStart)
      const calendarEnd = endOfWeek(monthEnd)
      const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

      const handleDateClick = (day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        setSelectedDate(dateStr)
        // Auto-save date selection
        if (showTimePicker && selectedTime) {
          // Save with time
          const dateTime = `${dateStr}T${selectedTime}:00`
          const fullDate = new Date(dateTime)
          if (!isNaN(fullDate.getTime())) {
            handleSave(fullDate.toISOString())
          }
        } else {
          // Save date only (midnight UTC to indicate no time)
          const dateOnly = `${dateStr}T00:00:00.000Z`
          handleSave(dateOnly)
        }
      }

      return (
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <div
              className={cn("min-w-[140px]", disabled ? "cursor-default" : "cursor-pointer")}
              onClick={(e) => {
                e.stopPropagation()
                if (!disabled) {
                  setDatePickerOpen(true)
                }
              }}
            >
              {displayValue}
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" onClick={(e) => e.stopPropagation()} align="start">
            <div className="p-4">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="font-medium">
                  {format(calendarMonth, 'MMMM yyyy')}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                  <div key={idx} className="w-8 h-8 flex items-center justify-center text-xs font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  const isCurrentMonth = isSameMonth(day, calendarMonth)
                  const isSelected = selectedDate && isSameDay(day, new Date(selectedDate))
                  const isToday = isSameDay(day, new Date())

                  return (
                    <button
                      key={idx}
                      onClick={() => handleDateClick(day)}
                      className={cn(
                        "w-8 h-8 text-sm rounded-md hover:bg-accent transition-colors",
                        !isCurrentMonth && "text-muted-foreground opacity-50",
                        isSelected && "bg-primary text-primary-foreground",
                        isToday && !isSelected && "bg-accent font-medium"
                      )}
                    >
                      {format(day, 'd')}
                    </button>
                  )
                })}
              </div>

              {/* Time Picker & Actions */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTimePicker(!showTimePicker)}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {showTimePicker ? 'Hide' : 'Add'} time
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedDate('')
                    setSelectedTime('')
                    handleSave(null)
                    setDatePickerOpen(false)
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>

              {showTimePicker && (
                <div className="mt-3">
                  <Select
                    value={selectedTime}
                    onValueChange={(time) => {
                      setSelectedTime(time)
                      if (selectedDate) {
                        const dateTime = `${selectedDate}T${time}:00`
                        const fullDate = new Date(dateTime)
                        if (!isNaN(fullDate.getTime())) {
                          handleSave(fullDate.toISOString())
                        }
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {generateTimeOptions().map(time => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => {
                      const time = e.target.value
                      setSelectedTime(time)
                      if (selectedDate && time) {
                        const dateTime = `${selectedDate}T${time}:00`
                        const fullDate = new Date(dateTime)
                        if (!isNaN(fullDate.getTime())) {
                          handleSave(fullDate.toISOString())
                        }
                      }
                    }}
                    className="mt-2"
                    placeholder="Or type custom time"
                  />
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )
    }

    return (
      <div
        className={cn("min-w-[140px]", disabled ? "cursor-default" : "cursor-pointer")}
        onClick={() => {
          if (!disabled) {
            setIsEditing(true)
            setDatePickerOpen(true)
          }
        }}
      >
        {displayValue}
      </div>
    )
  }

  // People Field
  if (field.type === 'people') {
    // Use localValue for immediate display
    const currentValue = localValue || value
    // For people fields, value is string | string[], ensure we get string[]
    const selectedIds: string[] = Array.isArray(currentValue)
      ? currentValue.filter((id): id is string => typeof id === 'string')
      : (typeof currentValue === 'string' ? [currentValue] : [])
    const selectedUsers = users.filter(u => selectedIds.includes(u.id))

    const getInitials = (name: string): string => {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }

    const displayValue =
      selectedUsers.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedUsers.map(user => (
            <TooltipProvider key={user.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary cursor-pointer">
                    {getInitials(user.name || user.email)}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{user.name || user.email}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      )

    if (isEditing) {
      return (
        <Popover open={isEditing} onOpenChange={setIsEditing}>
          <PopoverTrigger asChild>
            <div
              className={cn("min-w-[200px]", disabled ? "cursor-default" : "cursor-pointer")}
              onClick={(e) => {
                e.stopPropagation()
                if (!disabled) setIsEditing(true)
              }}
            >
              {displayValue}
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="w-[280px] p-0"
            onClick={(e) => e.stopPropagation()}
            align="start"
          >
            <div className="p-2">
              {/* Search Input */}
              <Input
                placeholder="Search people..."
                value={peopleSearchQuery}
                onChange={(e) => setPeopleSearchQuery(e.target.value)}
                className="mb-2"
                autoFocus
              />

              {/* Users List */}
              <div className="max-h-[300px] overflow-y-auto">
                {loadingUsers ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    Loading users...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    {peopleSearchQuery ? 'No users found' : 'No users available'}
                  </div>
                ) : (
                  <>
                    {filteredUsers.map(user => {
                      const isSelected = selectedIds.includes(user.id)
                      return (
                        <div
                          key={user.id}
                          className={cn(
                            "flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-accent rounded-sm",
                            isSelected && "bg-accent"
                          )}
                          onClick={() => {
                            const oldValue = value
                            const newIds = isSelected
                              ? selectedIds.filter(id => id !== user.id)
                              : [...selectedIds, user.id]
                            // Update immediately but don't close popover
                            // For people fields: use string for single selection, array for multiple or empty
                            const saveValue: CustomFieldValue = newIds.length === 1 && newIds[0] ? newIds[0] : newIds
                            setLocalValue(saveValue)
                            onValueChange?.(saveValue)
                            // Save in background
                            updateTaskValue(taskId, field.id, saveValue)
                              .then(() => {
                                // Log activity for custom field change
                                if (currentUser?.id && projectId) {
                                  import('@/lib/services/task-activity-service')
                                    .then(({ logFieldChanged }) => {
                                      logFieldChanged(
                                        companyId,
                                        taskId,
                                        projectId,
                                        `customField_${field.id}`,
                                        field.name,
                                        formatValueForLog(oldValue),
                                        formatValueForLog(saveValue),
                                        currentUser.id,
                                        currentUser.name || 'Unknown User',
                                        groupId ?? undefined
                                      )
                                    })
                                    .catch((err) => console.error('[Activity] Failed to log custom field change:', err))
                                }
                              })
                              .catch((error) => {
                                console.error('Error updating field value:', error)
                                toast.error('Failed to update field')
                                // Rollback on error
                                setLocalValue(value || [])
                                onValueChange?.(value as CustomFieldValue)
                              })
                          }}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const oldValue = value
                              const newIds = checked
                                ? [...selectedIds, user.id]
                                : selectedIds.filter(id => id !== user.id)
                              // For people fields: use string for single selection, array for multiple or empty
                              const saveValue: CustomFieldValue = newIds.length === 1 && newIds[0] ? newIds[0] : newIds
                              setLocalValue(saveValue)
                              onValueChange?.(saveValue)
                              updateTaskValue(taskId, field.id, saveValue)
                                .then(() => {
                                  // Log activity for custom field change
                                  if (currentUser?.id && projectId) {
                                    import('@/lib/services/task-activity-service')
                                      .then(({ logFieldChanged }) => {
                                        logFieldChanged(
                                          companyId,
                                          taskId,
                                          projectId,
                                          `customField_${field.id}`,
                                          field.name,
                                          formatValueForLog(oldValue),
                                          formatValueForLog(saveValue),
                                          currentUser.id,
                                          currentUser.name || 'Unknown User',
                                          groupId ?? undefined
                                        )
                                      })
                                      .catch((err) => console.error('[Activity] Failed to log custom field change:', err))
                                  }
                                })
                                .catch((error) => {
                                  console.error('Error updating field value:', error)
                                  toast.error('Failed to update field')
                                  setLocalValue(value || [])
                                  onValueChange?.(value as CustomFieldValue)
                                })
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-shrink-0"
                          />
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0">
                            {getInitials(user.name || user.email)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.name || user.email}</p>
                            {user.name && (
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>

              {/* Clear Button */}
              {selectedUsers.length > 0 && (
                <>
                  <div className="border-t my-1" />
                  <div
                    className="flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-accent rounded-sm text-muted-foreground"
                    onClick={() => {
                      setLocalValue(null)
                      onValueChange?.(null)
                      handleSave(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                    <span className="text-sm">Clear</span>
                  </div>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )
    }

    return (
      <div
        className={cn("min-w-[200px]", disabled ? "cursor-default" : "cursor-pointer")}
        onClick={() => !disabled && setIsEditing(true)}
      >
        {displayValue}
      </div>
    )
  }

  // Text Field
  if (field.type === 'text') {
    // Use localValue for immediate display
    const currentValue = localValue || value
    const displayValue = currentValue ? (
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{currentValue as string}</span>
        {field.units && (
          <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
            {field.units}
          </span>
        )}
      </div>
    ) : (
      <span className="text-muted-foreground">-</span>
    )

    if (isEditing) {
      return (
        <div className="min-w-[200px]" onClick={(e) => e.stopPropagation()}>
          <Input
            value={textInputValue}
            onChange={(e) => {
              const newVal = e.target.value
              setTextInputValue(newVal)
              // Only update local state for UI - don't call onValueChange here
              // Activity logging happens in handleSave on blur/Enter
              setLocalValue(newVal.trim() || null)
            }}
            onBlur={() => {
              handleSave(textInputValue.trim() || null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSave(textInputValue.trim() || null)
              } else if (e.key === 'Escape') {
                setIsEditing(false)
                setTextInputValue(typeof value === 'string' ? value : '')
                setLocalValue(value || null)
              }
            }}
            autoFocus
            className="h-8"
          />
        </div>
      )
    }

    return (
      <div
        className={cn("min-w-[200px]", disabled ? "cursor-default" : "cursor-pointer")}
        onClick={() => !disabled && setIsEditing(true)}
      >
        {displayValue}
      </div>
    )
  }

  // Number Field
  if (field.type === 'number') {
    const formatNumber = (num: number): string => {
      if (isNaN(num)) return '-'

      const decimals = field.decimals ?? 0
      const formatted = num.toFixed(decimals)

      switch (field.format) {
        case 'percent':
          return `${formatted}%`
        case 'currency':
          return `$${formatted}`
        case 'custom':
          return `${formatted} ${field.units || field.customLabel || ''}`
        case 'none':
          return field.units ? `${formatted} ${field.units}` : formatted
        default:
          return field.units ? `${formatted} ${field.units}` : formatted
      }
    }

    // Use localValue for immediate display
    const currentValue = localValue || value
    // Handle both number and string values (values might be stored as strings)
    const numericValue = typeof currentValue === 'number'
      ? currentValue
      : (typeof currentValue === 'string' && currentValue.trim() !== '' ? parseFloat(currentValue) : NaN)
    const displayValue = !isNaN(numericValue) ? (
      <span className="text-sm">{formatNumber(numericValue)}</span>
    ) : (
      <span className="text-muted-foreground">-</span>
    )

    if (isEditing) {
      return (
        <div className="min-w-[150px]" onClick={(e) => e.stopPropagation()}>
          <Input
            type="number"
            value={numberInputValue}
            onChange={(e) => {
              const val = e.target.value
              setNumberInputValue(val)
              // Only update local state for UI - don't call onValueChange here
              // Activity logging happens in handleSave on blur/Enter
              const num = parseFloat(val)
              if (!isNaN(num)) {
                setLocalValue(num)
              } else if (val === '') {
                setLocalValue(null)
              }
            }}
            onBlur={() => {
              const num = parseFloat(numberInputValue)
              handleSave(isNaN(num) ? null : num)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const num = parseFloat(numberInputValue)
                handleSave(isNaN(num) ? null : num)
              } else if (e.key === 'Escape') {
                setIsEditing(false)
                // Handle both number and string values
                const numVal = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : NaN)
                setNumberInputValue(!isNaN(numVal) ? String(numVal) : '')
                setLocalValue(value || null)
              }
            }}
            step={field.decimals ? `0.${'1'.padStart(field.decimals, '0')}` : '1'}
            autoFocus
            className="h-8"
          />
        </div>
      )
    }

    return (
      <div
        className={cn("min-w-[150px]", disabled ? "cursor-default" : "cursor-pointer")}
        onClick={() => !disabled && setIsEditing(true)}
      >
        {displayValue}
      </div>
    )
  }

  // Formula Field - Display computed value (read-only)
  if (field.type === 'formula') {
    return (
      <FormulaFieldCell
        field={field}
        task={task}
        allFields={allFields}
        value={value}
        onValueChange={handleSave}
      />
    )
  }

  return null
}
