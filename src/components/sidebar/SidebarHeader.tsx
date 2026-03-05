'use client'

import React from 'react'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SidebarHeaderProps {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  children?: React.ReactNode
}

/**
 * Sidebar top bar: company switcher (children) + collapse/expand control.
 */
export function SidebarHeader({ isCollapsed, setIsCollapsed, children }: SidebarHeaderProps) {
  return (
    <div
      className={cn(
        'relative flex items-center py-2 min-h-[2.5rem]',
        isCollapsed ? 'justify-center px-1' : 'px-2 justify-between gap-1'
      )}
    >
      <div className={cn('flex min-w-0 items-center', isCollapsed ? 'flex-1 justify-center' : 'flex-1')}>
        {children}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              'relative z-50 text-muted-foreground hover:text-foreground hover:bg-accent flex-shrink-0 h-8 w-8',
              isCollapsed &&
                'absolute right-1 top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full'
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side={isCollapsed ? 'right' : 'bottom'}>
          <p>{isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
