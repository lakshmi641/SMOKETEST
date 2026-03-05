// Formula Validator
// Validates formula expressions and checks for type mismatches

import type {
    FormulaNode,
    FormulaValidationResult,
    FormulaValidationError,
    FormulaOperator,
    FieldReferenceNode,
    FormulaParameter, // Added for typing
} from '@/types/formula';
import type { ProjectCustomFieldWithDefinition } from '@/types/custom-field';
import { isBuiltInField, getBuiltInField } from './built-in-fields';
import { getFormulaFunction } from './functions';

/**
 * Get the result type of a formula node
 */
export function getNodeResultType(
    node: FormulaNode,
    allFields: ProjectCustomFieldWithDefinition[]
): 'number' | 'date' | 'text' | 'boolean' | 'unknown' {
    switch (node.type) {
        case 'literal':
            return node.valueType === 'boolean' ? 'boolean' : node.valueType;

        case 'field':
            const fieldType = getFieldType(node, allFields);
            // If it's a formula field, try to get its result type
            if (fieldType === 'formula') {
                const field = allFields.find((f) => f.definition.id === node.fieldId);
                if (field?.definition.formula?.resultType) {
                    return field.definition.formula.resultType;
                }
                return 'number'; // Default formula result type
            }
            return fieldType === 'unknown' ? 'unknown' : fieldType;

        case 'binary':
            // Binary operations on numbers return numbers
            // Binary operations on dates (with numbers) could return dates
            const leftType = getNodeResultType(node.left, allFields);
            const rightType = getNodeResultType(node.right, allFields);

            // Date op Date = Number (days diff, or timestamp math)
            if (leftType === 'date' && rightType === 'date') {
                return 'number';
            }
            // Date + Number support REMOVED as per user constraint
            // Number operations return numbers
            if (leftType === 'number' && rightType === 'number') {
                return 'number';
            }
            return 'unknown';

        case 'function':
            // Function return types are defined in the functions library
            // For now, return based on common patterns
            if (node.name === 'DateAdd' || node.name === 'DateSubtract') {
                return 'date';
            }
            if (['Add', 'Subtract', 'Multiply', 'Divide', 'Round', 'Abs', 'Sum', 'Avg', 'Min', 'Max', 'Count', 'Rollup'].includes(node.name)) {
                return 'number';
            }
            if (['If', 'And', 'Or', 'Not'].includes(node.name)) {
                return 'boolean';
            }
            if (['Concatenate', 'Left', 'Right'].includes(node.name)) {
                return 'text';
            }
            if (node.name === 'Length') {
                return 'number';
            }
            return 'unknown';

        case 'rollup':
            return 'number';

        default:
            return 'unknown';
    }
}

/**
 * Get the type of a field reference
 */
function getFieldType(
    node: FieldReferenceNode,
    allFields: ProjectCustomFieldWithDefinition[]
): 'number' | 'date' | 'text' | 'formula' | 'unknown' {
    // Check built-in fields first
    if (isBuiltInField(node.fieldId)) {
        const builtIn = getBuiltInField(node.fieldId);
        if (builtIn) {
            return builtIn.type as 'number' | 'date' | 'text';
        }
    }

    // Check custom fields
    const customField = allFields.find((f) => f.definition.id === node.fieldId);
    if (customField) {
        const type = customField.definition.type;
        if (type === 'number') return 'number';
        if (type === 'date') return 'date';
        if (type === 'text') return 'text';
        if (type === 'formula') return 'formula';
    }

    return 'unknown';
}

/**
 * Check if an operator is valid for given operand types
 */
function isOperatorValidForTypes(
    operator: FormulaOperator,
    leftType: string,
    rightType: string
): { valid: boolean; message?: string } {
    // Math operators require numbers (or date + number for DateAdd-like behavior)
    if (['+', '-', '*', '/'].includes(operator)) {
        // Both numbers: OK
        if (leftType === 'number' && rightType === 'number') {
            return { valid: true };
        }

        // Date +/-/*// Date: OK (All math operations allowed on two dates as per user request)
        if (leftType === 'date' && rightType === 'date') {
            return { valid: true };
        }

        // Date +/- Number REMOVED as per user constraint

        // Formula fields need to be resolved - assume they might be valid
        if (leftType === 'formula' || rightType === 'formula') {
            return { valid: true };
        }

        // Type mismatch
        const operatorName =
            operator === '+' ? '+' :
                operator === '-' ? '-' :
                    operator === '*' ? '*' :
                        '/';

        return {
            valid: false,
            message: `${operatorName} only accepts number fields (or two dates)`,
        };
    }

    return { valid: true };
}

/**
 * Validate a formula AST
 */
