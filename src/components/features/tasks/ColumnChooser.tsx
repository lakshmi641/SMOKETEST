'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ArrowUp, ArrowDown, X, Search, Settings2 } from 'lucide-react'
import type { ProjectCustomFieldWithDefinition } from '@/types/custom-field'

interface Column {
  id: string
  label: string
  type: 'standard' | 'custom'
  order: number
}

interface ColumnChooserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  columns: Column[]
  visibleColumns: Set<string>
  onToggleColumn: (columnId: string) => void
  onReorderColumn: (columnId: string, direction: 'up' | 'down') => void
  customFields?: ProjectCustomFieldWithDefinition[]
  onAddCustomField?: () => void
}

export function ColumnChooser({
  open,
  onOpenChange,
  columns,
  visibleColumns,
  onToggleColumn,
  onReorderColumn,
  customFields = [],
  onAddCustomField,
}: ColumnChooserProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredColumns = columns.filter(col =>
    col.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const standardColumns = filteredColumns.filter(col => col.type === 'standard')
  const customFieldColumns = filteredColumns.filter(col => col.type === 'custom')

  const getColumnIndex = (columnId: string) => {
    return columns.findIndex(col => col.id === columnId)
  }

  const canMoveUp = (columnId: string) => {
    const index = getColumnIndex(columnId)
    return index > 0
  }

  const canMoveDown = (columnId: string) => {
    const index = getColumnIndex(columnId)
    return index < columns.length - 1
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Configure columns</DialogTitle>
          <DialogDescription>
            Choose which columns to display and reorder them by dragging or using the arrow buttons.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search columns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Columns List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {/* Standard Columns */}
            {standardColumns.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-2">
                  Standard columns
                </h3>
                <div className="space-y-1">
                  {standardColumns.map((column) => {
                    const index = getColumnIndex(column.id)
                    const isVisible = visibleColumns.has(column.id)
                    return (
                      <div
                        key={column.id}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 group"
                      >
                        <Checkbox
                          checked={isVisible}
                          onCheckedChange={() => onToggleColumn(column.id)}
                        />
                        <span className="flex-1 text-sm">{column.label}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onReorderColumn(column.id, 'up')}
                            disabled={!canMoveUp(column.id)}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onReorderColumn(column.id, 'down')}
                            disabled={!canMoveDown(column.id)}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Custom Field Columns */}
            {customFieldColumns.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-2">
                  Custom fields
                </h3>
                <div className="space-y-1">
                  {customFieldColumns.map((column) => {
                    const index = getColumnIndex(column.id)
                    const isVisible = visibleColumns.has(column.id)
                    return (
                      <div
                        key={column.id}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 group"
                      >
                        <Checkbox
                          checked={isVisible}
                          onCheckedChange={() => onToggleColumn(column.id)}
                        />
                        <span className="flex-1 text-sm">{column.label}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onReorderColumn(column.id, 'up')}
                            disabled={!canMoveUp(column.id)}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onReorderColumn(column.id, 'down')}
                            disabled={!canMoveDown(column.id)}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Add Custom Field Button */}
            {onAddCustomField && (
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onAddCustomField}
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  Add custom field
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

