'use client'

import React from 'react'
import { ChevronDown, ChevronRight, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarCollapsibleItemProps {
    name: string;
    icon: any;
    isExpanded: boolean;
    onToggle: () => void;
    isActive?: boolean;
    children: React.ReactNode;
}

export function SidebarCollapsibleItem({
    name,
    icon: Icon,
    isExpanded,
    onToggle,
    isActive,
    children
}: SidebarCollapsibleItemProps) {
    return (
        <div>
            <button
                onClick={onToggle}
                className={cn(
                    "flex items-center gap-2 h-9 min-h-9 px-3 rounded-md text-sm font-medium transition-colors w-full overflow-hidden",
                    isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
            >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left truncate">{name}</span>
                {isExpanded ? (
                    <ChevronDown className="w-3 h-3 flex-shrink-0" />
                ) : (
                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                )}
            </button>

            {isExpanded && (
                <div className="ml-4 mt-0.5 space-y-0.5">
                    {children}
                </div>
            )}
        </div>
    )
}
