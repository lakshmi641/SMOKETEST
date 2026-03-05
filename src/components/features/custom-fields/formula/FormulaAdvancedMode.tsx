'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { FormulaFunctionPanel } from './FormulaFunctionPanel'
import { FormulaFunctionDocs } from './FormulaFunctionDocs'
import { FunctionSquare, Hash, Calendar, Type, AlertCircle } from 'lucide-react'
import type { FormulaDefinition, FormulaFunction, FormulaToken } from '@/types/formula'
import type { ProjectCustomFieldWithDefinition } from '@/types/custom-field'
import { tokenize, parseFormulaExpression } from '@/lib/formula/parser'
import { validateFormulaExpression, validateFormulaAst } from '@/lib/formula/validator'
import { cn } from '@/lib/utils'
import { BUILT_IN_FIELDS } from '@/lib/formula/built-in-fields'

interface FormulaAdvancedModeProps {
    formula?: FormulaDefinition
    onChange: (formula: FormulaDefinition) => void
    availableFields: ProjectCustomFieldWithDefinition[]
    excludeFieldId?: string
    onValidationError?: (error: string | null) => void
}

/**
 * Advanced mode formula editor with text input, function panel, and docs
 */
export function FormulaAdvancedMode({
    formula,
    onChange,
    availableFields,
    excludeFieldId,
    onValidationError,
}: FormulaAdvancedModeProps) {
    const [expression, setExpression] = useState(formula?.expression || '')
    const [selectedFunction, setSelectedFunction] = useState<FormulaFunction | null>(null)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [suggestions, setSuggestions] = useState<Array<{ type: 'field' | 'function'; name: string; id?: string }>>([])
    const [cursorPosition, setCursorPosition] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)

    // Get current word being typed for autocomplete
    const getCurrentWord = useCallback((text: string, position: number) => {
        const beforeCursor = text.substring(0, position)
        const match = beforeCursor.match(/[a-zA-Z_][a-zA-Z0-9_ ]*$/);
        return match ? match[0] : ''
    }, [])

    // Update suggestions based on current word
    const updateSuggestions = useCallback((text: string, position: number) => {
        const currentWord = getCurrentWord(text, position).toLowerCase()

        if (!currentWord) {
            setShowSuggestions(false)
            setSuggestions([])
            return
        }

        const matches: Array<{ type: 'field' | 'function'; name: string; id?: string }> = []

        // Search custom fields
        availableFields.forEach((field) => {
            if (
                field.definition.id !== excludeFieldId &&
                field.definition.name.toLowerCase().includes(currentWord)
            ) {
                matches.push({
                    type: 'field',
                    name: field.definition.name,
                    id: field.definition.id,
                })
            }
        })

        // Search built-in fields
        const VISIBLE_BUILTINS = ['startDate', 'dueDate', 'estimatedHours', 'progress', 'today']
        BUILT_IN_FIELDS.forEach((field) => {
            if (VISIBLE_BUILTINS.includes(field.id) && field.name.toLowerCase().includes(currentWord)) {
                matches.push({
                    type: 'field',
                    name: field.name,
                    id: field.id,
                })
            }
        })

        // Search functions (from functions library)
        import('@/lib/formula/functions').then(({ FORMULA_FUNCTIONS }) => {
            FORMULA_FUNCTIONS.forEach((func) => {
                if (func.name.toLowerCase().includes(currentWord)) {
                    matches.push({
                        type: 'function',
                        name: func.name,
                    })
                }
            })

            setSuggestions(matches.slice(0, 8)) // Limit to 8 suggestions
            setShowSuggestions(matches.length > 0)
        })
    }, [availableFields, excludeFieldId, getCurrentWord])

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        setExpression(newValue)
        setCursorPosition(e.target.selectionStart || 0)
        updateSuggestions(newValue, e.target.selectionStart || 0)
    }

    // Handle cursor movement (click, keyup) to keep state in sync
    const handleCursorMove = (e: React.SyntheticEvent<HTMLInputElement>) => {
        const pos = e.currentTarget.selectionStart || 0
        setCursorPosition(pos)
        // Also update suggestions based on new cursor position context
        if (expression) {
            updateSuggestions(expression, pos)
        }
    }

    // Handle suggestion selection
    const handleSelectSuggestion = (suggestion: { type: 'field' | 'function'; name: string }) => {
        const currentWord = getCurrentWord(expression, cursorPosition)
        const beforeWord = expression.substring(0, cursorPosition - currentWord.length)
        const afterCursor = expression.substring(cursorPosition)

        let insertText = suggestion.name
        if (suggestion.type === 'function') {
            insertText = `${suggestion.name}()`
        }

        const newExpression = beforeWord + insertText + afterCursor
        setExpression(newExpression)
        setShowSuggestions(false)

        // Focus input and set cursor position
        setTimeout(() => {
            inputRef.current?.focus()
            const newPosition = beforeWord.length + insertText.length - (suggestion.type === 'function' ? 1 : 0)
            inputRef.current?.setSelectionRange(newPosition, newPosition)
            setCursorPosition(newPosition)
        }, 0)
    }

    // Handle function selection from panel
    const handleSelectFunction = (func: FormulaFunction) => {
        setSelectedFunction(func)

        // Insert function at cursor
        const beforeCursor = expression.substring(0, cursorPosition)
        const afterCursor = expression.substring(cursorPosition)
        const insertText = `${func.name}()`

        const newExpression = beforeCursor + insertText + afterCursor
        setExpression(newExpression)

        // Focus input
        setTimeout(() => {
            inputRef.current?.focus()
            const newPosition = beforeCursor.length + insertText.length - 1
            inputRef.current?.setSelectionRange(newPosition, newPosition)
            setCursorPosition(newPosition)
        }, 0)
    }

    // Parse and validate expression
    useEffect(() => {
        if (!expression.trim()) {
            onValidationError?.(null)
            return
        }

        try {
            // Basic syntax validation
            const syntaxValidation = validateFormulaExpression(expression)
            if (!syntaxValidation.isValid) {
                onValidationError?.(syntaxValidation.errors[0]?.message || 'Invalid formula')
                return
            }

            // Parse to AST
            const formulaDef = parseFormulaExpression(expression, availableFields)

            // Validate AST
            const astValidation = validateFormulaAst(formulaDef.ast, availableFields)
            if (!astValidation.isValid) {
                onValidationError?.(astValidation.errors[0]?.message || 'Invalid formula')
                return
            }

            // Valid formula - update parent
            onValidationError?.(null)
            onChange(formulaDef)
        } catch (error) {
            onValidationError?.(error instanceof Error ? error.message : 'Invalid formula syntax')
        }
    }, [expression, availableFields, onChange, onValidationError])

    // Get icon for suggestion type
    const getSuggestionIcon = (type: 'field' | 'function', name: string) => {
        if (type === 'function') {
            return <FunctionSquare className="h-4 w-4 text-primary" />
        }

        // Try to determine field type
        const customField = availableFields.find((f) => f.definition.name === name)
        if (customField) {
            switch (customField.definition.type) {
                case 'number':
                    return <Hash className="h-4 w-4 text-blue-500" />
                case 'date':
                    return <Calendar className="h-4 w-4 text-orange-500" />
                default:
                    return <Type className="h-4 w-4 text-gray-500" />
            }
        }

        const builtInField = BUILT_IN_FIELDS.find((f) => f.name === name)
        if (builtInField) {
            switch (builtInField.type) {
                case 'number':
                    return <Hash className="h-4 w-4 text-blue-500" />
                case 'date':
                    return <Calendar className="h-4 w-4 text-orange-500" />
                default:
                    return <Type className="h-4 w-4 text-gray-500" />
            }
        }

        return <Type className="h-4 w-4 text-gray-500" />
    }

    return (
        <div className="space-y-4">
            {/* Formula input */}
            <div className="relative">
                <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background focus-within:ring-2 focus-within:ring-ring">
                    <FunctionSquare className="h-4 w-4 text-primary shrink-0" />
                    <Input
                        ref={inputRef}
                        value={expression}
                        onChange={handleInputChange}
                        onClick={handleCursorMove}
                        onKeyUp={handleCursorMove}
                        onSelect={handleCursorMove}
                        onFocus={() => updateSuggestions(expression, cursorPosition)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        placeholder="Start typing a function or field..."
                        className="border-0 p-0 h-auto focus-visible:ring-0 font-mono text-sm"
                    />
                </div>

                {/* Autocomplete suggestions */}
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-auto">
                        {suggestions.map((suggestion, index) => (
                            <button
                                key={`${suggestion.type}-${suggestion.name}`}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted text-left"
                                onMouseDown={() => handleSelectSuggestion(suggestion)}
                            >
                                {getSuggestionIcon(suggestion.type, suggestion.name)}
                                <span>{suggestion.name}</span>
                                <span className="ml-auto text-xs text-muted-foreground capitalize">
                                    {suggestion.type}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Function panel and docs */}
            <div className="grid grid-cols-2 gap-0 border rounded-md h-[350px] overflow-hidden">
                <FormulaFunctionPanel
                    onSelectFunction={handleSelectFunction}
                    selectedFunction={selectedFunction}
                    className="h-full overflow-y-auto"
                />
                <FormulaFunctionDocs
                    func={selectedFunction}
                    className="h-full border-l overflow-y-auto"
                />
            </div>

            {/* Help text */}
            <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded-md">
                <p className="font-medium">How to get started:</p>
                <ol className="list-decimal list-inside space-y-0.5 ml-2">
                    <li>Select or type a function from the list</li>
                    <li>Select fields, numbers, or dates to be part of the function</li>
                    <li>Make sure the parentheses are in the right place</li>
                </ol>
            </div>
        </div>
    )
}
