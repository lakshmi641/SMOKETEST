'use client'


import { Badge } from '@/components/ui/badge'
import { FunctionSquare, Hash, Calendar, Type } from 'lucide-react'
import type { FormulaFunction } from '@/types/formula'
import { cn } from '@/lib/utils'

interface FormulaFunctionDocsProps {
    func: FormulaFunction | null
    className?: string
}

/**
 * Function documentation panel for advanced formula editor
 * Shows detailed info about the selected function
 */
export function FormulaFunctionDocs({ func, className }: FormulaFunctionDocsProps) {
    if (!func) {
        return (
            <div className={cn('flex items-center justify-center text-muted-foreground text-sm p-4', className)}>
                <p>Select a function to see its documentation</p>
            </div>
        )
    }

    // Get icon for parameter type
    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'number':
                return <Hash className="h-3.5 w-3.5" />
            case 'date':
                return <Calendar className="h-3.5 w-3.5" />
            case 'text':
                return <Type className="h-3.5 w-3.5" />
            default:
                return null
        }
    }

    // Get color for return type badge
    const getReturnTypeBadgeVariant = (type: string) => {
        switch (type) {
            case 'number':
                return 'secondary'
            case 'date':
                return 'outline'
            case 'text':
                return 'default'
            case 'boolean':
                return 'destructive'
            default:
                return 'secondary'
        }
    }

    return (
        <div className={cn('overflow-y-auto p-4', className)}>
            <div className="space-y-4">
                {/* Function name and description */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <FunctionSquare className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-semibold">{func.name}</h3>
                        <Badge variant={getReturnTypeBadgeVariant(func.returnType) as any}>
                            {func.returnType}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{func.description}</p>
                    {func.longDescription && (
                        <p className="text-sm text-muted-foreground mt-1">{func.longDescription}</p>
                    )}
                </div>

                {/* Parameters */}
                {func.parameters.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium mb-2">Parameters</h4>
                        <div className="space-y-2">
                            {func.parameters.map((param, index) => (
                                <div
                                    key={index}
                                    className="flex items-start gap-2 text-sm p-2 bg-muted/50 rounded-md"
                                >
                                    <span className="flex items-center gap-1 font-medium min-w-[80px]">
                                        {getTypeIcon(param.type)}
                                        {param.name}
                                    </span>
                                    <span className="text-muted-foreground">
                                        {param.description}
                                        {!param.required && (
                                            <span className="text-xs ml-1 opacity-70">(optional)</span>
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Examples */}
                {func.examples.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium mb-2">Examples</h4>
                        <div className="space-y-2">
                            {func.examples.map((example, index) => (
                                <div
                                    key={index}
                                    className="p-2 bg-muted rounded-md"
                                >
                                    <code className="text-sm font-mono flex items-center gap-1">
                                        <FunctionSquare className="h-3.5 w-3.5 text-primary" />
                                        {example.expression}
                                    </code>
                                    {example.description && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {example.description}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
