// Formula Evaluator
// Evaluates formula AST against task data

import type {
    FormulaNode,
    FormulaEvaluationContext,
    FormulaEvaluationResult,
} from '@/types/formula';
import type { CustomFieldValue } from '@/types/custom-field';
import { getBuiltInFieldValue, isBuiltInField } from './built-in-fields';

/**
 * Evaluate a formula AST and return the result
 */
export function evaluateFormula(
    ast: FormulaNode,
    context: FormulaEvaluationContext
): FormulaEvaluationResult {
    try {
        const value = evaluateNode(ast, context);
        return {
            success: true,
            value,
        };
    } catch (error) {
        return {
            success: false,
            value: null,
            error: error instanceof Error ? error.message : 'Evaluation error',
        };
    }
}

/**
 * Recursively evaluate a formula node
 */
function evaluateNode(
    node: FormulaNode,
    context: FormulaEvaluationContext
): CustomFieldValue | null {
    switch (node.type) {
        case 'literal':
            return node.value as CustomFieldValue;

        case 'field':
            return resolveFieldValue(node.fieldId, context);

        case 'binary':
            return evaluateBinaryOperation(node.operator, node.left, node.right, context);

        case 'function':
            return evaluateFunctionCall(node.name, node.arguments, context);

        case 'rollup':
            return evaluateRollup(node.fieldNode.fieldId, node.aggregation, context);

        default:
            return null;
    }
}

/**
 * Resolve the value of a field reference
 */
function resolveFieldValue(
    fieldId: string,
    context: FormulaEvaluationContext
): CustomFieldValue | null {
    // Check built-in fields first
    if (isBuiltInField(fieldId)) {
        const value = getBuiltInFieldValue(fieldId, context.task);
        return value as CustomFieldValue | null;
    }

    // Check custom fields
    const value = context.customFields[fieldId];
    if (value !== undefined) {
        return value;
    }

    // Check if it's a formula field that needs evaluation
    const fieldDef = context.allFieldDefinitions.find((f) => f.definition.id === fieldId);
    if (fieldDef?.definition.type === 'formula' && fieldDef.definition.formula?.ast) {
        const result = evaluateFormula(fieldDef.definition.formula.ast, context);
        return result.value;
    }

    return null;
}

/**
 * Evaluate a binary operation
 */
function evaluateBinaryOperation(
    operator: string,
    left: FormulaNode,
    right: FormulaNode,
    context: FormulaEvaluationContext
): CustomFieldValue | null {
    const leftValue = evaluateNode(left, context);
    const rightValue = evaluateNode(right, context);

    // Handle null values
    if (leftValue === null || rightValue === null) {
        return null;
    }

    // Handle Date operations
    if (typeof leftValue === 'string' && isDateString(leftValue) && typeof rightValue === 'string' && isDateString(rightValue)) {
        const d1 = new Date(leftValue);
        const d2 = new Date(rightValue);
        const t1 = d1.getTime();
        const t2 = d2.getTime();

        if (operator === '-') {
            // Difference in days (divide by 1000 * 60 * 60 * 24)
            const diffTime = t1 - t2;
            return Number((diffTime / (1000 * 60 * 60 * 24)).toFixed(2));
        }

        // Other operators: Timestamp math (no constraints)
        switch (operator) {
            case '+': return t1 + t2;
            case '*': return t1 * t2;
            case '/': return t2 !== 0 ? t1 / t2 : null;
            default: return null;
        }
    }

    // Handle date + number (add days) - REMOVED/DISABLED by validator constraint, but kept here defensively? 
    // No, user explicitly requested to disable "one date and one number". 
    // I replaced the previous block entirely.

    // Handle number operations (with coercion)
    // Convert strings to numbers if they look like numbers
    const leftNum = typeof leftValue === 'number' ? leftValue : (leftValue && !isNaN(Number(leftValue)) ? Number(leftValue) : NaN);
    const rightNum = typeof rightValue === 'number' ? rightValue : (rightValue && !isNaN(Number(rightValue)) ? Number(rightValue) : NaN);

    if (!isNaN(leftNum) && !isNaN(rightNum)) {
        switch (operator) {
            case '+':
                return leftNum + rightNum;
            case '-':
                return leftNum - rightNum;
            case '*':
                return leftNum * rightNum;
            case '/':
                if (rightNum === 0) return null; // Division by zero
                return leftNum / rightNum;
            default:
                return null;
        }
    }

    // Handle string concatenation with +
    if (operator === '+' && (typeof leftValue === 'string' || typeof rightValue === 'string')) {
        return String(leftValue) + String(rightValue);
    }

    return null;
}

