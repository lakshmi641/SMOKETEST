'use client'

import React from 'react'
import { ChevronRight, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BreadcrumbItem {
    id: string
    name: string
    level: string
}

interface DrillDownBreadcrumbProps {
    items: BreadcrumbItem[]
    onNavigate: (item: any) => void
}

export function DrillDownBreadcrumb({ items, onNavigate }: DrillDownBreadcrumbProps) {
    return (
        <nav className="flex items-center space-x-1 text-xs text-muted-foreground mb-4">
            <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 hover:bg-muted"
                onClick={() => onNavigate({ id: 'org', name: 'Organization', level: 'organization' })}
            >
                <Home className="h-3.5 w-3.5" />
            </Button>

            {items.map((item, index) => (
                <React.Fragment key={item.id}>
                    <ChevronRight className="h-3 w-3 opacity-50" />
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 px-2 hover:bg-muted font-medium ${index === items.length - 1 ? "text-foreground cursor-default" : ""
                            }`}
                        onClick={() => index < items.length - 1 && onNavigate(item)}
                    >
                        {item.name}
                    </Button>
                </React.Fragment>
            ))}
        </nav>
    )
}
