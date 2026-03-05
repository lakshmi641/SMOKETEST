'use client'

import { useState, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { FormulaSimpleMode } from './FormulaSimpleMode'
import { FormulaAdvancedMode } from './FormulaAdvancedMode'
import { AlertCircle } from 'lucide-react'
import type { FormulaDefinition } from '@/types/formula'
import type { ProjectCustomFieldWithDefinition, NumberFormat } from '@/types/custom-field'
import { cn } from '@/lib/utils'

interface FormulaEditorProps {
    formula?: FormulaDefinition
    onChange: (formula: FormulaDefinition) => void
    availableFields: ProjectCustomFieldWithDefinition[]
    excludeFieldId?: string // The formula field's own ID (to prevent circular refs)

    // Formatting options
    format?: NumberFormat
    decimals?: number
    customLabel?: string
    onFormatChange?: (format: NumberFormat) => void
    onDecimalsChange?: (decimals: number) => void
    onCustomLabelChange?: (label: string) => void
}

const NUMBER_FORMAT_OPTIONS: Array<{ value: NumberFormat; label: string }> = [
    { value: 'number', label: 'Number' },
    { value: 'percent', label: 'Percent' },
    { value: 'currency', label: 'Currency' },
    { value: 'custom', label: 'Custom label' },
    { value: 'none', label: 'None' },
]

/**
 * Main formula editor component
 * Provides simple and advanced modes with tabs for formula and formatting
 */
export function FormulaEditor({
    formula,
    onChange,
    availableFields,
    excludeFieldId,
    format = 'number',
    decimals = 0,
    customLabel = '',
    onFormatChange,
    onDecimalsChange,
    onCustomLabelChange,
}: FormulaEditorProps) {
    const [isAdvancedMode, setIsAdvancedMode] = useState(formula?.isSimpleMode === false)
    const [activeTab, setActiveTab] = useState<'formula' | 'formatting'>('formula')
    const [validationError, setValidationError] = useState<string | null>(null)

    const handleFormulaChange = useCallback((newFormula: FormulaDefinition) => {
        // Update the isSimpleMode flag based on current mode
        onChange({
            ...newFormula,
            isSimpleMode: !isAdvancedMode,
        })
    }, [onChange, isAdvancedMode])

    const handleSwitchToAdvanced = useCallback(() => {
        setIsAdvancedMode(true)
    }, [])

    const handleValidationError = useCallback((error: string | null) => {
        setValidationError(error)
    }, [])

    return (
        <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'formula' | 'formatting')}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="formula">Formula</TabsTrigger>
                    <TabsTrigger value="formatting">Formatting</TabsTrigger>
                </TabsList>

                <TabsContent value="formula" className="space-y-4">
                    {/* Formula editor (simple or advanced) */}
                    {isAdvancedMode ? (
                        <FormulaAdvancedMode
                            formula={formula}
                            onChange={handleFormulaChange}
                            availableFields={availableFields}
                            excludeFieldId={excludeFieldId}
                            onValidationError={handleValidationError}
                        />
                    ) : (
                        <FormulaSimpleMode
                            formula={formula}
                            onChange={handleFormulaChange}
                            availableFields={availableFields}
                            excludeFieldId={excludeFieldId}
                            onSwitchToAdvanced={handleSwitchToAdvanced}
                            onValidationError={handleValidationError}
                        />
                    )}

                    {/* Validation error message */}
                    {validationError && (
                        <div className="flex items-center gap-2 text-destructive text-sm">
                            <AlertCircle className="h-4 w-4" />
                            <span>{validationError}</span>
                        </div>
                    )}

                    {/* Advanced editor toggle */}
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="advanced-mode"
                            checked={isAdvancedMode}
                            onCheckedChange={(checked) => setIsAdvancedMode(checked as boolean)}
                        />
                        <Label htmlFor="advanced-mode" className="text-sm cursor-pointer">
                            Advanced editor
                        </Label>
                    </div>
                </TabsContent>

                <TabsContent value="formatting" className="space-y-4">
                    {/* Number format */}
                    <div className="space-y-2">
                        <Label>Format</Label>
                        <Select value={format} onValueChange={(v) => onFormatChange?.(v as NumberFormat)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {NUMBER_FORMAT_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Decimal places */}
                    {format !== 'none' && (
                        <div className="space-y-2">
                            <Label>Decimal places</Label>
                            <Select value={String(decimals)} onValueChange={(v) => onDecimalsChange?.(parseInt(v))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                                        <SelectItem key={n} value={String(n)}>
                                            {n}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Custom label */}
                    {format === 'custom' && (
                        <div className="space-y-2">
                            <Label>Custom label</Label>
                            <Input
                                value={customLabel}
                                onChange={(e) => onCustomLabelChange?.(e.target.value)}
                                placeholder="e.g., lbs, kg, items"
                            />
                        </div>
                    )}

                    {/* Preview */}
                    <div className="p-4 bg-muted rounded-md">
                        <Label className="text-xs text-muted-foreground">Preview</Label>
                        <div className="text-lg font-medium mt-1">
                            {formatPreviewValue(123.456789, format, decimals, customLabel)}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}

/**
 * Format a preview value based on settings
 */
function formatPreviewValue(
    value: number,
    format: NumberFormat,
    decimals: number,
    customLabel: string
): string {
    const formatted = value.toFixed(decimals)

    switch (format) {
        case 'percent':
            return `${formatted}%`
        case 'currency':
            return `$${formatted}`
        case 'custom':
            return customLabel ? `${formatted} ${customLabel}` : formatted
        case 'none':
            return String(value)
        default:
            return formatted
    }
}
