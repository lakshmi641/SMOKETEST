'use client'

import { useMemo } from 'react'
import type { FormulaValidationResult, FormulaDefinition } from '@/types/formula'
import type { ProjectCustomFieldWithDefinition } from '@/types/custom-field'
import { validateFormulaExpression, validateFormulaAst, checkCircularReferences } from '@/lib/formula'

interface UseFormulaValidationOptions {
    formula?: FormulaDefinition
    expression?: string
    fieldId?: string
    allFieldDefinitions: ProjectCustomFieldWithDefinition[]
}

/**
 * Hook for real-time formula validation
 * Validates syntax, types, and circular references
 */
export function useFormulaValidation({
    formula,
    expression,
    fieldId,
    allFieldDefinitions,
}: UseFormulaValidationOptions): FormulaValidationResult {
    return useMemo(() => {
        const errors: FormulaValidationResult['errors'] = []

        // Validate expression syntax
        if (expression !== undefined) {
            const syntaxResult = validateFormulaExpression(expression)
            if (!syntaxResult.isValid) {
                return syntaxResult
            }
        }

        // Validate AST if we have a formula
        if (formula?.ast) {
            const astResult = validateFormulaAst(formula.ast, allFieldDefinitions)
            if (!astResult.isValid) {
                return astResult
            }

            // Check for circular references
            if (fieldId) {
                const circularError = checkCircularReferences(
                    fieldId,
                    formula.ast,
                    allFieldDefinitions
                )
                if (circularError) {
                    return {
                        isValid: false,
                        errors: [circularError],
                    }
                }
            }
        }

        return {
            isValid: true,
            errors: [],
        }
    }, [formula, expression, fieldId, allFieldDefinitions])
}
