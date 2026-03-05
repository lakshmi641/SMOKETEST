'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Wand2,
  Sparkles,
  Check
} from 'lucide-react'
import type {
  ValidatedPositionRow,
  ValidatedHierarchyRow,
  CellValidationMessage,
} from '@/lib/services/org/position-import-service'
import type { Position, OrgUnit } from '@/types/org-schema'

interface PositionImportReviewTableProps {
  rows: ValidatedPositionRow[]
  headers: string[]
  orgUnits: OrgUnit[]
  onRowUpdate: (rowNumber: number, field: string, value: string) => void
}

interface HierarchyImportReviewTableProps {
  rows: ValidatedHierarchyRow[]
  headers: string[]
  positions: Position[]
  onRowUpdate: (rowNumber: number, field: string, value: string) => void
}

// ============================================================================
// STATUS ICON
// ============================================================================

function StatusIcon({ status }: { status: 'success' | 'warning' | 'error' }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-500" />
    case 'error':
      return <AlertCircle className="w-4 h-4 text-rose-500" />
  }
}

// ============================================================================
// EDITABLE CELL
// ============================================================================

interface EditableCellProps {
  value: string
  field: string
  message?: CellValidationMessage
  isEditing: boolean
  onStartEdit: () => void
  onEndEdit: (newValue: string) => void
  onCancel: () => void
  options?: { label: string; value: string }[]
  onSelectOption?: (value: string) => void
}

