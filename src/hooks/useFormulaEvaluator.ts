'use client'

import { useMemo } from 'react'
import type { FormulaDefinition, FormulaEvaluationResult, FormulaEvaluationContext } from '@/types/formula'
import type { GeneratedTask } from '@/types/task-template-schema'
import type { CustomFieldValue, ProjectCustomFieldWithDefinition } from '@/types/custom-field'
import { evaluateFormula } from '@/lib/formula'

interface UseFormulaEvaluatorOptions {
    formula: FormulaDefinition
    task?: GeneratedTask
    customFields: Record<string, CustomFieldValue>
    allFieldDefinitions: ProjectCustomFieldWithDefinition[]
    subtasks?: GeneratedTask[]
}

/**
 * Hook to evaluate a formula for a given task
 * Memoizes the result to prevent unnecessary recalculations
 */
export function useFormulaEvaluator({
    formula,
    task,
    customFields,
    allFieldDefinitions,
    subtasks,
}: UseFormulaEvaluatorOptions): FormulaEvaluationResult {
    return useMemo(() => {
        if (!formula?.ast || !task) {
            return {
                success: false,
                value: null,
                error: !task ? 'No task provided' : 'No formula AST',
            }
        }

        const context: FormulaEvaluationContext = {
            task,
            subtasks,
            customFields,
            allFieldDefinitions,
        }

        return evaluateFormula(formula.ast, context)
    }, [formula, task, customFields, allFieldDefinitions, subtasks])
}