export function validateFormulaAst(
    ast: FormulaNode,
    allFields: ProjectCustomFieldWithDefinition[]
): FormulaValidationResult {
    const errors: FormulaValidationError[] = [];

    function validateNode(node: FormulaNode): void {
        switch (node.type) {
            case 'field':
                // Check if field exists
                const fieldExists =
                    isBuiltInField(node.fieldId) ||
                    allFields.some((f) => f.definition.id === node.fieldId);

                if (!fieldExists) {
                    errors.push({
                        type: 'missing_field',
                        message: `Field "${node.fieldName}" not found`,
                    });
                }
                break;

            case 'binary':
                // Validate operand types
                const leftType = getNodeResultType(node.left, allFields);
                const rightType = getNodeResultType(node.right, allFields);

                const operatorCheck = isOperatorValidForTypes(node.operator, leftType, rightType);
                if (!operatorCheck.valid) {
                    errors.push({
                        type: 'type_mismatch',
                        message: operatorCheck.message || 'Type mismatch',
                    });
                }

                // Recursively validate children
                validateNode(node.left);
                validateNode(node.right);
                break;

            case 'function':
                // Recursively validate function arguments
                node.arguments.forEach(validateNode);

                // Validate argument types against function definition
                const funcDef = getFormulaFunction(node.name);
                if (!funcDef) {
                    errors.push({
                        type: 'syntax_error',
                        message: `Unknown function "${node.name}"`,
                    });
                    break;
                }

                // Check argument count
                // Filter required params
                const requiredParams = funcDef.parameters.filter(p => p.required);
                if (node.arguments.length < requiredParams.length) {
                    errors.push({
                        type: 'syntax_error',
                        message: `Function "${node.name}" expects at least ${requiredParams.length} arguments`,
                    });
                } else if (!funcDef.variadic && node.arguments.length > funcDef.parameters.length) {
                    // Only check max args for non-variadic functions
                    errors.push({
                        type: 'syntax_error',
                        message: `Function "${node.name}" expects at most ${funcDef.parameters.length} arguments`,
                    });
                }

                // Check argument types
                node.arguments.forEach((arg, index) => {
                    if (index >= funcDef.parameters.length) return; // Extra args handled above

                    const param = funcDef.parameters[index];
                    if (!param) return;

                    const argType = getNodeResultType(arg, allFields);

                    // Skip checks if arg type is unknown or param accepts any
                    if (argType === 'unknown' || param.type === 'any') return;

                    // Special case for 'field' param type (like in Rollup)
                    if (param.type === 'field') {
                        if (arg.type !== 'field') {
                            errors.push({
                                type: 'type_mismatch',
                                message: `Argument "${param.name}" expects a field reference`,
                            });
                        }
                        return;
                    }

                    // Check type match
                    if (argType !== param.type) {
                        // Allow Formula fields to pass as their result type (already handled by getNodeResultType?)
                        // getNodeResultType handles resolving formula result types.
                        // So if argType is 'date' and param is 'number', it's a mismatch.

                        errors.push({
                            type: 'type_mismatch',
                            message: `Argument "${param.name}" expects ${param.type}, but got ${argType}`,
                        });
                    }
                });
                break;

            case 'rollup':
                // Validate the field being rolled up
                validateNode(node.fieldNode);
                break;

            case 'literal':
                // Literals are always valid
                break;
        }
    }

    validateNode(ast);

    return {
        isValid: errors.length === 0,
        errors,
    };
}

/**
 * Validate a formula expression string (basic syntax check)
 */
export function validateFormulaExpression(expression: string): FormulaValidationResult {
    const errors: FormulaValidationError[] = [];

    if (!expression || expression.trim().length === 0) {
        errors.push({
            type: 'empty_expression',
            message: 'Formula expression cannot be empty',
        });
        return { isValid: false, errors };
    }

    // Check for balanced parentheses
    let parenCount = 0;
    for (let i = 0; i < expression.length; i++) {
        if (expression[i] === '(') parenCount++;
        if (expression[i] === ')') parenCount--;
        if (parenCount < 0) {
            errors.push({
                type: 'syntax_error',
                message: 'Unmatched closing parenthesis',
                position: { start: i, end: i + 1 },
            });
            break;
        }
    }
    if (parenCount > 0) {
        errors.push({
            type: 'syntax_error',
            message: 'Unmatched opening parenthesis',
        });
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

/**
 * Check for circular references in formulas
 */
export function checkCircularReferences(
    fieldId: string,
    ast: FormulaNode,
    allFields: ProjectCustomFieldWithDefinition[],
    visited: Set<string> = new Set()
): FormulaValidationError | null {
    if (visited.has(fieldId)) {
        return {
            type: 'circular_reference',
            message: 'Circular reference detected',
        };
    }

    visited.add(fieldId);

    function checkNode(node: FormulaNode): FormulaValidationError | null {
        if (node.type === 'field') {
            // If this field is a formula, check its dependencies
            const field = allFields.find((f) => f.definition.id === node.fieldId);
            if (field?.definition.type === 'formula' && field.definition.formula?.ast) {
                return checkCircularReferences(
                    node.fieldId,
                    field.definition.formula.ast,
                    allFields,
                    visited
                );
            }
        }

        if (node.type === 'binary') {
            const leftError = checkNode(node.left);
            if (leftError) return leftError;
            return checkNode(node.right);
        }

        if (node.type === 'function') {
            for (const arg of node.arguments) {
                const error = checkNode(arg);
                if (error) return error;
            }
        }

        if (node.type === 'rollup') {
            return checkNode(node.fieldNode);
        }

        return null;
    }

    return checkNode(ast);
}
