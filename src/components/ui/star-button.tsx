'use client'

import React from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarButtonProps {
    isStarred: boolean
    onToggle: () => void
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
    className?: string
}

export function StarButton({
    isStarred,
    onToggle,
    size = 'md',
    disabled = false,
    className
}: StarButtonProps) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-5 w-5',
        lg: 'h-6 w-6'
    }

    return (
        <button
            onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onToggle()
            }}
            disabled={disabled}
            type="button"
            className={cn(
                'inline-flex items-center justify-center rounded-sm transition-all duration-200',
                'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2',
                disabled && 'opacity-50 cursor-not-allowed',
                className
            )}
            aria-label={isStarred ? 'Unstar item' : 'Star item'}
        >
            <Star
                className={cn(
                    sizeClasses[size],
                    'transition-all duration-200',
                    isStarred
                        ? 'fill-amber-500 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                        : 'text-muted-foreground hover:text-amber-400'
                )}
            />
        </button>
    )
}
