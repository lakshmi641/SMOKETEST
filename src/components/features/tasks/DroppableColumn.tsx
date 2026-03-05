import { memo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

interface DroppableColumnProps {
  id: string
  children: React.ReactNode
}

export const DroppableColumn = memo(function DroppableColumn({ id, children }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div 
      ref={setNodeRef} 
      className={cn(
        "h-full w-full transition-all duration-200 rounded-b-lg",
        isOver && "bg-primary/5 ring-2 ring-primary/20 ring-inset"
      )}
    >
      {children}
    </div>
  )
})

