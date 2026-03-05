'use client'

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  title?: string
  description?: string
}

export function Drawer({ open, onOpenChange, children, title, description }: DrawerProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

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

  if (!mounted) return null

  const drawerContent = (
    <div className="fixed inset-0 z-[10000]" style={{ pointerEvents: open ? 'auto' : 'none' }}>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => onOpenChange(false)}
        style={{ pointerEvents: open ? 'auto' : 'none' }}
      />
      
      {/* Drawer */}
      <div 
        className={`fixed right-0 top-0 h-full w-full max-w-xl lg:max-w-2xl bg-background border-l border-border shadow-xl transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ 
          pointerEvents: open ? 'auto' : 'none',
          zIndex: 10000
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          {(title || description) && (
            <div className="flex items-start justify-between p-5 border-b border-border bg-card flex-shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                {title && (
                  <h2 className="text-xl font-semibold text-foreground">{title}</h2>
                )}
                {description && (
                  <p className="text-sm text-muted-foreground mt-1.5">{description}</p>
                )}
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex-shrink-0 p-1"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
          
          {/* Content - Scrollable area */}
          <div className="flex-1 overflow-y-auto bg-background min-h-0">
            {React.Children.map(children, (child) => {
              if (React.isValidElement(child) && (child.type as any)?.displayName === 'DrawerFooter') {
                return null // Footer will be rendered separately
              }
              return child
            })}
          </div>
          
          {/* Footer - Fixed at bottom */}
          {React.Children.toArray(children).find(
            (child) => React.isValidElement(child) && (child.type as any)?.displayName === 'DrawerFooter'
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(drawerContent, document.body)
}

interface DrawerContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DrawerContent({ className, children, ...props }: DrawerContentProps) {
  return (
    <div className={cn("p-5", className)} {...props}>
      {children}
    </div>
  )
}

interface DrawerFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DrawerFooter({ className, children, ...props }: DrawerFooterProps) {
  return (
    <div 
      className={cn("flex items-center justify-end gap-3 p-5 border-t border-border bg-card flex-shrink-0", className)} 
      {...props}
    >
      {children}
    </div>
  )
}

DrawerFooter.displayName = 'DrawerFooter'
