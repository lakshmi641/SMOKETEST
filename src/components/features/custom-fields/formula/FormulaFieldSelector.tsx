'use client'

import { useMemo } from 'react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectGroup,
    SelectLabel,
} from '@/components/ui/select'
import { Calendar, Hash, Type, FunctionSquare } from 'lucide-react'
import type { ProjectCustomFieldWithDefinition } from '@/types/custom-field'
import { BUILT_IN_FIELDS } from '@/lib/formula/built-in-fields'

interface FormulaFieldSelectorProps {
    value?: string // Field ID
    onChange: (fieldId: string, fieldName: string, fieldType: string) => void
    availableFields: ProjectCustomFieldWithDefinition[]
    placeholder?: string
    excludeFieldIds?: string[] // Fields to exclude (e.g., the formula field itself)
    className?: string
}

/**
 * Field selector dropdown for formula editor
 * Shows all available fields (custom + built-in) with appropriate icons
 */
export function FormulaFieldSelector({
    value,
    onChange,
    availableFields,
    placeholder = 'Select field',
    excludeFieldIds = [],
    className,
}: FormulaFieldSelectorProps) {
    // Filter and organize fields
    const { customFields, builtInFields, selectedField } = useMemo(() => {
        // Custom fields (excluding formula fields that would cause circular refs)
        const custom = availableFields.filter(
            (f) =>
                !excludeFieldIds.includes(f.definition.id) &&
                ['number', 'date', 'text', 'formula'].includes(f.definition.type)
        )

        // Built-in fields from task schema
        const VISIBLE_BUILTINS = ['startDate', 'dueDate', 'estimatedHours', 'progress', 'today']
        const builtIn = BUILT_IN_FIELDS.filter(
            (f) => !excludeFieldIds.includes(f.id) && VISIBLE_BUILTINS.includes(f.id)
        )

        // Find selected field for display
        let selected: { name: string; type: string } | undefined
        if (value) {
            const customMatch = custom.find((f) => f.definition.id === value)
            if (customMatch) {
                selected = { name: customMatch.definition.name, type: customMatch.definition.type }
            } else {
                const builtInMatch = builtIn.find((f) => f.id === value)
                if (builtInMatch) {
                    selected = { name: builtInMatch.name, type: builtInMatch.type }
                }
            }
        }

        return { customFields: custom, builtInFields: builtIn, selectedField: selected }
    }, [availableFields, excludeFieldIds, value])

    // Get icon for field type
    const getFieldIcon = (type: string) => {
        switch (type) {
            case 'number':
                return <Hash className="h-4 w-4 text-muted-foreground" />
            case 'date':
                return <Calendar className="h-4 w-4 text-muted-foreground" />
            case 'formula':
                return <FunctionSquare className="h-4 w-4 text-muted-foreground" />
            case 'text':
            default:
                return <Type className="h-4 w-4 text-muted-foreground" />
        }
    }

    const handleValueChange = (fieldId: string) => {
        // Find the field to get its name and type
        const customMatch = customFields.find((f) => f.definition.id === fieldId)
        if (customMatch) {
            onChange(fieldId, customMatch.definition.name, customMatch.definition.type)
            return
        }

        const builtInMatch = builtInFields.find((f) => f.id === fieldId)
        if (builtInMatch) {
            onChange(fieldId, builtInMatch.name, builtInMatch.type)
        }
    }

    return (
        <Select value={value} onValueChange={handleValueChange}>
            <SelectTrigger className={className}>
                <SelectValue placeholder={placeholder}>
                    {selectedField && (
                        <span className="flex items-center gap-2">
                            {getFieldIcon(selectedField.type)}
                            <span>{selectedField.name}</span>
                        </span>
                    )}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {/* Custom Fields */}
                {customFields.length > 0 && (
                    <SelectGroup>
                        <SelectLabel className="text-xs text-muted-foreground">Custom Fields</SelectLabel>
                        {customFields.map((field) => (
                            <SelectItem key={field.definition.id} value={field.definition.id}>
                                <span className="flex items-center gap-2">
                                    {getFieldIcon(field.definition.type)}
                                    <span>{field.definition.name}</span>
                                </span>
                            </SelectItem>
                        ))}
                    </SelectGroup>
                )}

                {/* Built-in Fields */}
                <SelectGroup>
                    <SelectLabel className="text-xs text-muted-foreground">Built-in Fields</SelectLabel>
                    {builtInFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                            <span className="flex items-center gap-2">
                                {getFieldIcon(field.type)}
                                <span>{field.name}</span>
                            </span>
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}
