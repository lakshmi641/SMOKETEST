'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Button } from '@/components/ui/button'
import { useProjectCustomFields } from '@/hooks/useProjectCustomFields'
import { useIsCompanyAdmin } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import type { ProjectCustomFieldWithDefinition } from '@/types/custom-field'
import {
  MoreVertical,
  Edit,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  X,
  Trash2,
  ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface CustomFieldColumnMenuProps {
  field: ProjectCustomFieldWithDefinition
  projectId: string
  companyId: string
  allFields: ProjectCustomFieldWithDefinition[]
  onEditField?: (field: ProjectCustomFieldWithDefinition) => void
  onSortChange?: (fieldId: string, direction: 'asc' | 'desc' | null) => void
  currentSort?: { fieldId: string; direction: 'asc' | 'desc' } | null
}

export function CustomFieldColumnMenu({
  field,
  projectId,
  companyId,
  allFields,
  onEditField,
  onSortChange,
  currentSort,
}: CustomFieldColumnMenuProps) {
  const { reorderFields, disableField } = useProjectCustomFields(projectId, companyId)
  const isAdmin = useIsCompanyAdmin()
  const { user } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  
  // Check if user can edit this field (admin or creator)
  const canEdit = isAdmin || field.definition.createdBy === user?.id

  const currentIndex = allFields.findIndex(f => f.id === field.id)
  const canMoveLeft = currentIndex > 0
  const canMoveRight = currentIndex < allFields.length - 1
  const isSorted = currentSort?.fieldId === field.id
  const sortDirection = isSorted ? currentSort.direction : null

  const handleMoveLeft = async () => {
    if (!canMoveLeft) return

    try {
      // Move left = swap with the column to the left (decrease order)
      const newOrders = allFields.map((f, idx) => {
        if (idx === currentIndex - 1) {
          // The column to the left gets this column's order (moves right)
          return { fieldId: f.id, order: field.order }
        } else if (idx === currentIndex) {
          // This column gets the left column's order (moves left)
          const leftField = allFields[currentIndex - 1]
          return { fieldId: f.id, order: leftField?.order ?? field.order }
        }
        return { fieldId: f.id, order: f.order }
      })

      await reorderFields(newOrders)
      toast.success('Column moved left')
    } catch (error) {
      console.error('Error moving column:', error)
      toast.error('Failed to move column')
    }
  }

  const handleMoveRight = async () => {
    if (!canMoveRight) return

    try {
      // Move right = swap with the column to the right (increase order)
      const newOrders = allFields.map((f, idx) => {
        if (idx === currentIndex + 1) {
          // The column to the right gets this column's order (moves left)
          return { fieldId: f.id, order: field.order }
        } else if (idx === currentIndex) {
          // This column gets the right column's order (moves right)
          const rightField = allFields[currentIndex + 1]
          return { fieldId: f.id, order: rightField?.order ?? field.order }
        }
        return { fieldId: f.id, order: f.order }
      })

      await reorderFields(newOrders)
      toast.success('Column moved right')
    } catch (error) {
      console.error('Error moving column:', error)
      toast.error('Failed to move column')
    }
  }

  const handleClearSort = () => {
    onSortChange?.(field.id, null)
    toast.success('Sort cleared')
  }

  const handleReverseSort = () => {
    if (isSorted) {
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      onSortChange?.(field.id, newDirection)
      toast.success(`Sort order reversed to ${newDirection === 'asc' ? 'ascending' : 'descending'}`)
    } else {
      onSortChange?.(field.id, 'asc')
      toast.success('Sort applied (ascending)')
    }
  }

  const handleRemoveField = async () => {
    try {
      await disableField(field.id)
      toast.success('Field removed from project')
      setShowRemoveDialog(false)
    } catch (error) {
      console.error('Error removing field:', error)
      toast.error('Failed to remove field')
    }
  }

  const handleEditField = () => {
    onEditField?.(field)
    setIsOpen(false)
  }

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
            onClick={(e) => e.stopPropagation()}
          >
            <ChevronDown className="h-3.5 w-3.5" />
            <span className="sr-only">Column menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {canEdit && (
            <>
              <DropdownMenuItem onClick={handleEditField}>
                <Edit className="h-4 w-4 mr-2" />
                Edit field
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={handleMoveLeft} disabled={!canMoveLeft}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Move left
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleMoveRight} disabled={!canMoveRight}>
            <ArrowRight className="h-4 w-4 mr-2" />
            Move right
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isSorted ? (
            <>
              <DropdownMenuItem onClick={handleClearSort}>
                <X className="h-4 w-4 mr-2" />
                Clear sort
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleReverseSort}>
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Reverse sort order ({sortDirection === 'asc' ? 'ASC' : 'DESC'})
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={handleReverseSort}>
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Sort column
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowRemoveDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove field from project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Remove Field Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Field</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{field.definition.name}" from this project? This will not delete the field definition.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveField} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

