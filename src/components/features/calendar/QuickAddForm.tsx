'use client'

import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Loader2, X, Check } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface QuickAddFormProps {
    date: Date
    projectId: string
    onSubmit: (title: string, dueDate: string) => Promise<void>
    onCancel: () => void
}

// ============================================================================
// Component
// ============================================================================

export function QuickAddForm({ date, projectId, onSubmit, onCancel }: QuickAddFormProps) {
    const [title, setTitle] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // Auto-focus on mount
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    // Handle form submission
    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault()

        if (!title.trim() || isSubmitting) return

        setIsSubmitting(true)
        try {
            const dueDate = format(date, 'yyyy-MM-dd')
            await onSubmit(title.trim(), dueDate)
            setTitle('')
            onCancel() // Close form after success
        } catch (error) {
            console.error('Failed to create task:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    // Handle keyboard events
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
        }
    }

    return (
        <div
            className="quick-add-form"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Single-line compact input with inline buttons */}
            <div className="flex items-center gap-1 bg-background rounded border border-primary/40 shadow-sm overflow-hidden">
                <input
                    ref={inputRef}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Task name..."
                    className={cn(
                        'flex-1 px-2 py-1.5 text-sm bg-transparent border-0 outline-none',
                        'placeholder:text-muted-foreground/50',
                        'min-w-0'
                    )}
                    disabled={isSubmitting}
                    data-testid="quick-add-input"
                />

                {/* Cancel */}
                <button
                    type="button"
                    onClick={onCancel}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={isSubmitting}
                    title="Cancel (Esc)"
                >
                    <X className="h-3.5 w-3.5" />
                </button>

                {/* Submit */}
                <button
                    type="button"
                    onClick={() => handleSubmit()}
                    className={cn(
                        'p-1.5 mr-0.5 rounded-sm transition-colors',
                        title.trim()
                            ? 'text-primary hover:bg-primary/10'
                            : 'text-muted-foreground/40 cursor-not-allowed'
                    )}
                    disabled={!title.trim() || isSubmitting}
                    data-testid="quick-add-submit"
                    title="Create (Enter)"
                >
                    {isSubmitting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Check className="h-3.5 w-3.5" />
                    )}
                </button>
            </div>
        </div>
    )
}
