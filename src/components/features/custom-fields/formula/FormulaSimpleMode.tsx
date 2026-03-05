'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { FormulaFieldSelector } from './FormulaFieldSelector'
import { FormulaOperatorSelector } from './FormulaOperatorSelector'
import type { FormulaOperator, FormulaDefinition, BinaryOperationNode, FieldReferenceNode } from '@/types/formula'
import type { ProjectCustomFieldWithDefinition } from '@/types/custom-field'
import { validateFormulaAst, getNodeResultType } from '@/lib/formula/validator'

interface FormulaSimpleModeProps {
    formula?: FormulaDefinition
    onChange: (formula: FormulaDefinition) => void
    availableFields: ProjectCustomFieldWithDefinition[]
    excludeFieldId?: string // The formula field's own ID (to prevent circular refs)
    onSwitchToAdvanced: () => void
    onValidationError?: (error: string | null) => void
}

/**
 * Simple mode formula editor: [Field] [Operator] [Field]
 * Based on Asana's simple formula UI
 */
export function FormulaSimpleMode({
    formula,
    onChange,
    availableFields,
    excludeFieldId,
    onSwitchToAdvanced,
    onValidationError,
}: FormulaSimpleModeProps) {
    // Parse existing formula if it's a simple binary operation
    const [leftFieldId, setLeftFieldId] = useState<string>('')
    const [leftFieldName, setLeftFieldName] = useState<string>('')
    const [leftFieldType, setLeftFieldType] = useState<string>('')

    const [operator, setOperator] = useState<FormulaOperator>('+')

    const [rightFieldId, setRightFieldId] = useState<string>('')
    const [rightFieldName, setRightFieldName] = useState<string>('')
    const [rightFieldType, setRightFieldType] = useState<string>('')

    const isInitialized = useRef(false)

    // Initialize from existing formula
    useEffect(() => {
        if (formula?.ast?.type === 'binary' && !isInitialized.current) {
            const ast = formula.ast as BinaryOperationNode

            if (ast.left.type === 'field') {
                const left = ast.left as FieldReferenceNode
                setLeftFieldId(left.fieldId)
                setLeftFieldName(left.fieldName)
                setLeftFieldType(left.fieldType)
            }

            setOperator(ast.operator)

            if (ast.right.type === 'field') {
                const right = ast.right as FieldReferenceNode
                setRightFieldId(right.fieldId)
                setRightFieldName(right.fieldName)
                setRightFieldType(right.fieldType)
            }

            isInitialized.current = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formula])

    // Helper to build and propagate formula changes
    const updateFormula = (
        leftUpdate?: { id: string; name: string; type: string },
        opUpdate?: FormulaOperator,
        rightUpdate?: { id: string; name: string; type: string }
    ) => {
        // Resolve new values (use update or fallback to state)
        const lId = leftUpdate ? leftUpdate.id : leftFieldId
        const lName = leftUpdate ? leftUpdate.name : leftFieldName
        const lType = leftUpdate ? leftUpdate.type : leftFieldType

        const op = opUpdate !== undefined ? opUpdate : operator

        const rId = rightUpdate ? rightUpdate.id : rightFieldId
        const rName = rightUpdate ? rightUpdate.name : rightFieldName
        const rType = rightUpdate ? rightUpdate.type : rightFieldType

        // Only proceed if both fields are selected
        if (!lId || !rId) {
            onValidationError?.(null)
            return
        }

        // Create AST
        const ast: BinaryOperationNode = {
            type: 'binary',
            operator: op,
            left: {
                type: 'field',
                fieldId: lId,
                fieldName: lName,
                fieldType: lType as 'number' | 'date' | 'text' | 'formula',
            },
            right: {
                type: 'field',
                fieldId: rId,
                fieldName: rName,
                fieldType: rType as 'number' | 'date' | 'text' | 'formula',
            },
        }

        // Validate
        const validation = validateFormulaAst(ast, availableFields)

        if (!validation.isValid && validation.errors.length > 0) {
            onValidationError?.(validation.errors[0]?.message || 'Invalid formula')
        } else {
            onValidationError?.(null)
        }

        // Build expression string
        const expression = `${lName} ${op} ${rName}`

        // Infer result type
        const resultType = getNodeResultType(ast, availableFields)

        const formulaDef: FormulaDefinition = {
            expression,
            ast,
            resultType: resultType === 'unknown' ? 'number' : resultType,
            isSimpleMode: true,
        }

        onChange(formulaDef)
    }

    const handleLeftFieldChange = (fieldId: string, fieldName: string, fieldType: string) => {
        setLeftFieldId(fieldId)
        setLeftFieldName(fieldName)
        setLeftFieldType(fieldType)
        updateFormula({ id: fieldId, name: fieldName, type: fieldType })
    }

    const handleRightFieldChange = (fieldId: string, fieldName: string, fieldType: string) => {
        setRightFieldId(fieldId)
        setRightFieldName(fieldName)
        setRightFieldType(fieldType)
        updateFormula(undefined, undefined, { id: fieldId, name: fieldName, type: fieldType })
    }

    const handleOperatorChange = (op: FormulaOperator) => {
        setOperator(op)
        updateFormula(undefined, op)
    }

    return (
        <div className="space-y-4">
            {/* Simple formula input: [Field] [Operator] [Field] */}
            <div className="flex items-center gap-2">
                <FormulaFieldSelector
                    value={leftFieldId}
                    onChange={handleLeftFieldChange}
                    availableFields={availableFields}
                    excludeFieldIds={excludeFieldId ? [excludeFieldId] : []}
                    placeholder="Select field"
                    className="flex-1"
                />

                <FormulaOperatorSelector
                    value={operator}
                    onChange={handleOperatorChange}
                    onMoreFunctions={onSwitchToAdvanced}
                    className="w-20"
                />

                <FormulaFieldSelector
                    value={rightFieldId}
                    onChange={handleRightFieldChange}
                    availableFields={availableFields}
                    excludeFieldIds={excludeFieldId ? [excludeFieldId] : []}
                    placeholder="Select field"
                    className="flex-1"
                />
            </div>
        </div>
    )
}