/**
 * Check if a string is a date string
 */
function isDateString(value: string): boolean {
    const date = new Date(value);
    return !isNaN(date.getTime());
}

/**
 * Evaluate a function call
 */
function evaluateFunctionCall(
    name: string,
    args: FormulaNode[],
    context: FormulaEvaluationContext
): CustomFieldValue | null {
    const evaluatedArgs = args.map((arg) => evaluateNode(arg, context));

    switch (name) {
        // Date functions
        case 'DateAdd': {
            const [dateValue, days] = evaluatedArgs;
            if (!dateValue && dateValue !== 0) return null;

            const date = new Date(String(dateValue));
            if (isNaN(date.getTime())) return null;

            if (typeof days === 'number') {
                date.setDate(date.getDate() + days);
                return date.toISOString();
            }
            if (typeof days === 'string') {
                const d2 = new Date(days);
                // If 2nd arg is a valid date, it's invalid for DateAdd
                if (!isNaN(d2.getTime()) && (days.includes('-') || days.includes('/') || days.includes('T'))) {
                    return "Error: Cannot add two dates";
                }
                // Else try as number (days)
                const n = Number(days);
                if (!isNaN(n)) {
                    date.setDate(date.getDate() + n);
                    return date.toISOString();
                }
            }
            return null;
        }

        case 'DateSubtract': {
            const [dateValue, days] = evaluatedArgs;
            if (!dateValue && dateValue !== 0) return null;

            const date = new Date(String(dateValue));
            if (isNaN(date.getTime())) return null;

            if (typeof days === 'number') {
                date.setDate(date.getDate() - days);
                return date.toISOString();
            }
            if (typeof days === 'string') {
                const d2 = new Date(days);
                // If 2nd arg is a valid date, calculate the difference in days
                if (!isNaN(d2.getTime()) && (days.includes('-') || days.includes('/') || days.includes('T'))) {
                    const diffMs = date.getTime() - d2.getTime();
                    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                    return diffDays; // Returns NUMBER (days difference)
                }
                const n = Number(days);
                if (!isNaN(n)) {
                    date.setDate(date.getDate() - n);
                    return date.toISOString();
                }
            }
            return null;
        }

        case 'DateMultiply': {
            const [dateValue, factor] = evaluatedArgs;
            if (typeof dateValue !== 'string' || typeof factor !== 'number') return null;
            const date = new Date(dateValue);
            const timestamp = date.getTime();
            return timestamp * factor;
        }

        case 'DateDivide': {
            const [dateValue, divisor] = evaluatedArgs;
            if (typeof dateValue !== 'string' || typeof divisor !== 'number' || divisor === 0) return null;
            const date = new Date(dateValue);
            const timestamp = date.getTime();
            return timestamp / divisor;
        }

        // Math functions
        case 'Add': {
            const nums = evaluatedArgs.filter((v): v is number => typeof v === 'number');
            return nums.reduce((sum, n) => sum + n, 0);
        }

        case 'Subtract': {
            const [a, b] = evaluatedArgs;
            if (typeof a !== 'number' || typeof b !== 'number') return null;
            return a - b;
        }

        case 'Multiply': {
            const nums = evaluatedArgs.filter((v): v is number => typeof v === 'number');
            return nums.reduce((product, n) => product * n, 1);
        }

        case 'Divide': {
            const [a, b] = evaluatedArgs;
            if (typeof a !== 'number' || typeof b !== 'number' || b === 0) return null;
            return a / b;
        }

        case 'Round': {
            const [value, decimals = 0] = evaluatedArgs;
            if (typeof value !== 'number') return null;
            const dec = typeof decimals === 'number' ? decimals : 0;
            const factor = Math.pow(10, dec);
            return Math.round(value * factor) / factor;
        }

        case 'Abs': {
            const [value] = evaluatedArgs;
            if (typeof value !== 'number') return null;
            return Math.abs(value);
        }

        // Aggregate functions
        case 'Sum': {
            const nums = evaluatedArgs.filter((v): v is number => typeof v === 'number');
            return nums.reduce((sum, n) => sum + n, 0);
        }

        case 'Avg': {
            const nums = evaluatedArgs.filter((v): v is number => typeof v === 'number');
            if (nums.length === 0) return null;
            return nums.reduce((sum, n) => sum + n, 0) / nums.length;
        }

        case 'Min': {
            const nums = evaluatedArgs.filter((v): v is number => typeof v === 'number');
            if (nums.length === 0) return null;
            return Math.min(...nums);
        }

        case 'Max': {
            const nums = evaluatedArgs.filter((v): v is number => typeof v === 'number');
            if (nums.length === 0) return null;
            return Math.max(...nums);
        }

        case 'Count': {
            return evaluatedArgs.filter((v) => v !== null && v !== undefined).length;
        }

        // Logic functions
        case 'If': {
            const [condition, ifTrue, ifFalse] = evaluatedArgs;
            return condition ? (ifTrue ?? null) : (ifFalse ?? null);
        }

        case 'And': {
            return evaluatedArgs.every(Boolean) ? 1 : 0;
        }

        case 'Or': {
            return evaluatedArgs.some(Boolean) ? 1 : 0;
        }

        case 'Not': {
            const [value] = evaluatedArgs;
            return !value ? 1 : 0;
        }

        // Text functions
        case 'Concatenate': {
            return evaluatedArgs.map((v) => String(v ?? '')).join('');
        }

        case 'Left': {
            const [text, count] = evaluatedArgs;
            if (typeof text !== 'string' || typeof count !== 'number') return null;
            return text.substring(0, count);
        }

        case 'Right': {
            const [text, count] = evaluatedArgs;
            if (typeof text !== 'string' || typeof count !== 'number') return null;
            return text.substring(text.length - count);
        }

        case 'Length': {
            const [text] = evaluatedArgs;
            if (typeof text !== 'string') return null;
            return text.length;
        }

        // Rollup is handled separately
        case 'Rollup': {
            // This should be handled by evaluateRollup, but as a fallback:
            const [fieldId] = args;
            if (fieldId && fieldId.type === 'field') {
                return evaluateRollup(fieldId.fieldId, 'sum', context);
            }
            return null;
        }

        default:
            return null;
    }
}

/**
 * Evaluate a rollup aggregation
 */
function evaluateRollup(
    fieldId: string,
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count',
    context: FormulaEvaluationContext
): number | null {
    const { subtasks } = context;

    if (!subtasks || subtasks.length === 0) {
        return 0;
    }

    // Collect values from subtasks
    const values: number[] = [];

    for (const subtask of subtasks) {
        // Get custom field value from subtask
        const subtaskCustomFields = subtask.customFields || {};
        const value = subtaskCustomFields[fieldId];

        if (typeof value === 'number') {
            values.push(value);
        }
    }

    if (values.length === 0) {
        return aggregation === 'count' ? 0 : null;
    }

    switch (aggregation) {
        case 'sum':
            return values.reduce((sum, v) => sum + v, 0);
        case 'avg':
            return values.reduce((sum, v) => sum + v, 0) / values.length;
        case 'min':
            return Math.min(...values);
        case 'max':
            return Math.max(...values);
        case 'count':
            return values.length;
        default:
            return null;
    }
}
