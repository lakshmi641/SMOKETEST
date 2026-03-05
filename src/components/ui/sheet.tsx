'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

const SheetContext = React.createContext<{
  open: boolean
  onOpenChange: (open: boolean) => void
}>({
  open: false,
  onOpenChange: () => {},
})

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  return (
    <SheetContext.Provider value={{ open, onOpenChange }}>
      {children}
    </SheetContext.Provider>
  )
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'left' | 'right' | 'top' | 'bottom'
}

export function SheetContent({
  side = 'right',
  className,
  children,
  ...props
}: SheetContentProps) {
  const { open, onOpenChange } = React.useContext(SheetContext)

  if (!open) return null

  const sideStyles = {
    right: 'right-0 top-0 h-full w-full sm:max-w-lg border-l',
    left: 'left-0 top-0 h-full w-full sm:max-w-lg border-r',
    top: 'top-0 left-0 w-full h-full max-h-[50vh] border-b',
    bottom: 'bottom-0 left-0 w-full h-full max-h-[50vh] border-t',
  }

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={() => onOpenChange(false)}
      />

      {/* Sheet */}
      <div
        className={cn(
          'fixed bg-white shadow-lg transition-transform duration-300',
          sideStyles[side],
          className
        )}
        {...props}
      >
        <div className="relative flex h-full flex-col">
          {children}
        </div>
      </div>
    </div>
  )
}

interface SheetHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SheetHeader({
  className,
  children,
  ...props
}: SheetHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col space-y-2 px-6 py-4 border-b border-gray-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface SheetTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export function SheetTitle({
  className,
  children,
  ...props
}: SheetTitleProps) {
  const { onOpenChange } = React.useContext(SheetContext)

  return (
    <div className="flex items-center justify-between">
      <h2
        className={cn('text-lg font-semibold text-gray-900', className)}
        {...props}
      >
        {children}
      </h2>
      <button
        onClick={() => onOpenChange(false)}
        className="rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </button>
    </div>
  )
}

interface SheetDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

export function SheetDescription({
  className,
  children,
  ...props
}: SheetDescriptionProps) {
  return (
    <p
      className={cn('text-sm text-gray-600', className)}
      {...props}
    >
      {children}
    </p>
  )
}

interface SheetFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SheetFooter({
  className,
  children,
  ...props
}: SheetFooterProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-white mt-auto',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

