'use client'

import { FolderTree, LayoutGrid, Table } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type DocumentVaultViewType = 'tree' | 'tiles' | 'list'

export interface DocumentVaultViewToggleProps {
  currentView: DocumentVaultViewType
  onViewChange: (view: DocumentVaultViewType) => void
  className?: string
}

export function DocumentVaultViewToggle({
  currentView,
  onViewChange,
  className
}: DocumentVaultViewToggleProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-lg border border-border bg-card p-1',
        className
      )}
    >
      <Button
        variant={currentView === 'tree' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('tree')}
        className="h-8 w-8 p-0"
        title="Tree view"
      >
        <FolderTree className="h-4 w-4" />
        <span className="sr-only">Tree view</span>
      </Button>
      <Button
        variant={currentView === 'tiles' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('tiles')}
        className="h-8 w-8 p-0"
        title="Tiles view"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="sr-only">Tiles view</span>
      </Button>
      <Button
        variant={currentView === 'list' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('list')}
        className="h-8 w-8 p-0"
        title="List view"
      >
        <Table className="h-4 w-4" />
        <span className="sr-only">List view</span>
      </Button>
    </div>
  )
}

