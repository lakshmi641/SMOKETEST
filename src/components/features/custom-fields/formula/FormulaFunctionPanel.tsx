'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, FunctionSquare, ChevronRight, ChevronDown } from 'lucide-react'
import { FORMULA_FUNCTIONS } from '@/lib/formula/functions'
import type { FormulaFunction } from '@/types/formula'
import { cn } from '@/lib/utils'

interface FormulaFunctionPanelProps {
    onSelectFunction: (func: FormulaFunction) => void
    selectedFunction?: FormulaFunction | null
    className?: string
}

type FunctionCategory = 'date' | 'math' | 'text'

const CATEGORY_LABELS: Record<FunctionCategory, string> = {
    date: 'Date',
    math: 'Math',
    text: 'Text',
}

/**
 * Functions panel for advanced formula editor
 * Shows all available functions organized by category
 */
export function FormulaFunctionPanel({
    onSelectFunction,
    selectedFunction,
    className,
}: FormulaFunctionPanelProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedCategories, setExpandedCategories] = useState<Set<FunctionCategory>>(
        new Set(['date', 'math'])
    )

    // Group and filter functions
    const functionsByCategory = useMemo(() => {
        const filtered = searchQuery
            ? FORMULA_FUNCTIONS.filter(
                (f) =>
                    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    f.description.toLowerCase().includes(searchQuery.toLowerCase())
            )
            : FORMULA_FUNCTIONS

        const grouped: Record<FunctionCategory, FormulaFunction[]> = {
            date: [],
            math: [],
            text: [],
        }

        filtered.forEach((f) => {
            if (f.category in grouped) {
                grouped[f.category as FunctionCategory].push(f)
            }
        })

        return grouped
    }, [searchQuery])

    const toggleCategory = (category: FunctionCategory) => {
        const newExpanded = new Set(expandedCategories)
        if (newExpanded.has(category)) {
            newExpanded.delete(category)
        } else {
            newExpanded.add(category)
        }
        setExpandedCategories(newExpanded)
    }

    return (
        <div className={cn('flex flex-col border-r', className)}>
            {/* Header */}
            <div className="p-3 border-b">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FunctionSquare className="h-4 w-4" />
                    Functions
                </h3>
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search functions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 text-sm"
                    />
                </div>
            </div>

            {/* Function list */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-2">
                    {(Object.keys(CATEGORY_LABELS) as FunctionCategory[]).map((category) => {
                        const functions = functionsByCategory[category]
                        if (functions.length === 0) return null

                        const isExpanded = expandedCategories.has(category)

                        return (
                            <div key={category} className="mb-2">
                                {/* Category header */}
                                <button
                                    className="flex items-center gap-1 w-full text-left px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded"
                                    onClick={() => toggleCategory(category)}
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="h-3 w-3" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3" />
                                    )}
                                    {CATEGORY_LABELS[category]}
                                    <span className="ml-auto text-xs opacity-50">{functions.length}</span>
                                </button>

                                {/* Function items */}
                                {isExpanded && (
                                    <div className="ml-4 space-y-0.5">
                                        {functions.map((func) => (
                                            <button
                                                key={func.name}
                                                className={cn(
                                                    'flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors',
                                                    selectedFunction?.name === func.name
                                                        ? 'bg-primary/10 text-primary'
                                                        : 'hover:bg-muted'
                                                )}
                                                onClick={() => onSelectFunction(func)}
                                            >
                                                <FunctionSquare className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span>{func.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
