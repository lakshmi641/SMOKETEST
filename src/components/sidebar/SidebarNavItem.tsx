'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight, LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SidebarNavItemProps {
    href: string;
    name: string;
    icon: any;
    isActive: boolean;
    isCollapsed?: boolean;
    badgeCount?: number;
    badgeVariant?: 'default' | 'danger';
    showChevron?: boolean;
    iconColor?: string;
}

export function SidebarNavItem({
    href,
    name,
    icon: Icon,
    isActive,
    isCollapsed,
    badgeCount,
    badgeVariant = 'default',
    showChevron = false,
    iconColor
}: SidebarNavItemProps) {
    const baseItemClass = "flex items-center gap-2 rounded-md text-sm font-medium transition-colors w-full overflow-hidden h-9 min-h-9"
    const activeClass = "bg-accent text-foreground"
    const inactiveClass = "text-muted-foreground hover:text-foreground hover:bg-accent/50"

    if (isCollapsed) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Link href={href} className="flex justify-center">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-9 w-9 flex-shrink-0 justify-center text-muted-foreground hover:text-foreground hover:bg-accent",
                                isActive && "text-foreground bg-accent"
                            )}
                        >
                            <Icon className={cn("w-5 h-5", iconColor)} />
                        </Button>
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                    <p>{name}</p>
                </TooltipContent>
            </Tooltip>
        )
    }

    return (
        <Link href={href} className="w-full min-w-0 block overflow-hidden">
            <div
                className={cn(
                    baseItemClass,
                    "px-3 min-w-0",
                    isActive ? activeClass : inactiveClass
                )}
            >
                <Icon className={cn("w-4 h-4 flex-shrink-0", iconColor)} />
                <span className="flex-1 min-w-0 truncate text-left" title={name}>{name}</span>
                {badgeCount !== undefined && badgeCount > 0 && (
                    <span className={cn(
                        "min-w-[20px] h-5 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5 flex-shrink-0",
                        badgeVariant === 'danger' ? "bg-red-500 shadow-sm" : "bg-blue-500"
                    )}>
                        {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                )}
                {showChevron && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
            </div>
        </Link>
    )
}