function EditableCell({
  value,
  field,
  message,
  isEditing,
  onStartEdit,
  onEndEdit,
  onCancel,
  options,
  onSelectOption
}: EditableCellProps) {
  const [tempValue, setTempValue] = useState(value)
  const [popoverOpen, setPopoverOpen] = useState(false)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onEndEdit(tempValue)
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  const handleBlur = () => {
    if (tempValue !== value) {
      onEndEdit(tempValue)
    } else {
      onCancel()
    }
  }

  return (
    <div
      className={cn(
        "relative px-3 py-2 h-full flex items-center gap-2 cursor-text transition-colors min-h-[40px]",
        message?.severity === 'error' && "bg-rose-50 dark:bg-rose-950/30",
        message?.severity === 'warning' && "bg-amber-50 dark:bg-amber-950/30",
        isEditing && "bg-background p-1 ring-2 ring-primary/50"
      )}
      onDoubleClick={() => !isEditing && onStartEdit()}
    >
      {isEditing ? (
        <Input
          autoFocus
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="h-8 w-full text-xs"
        />
      ) : (
        <>
          <span
            className={cn(
              "truncate flex-1 text-sm",
              !value && "text-muted-foreground/50 italic text-xs",
              message?.severity === 'error' && "text-rose-700 dark:text-rose-400 font-medium",
              message?.severity === 'warning' && "text-amber-700 dark:text-amber-400"
            )}
          >
            {value || 'Click to edit...'}
          </span>

          {/* Error/Warning indicator with tooltip */}
          {message && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="shrink-0">
                    {message.severity === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-3">
                  <p className="text-xs font-semibold mb-1 text-rose-600 uppercase">Issue</p>
                  <p className="text-xs">{message.message}</p>
                  {message.suggestion && (
                    <p className="text-xs mt-2 text-emerald-600">
                      Suggestion: <strong>{message.suggestion.label}</strong> ({Math.round(message.suggestion.confidence * 100)}% match)
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Resolve/Select button */}
          {message && options && options.length > 0 && (
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-[10px] font-bold uppercase rounded shrink-0",
                    message.severity === 'error'
                      ? "bg-rose-100 text-rose-600 hover:bg-rose-200"
                      : "bg-amber-100 text-amber-600 hover:bg-amber-200"
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    setPopoverOpen(true)
                  }}
                >
                  <Wand2 className="w-3 h-3 mr-1" />
                  {message.severity === 'error' ? 'Resolve' : 'Select'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-64" align="start">
                <Command>
                  <CommandInput placeholder={`Search ${field}...`} className="h-9" />
                  <CommandList className="max-h-48 overflow-y-auto">
                    <CommandEmpty>No options found.</CommandEmpty>
                    <CommandGroup>
                      {/* Show suggestion first if available */}
                      {message.suggestion && (
                        <CommandItem
                          onSelect={() => {
                            onSelectOption?.(message.suggestion!.label)
                            setPopoverOpen(false)
                          }}
                          className="bg-emerald-50 dark:bg-emerald-950/30"
                        >
                          <div className="flex items-center gap-2 w-full">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="flex-1 font-medium">{message.suggestion.label}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {Math.round(message.suggestion.confidence * 100)}%
                            </Badge>
                          </div>
                        </CommandItem>
                      )}
                      {options.map((opt) => (
                        <CommandItem
                          key={opt.value}
                          onSelect={() => {
                            onSelectOption?.(opt.label)
                            setPopoverOpen(false)
                          }}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{opt.label}</span>
                            {opt.label.toLowerCase() === value.toLowerCase() && (
                              <Check className="w-3.5 h-3.5 text-primary" />
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================================
// POSITION IMPORT REVIEW TABLE
// ============================================================================

export function PositionImportReviewTable({
  rows,
  headers,
  orgUnits,
  onRowUpdate
}: PositionImportReviewTableProps) {
  const [editingCell, setEditingCell] = useState<{ rowNumber: number; field: string } | null>(null)

  // Create org unit options
  const orgUnitOptions = useMemo(() =>
    orgUnits.map(ou => ({
      label: ou.name,
      value: ou.id
    })),
    [orgUnits]
  )

  const getMessageForField = (row: ValidatedPositionRow, field: string): CellValidationMessage | undefined => {
    return row.messages.find(m => m.field === field)
  }

  const getOptionsForField = (field: string): { label: string; value: string }[] => {
    if (field === 'Org Unit') {
      return orgUnitOptions
    }
    if (field === 'Employment Type') {
      return [
        { label: 'full_time', value: 'full_time' },
        { label: 'part_time', value: 'part_time' },
        { label: 'contract', value: 'contract' },
        { label: 'temporary', value: 'temporary' },
      ]
    }
    if (field === 'Status') {
      return [
        { label: 'active', value: 'active' },
        { label: 'inactive', value: 'inactive' },
      ]
    }
    return []
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <ScrollArea className="h-[400px]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left font-medium w-12">Status</th>
              <th className="px-3 py-2 text-left font-medium w-12">Row</th>
              {headers.map(header => (
                <th key={header} className="px-3 py-2 text-left font-medium min-w-[120px]">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(row => (
              <tr
                key={row.rowNumber}
                className={cn(
                  "hover:bg-muted/30 transition-colors",
                  row.status === 'error' && "bg-rose-50/50 dark:bg-rose-950/10",
                  row.status === 'warning' && "bg-amber-50/50 dark:bg-amber-950/10"
                )}
              >
                <td className="px-3 py-2 text-center">
                  <StatusIcon status={row.status} />
                </td>
                <td className="px-3 py-2 text-muted-foreground text-xs">
                  {row.rowNumber}
                </td>
                {headers.map(header => {
                  const message = getMessageForField(row, header)
                  const isEditing = editingCell?.rowNumber === row.rowNumber && editingCell?.field === header
                  const options = getOptionsForField(header)
                  const hasOptions = options.length > 0 || message?.suggestion

                  return (
                    <td key={header} className="p-0 border-l">
                      <EditableCell
                        value={row.data[header] || ''}
                        field={header}
                        message={message}
                        isEditing={isEditing}
                        onStartEdit={() => setEditingCell({ rowNumber: row.rowNumber, field: header })}
                        onEndEdit={(newValue) => {
                          onRowUpdate(row.rowNumber, header, newValue)
                          setEditingCell(null)
                        }}
                        onCancel={() => setEditingCell(null)}
                        options={hasOptions ? options : undefined}
                        onSelectOption={(value) => {
                          onRowUpdate(row.rowNumber, header, value)
                        }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  )
}

// ============================================================================
// HIERARCHY IMPORT REVIEW TABLE
// ============================================================================

export function HierarchyImportReviewTable({
  rows,
  headers,
  positions,
  onRowUpdate
}: HierarchyImportReviewTableProps) {
  const [editingCell, setEditingCell] = useState<{ rowNumber: number; field: string } | null>(null)

  // Create position options
  const positionOptions = useMemo(() =>
    positions.map(p => ({
      label: p.code,
      value: p.id
    })),
    [positions]
  )

  const getMessageForField = (row: ValidatedHierarchyRow, field: string): CellValidationMessage | undefined => {
    return row.messages.find(m => m.field === field)
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <ScrollArea className="h-[400px]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left font-medium w-12">Status</th>
              <th className="px-3 py-2 text-left font-medium w-12">Row</th>
              {headers.map(header => (
                <th key={header} className="px-3 py-2 text-left font-medium min-w-[150px]">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(row => (
              <tr
                key={row.rowNumber}
                className={cn(
                  "hover:bg-muted/30 transition-colors",
                  row.status === 'error' && "bg-rose-50/50 dark:bg-rose-950/10",
                  row.status === 'warning' && "bg-amber-50/50 dark:bg-amber-950/10"
                )}
              >
                <td className="px-3 py-2 text-center">
                  <StatusIcon status={row.status} />
                </td>
                <td className="px-3 py-2 text-muted-foreground text-xs">
                  {row.rowNumber}
                </td>
                {headers.map(header => {
                  const message = getMessageForField(row, header)
                  const isEditing = editingCell?.rowNumber === row.rowNumber && editingCell?.field === header

                  return (
                    <td key={header} className="p-0 border-l">
                      <EditableCell
                        value={row.data[header] || ''}
                        field={header}
                        message={message}
                        isEditing={isEditing}
                        onStartEdit={() => setEditingCell({ rowNumber: row.rowNumber, field: header })}
                        onEndEdit={(newValue) => {
                          onRowUpdate(row.rowNumber, header, newValue)
                          setEditingCell(null)
                        }}
                        onCancel={() => setEditingCell(null)}
                        options={positionOptions}
                        onSelectOption={(value) => {
                          onRowUpdate(row.rowNumber, header, value)
                        }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  )
}
