'use client'

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectSeparator,
} from '@/components/ui/select'
import { Plus, Minus, X, Divide, MoreHorizontal } from 'lucide-react'
import type { FormulaOperator } from '@/types/formula'

interface FormulaOperatorSelectorProps {
    value: FormulaOperator
    onChange: (operator: FormulaOperator) => void
    onMoreFunctions?: () => void // Callback to switch to advanced mode
    className?: string
}

const OPERATORS: Array<{
    value: FormulaOperator
    label: string
    icon: React.ReactNode
}> = [
        { value: '+', label: 'Add', icon: <Plus className="h-4 w-4" /> },
        { value: '-', label: 'Subtract', icon: <Minus className="h-4 w-4" /> },
        { value: '*', label: 'Multiply', icon: <X className="h-4 w-4" /> },
        { value: '/', label: 'Divide', icon: <Divide className="h-4 w-4" /> },
    ]

/**
 * Operator selector dropdown for formula simple mode
 * Shows +, -, *, / with option to access more functions
 */
export function FormulaOperatorSelector({
    value,
    onChange,
    onMoreFunctions,
    className,
}: FormulaOperatorSelectorProps) {
    const selectedOp = OPERATORS.find((op) => op.value === value)

    const handleValueChange = (newValue: string) => {
        if (newValue === 'more') {
            // Switch to advanced mode
            onMoreFunctions?.()
            return
        }
        onChange(newValue as FormulaOperator)
    }

    return (
        <Select value={value} onValueChange={handleValueChange}>
            <SelectTrigger className={className}>
                <SelectValue>
                    {selectedOp && (
                        <span className="flex items-center gap-2">
                            {selectedOp.icon}
                        </span>
                    )}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                        <span className="flex items-center gap-2">
                            {op.icon}
                            <span>{op.label}</span>
                        </span>
                    </SelectItem>
                ))}

                {onMoreFunctions && (
                    <>
                        <SelectSeparator />
                        <SelectItem value="more">
                            <span className="flex items-center gap-2 text-primary">
                                <MoreHorizontal className="h-4 w-4" />
                                <span>More functions...</span>
                            </span>
                        </SelectItem>
                    </>
                )}
            </SelectContent>
        </Select>
    )
}
