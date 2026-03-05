// ==========================================
// FORMULA TYPE SYSTEM
// Supports: Nested functions, Rollup, Field tokens, Chained operations
// ==========================================

// Operators for simple mode and inline expressions
export type FormulaOperator = '+' | '-' | '*' | '/';

// All supported function names
export type FormulaFunctionName =
    // Date functions
    | 'DateAdd'
    | 'DateSubtract'
    | 'DateMultiply'
    | 'DateDivide'
    // Math functions
    | 'Add'
    | 'Subtract'
    | 'Multiply'
    | 'Divide'
    | 'Round'
    | 'Abs'
    // Aggregate/Rollup functions
    | 'Rollup'
    | 'Sum'
    | 'Avg'
    | 'Min'
    | 'Max'
    | 'Count'
    // Logic functions
    | 'If'
    | 'And'
    | 'Or'
    | 'Not'
    // Text functions
    | 'Concatenate'
    | 'Left'
    | 'Right'
    | 'Length';

// ==========================================
// AST (Abstract Syntax Tree) for Formulas
// Supports NESTED FUNCTIONS and CHAINED OPERATIONS
// ==========================================

/**
 * Base AST Node - all formula expressions are nodes
 */
export type FormulaNode =
    | FunctionCallNode
    | FieldReferenceNode
    | LiteralNode
    | BinaryOperationNode
    | RollupNode;

/**
 * Function Call - can contain nested functions!
 * Example: DateAdd(DateAdd(StartDate, 5), 3)
 */
export interface FunctionCallNode {
    type: 'function';
    name: FormulaFunctionName;
    arguments: FormulaNode[]; // Arguments can be ANY node, including other functions
}

/**
 * Field Reference - points to a custom field or built-in field
 * Displayed as styled token/chip: # Units, 📅 Start date
 */
export interface FieldReferenceNode {
    type: 'field';
    fieldId: string;       // Unique ID (custom field ID or built-in field ID)
    fieldName: string;     // Display name for UI
    fieldType: 'number' | 'date' | 'text' | 'formula'; // Type hint for validation
}

/**
 * Literal Value - numbers, strings, dates, booleans
 */
export interface LiteralNode {
    type: 'literal';
    valueType: 'number' | 'text' | 'date' | 'boolean';
    value: number | string | boolean;
}

/**
 * Binary Operation - supports CHAINED OPERATIONS
 * Example: 3 + 5 + 8 becomes BinaryOp(BinaryOp(3, +, 5), +, 8)
 */
export interface BinaryOperationNode {
    type: 'binary';
    operator: FormulaOperator;
    left: FormulaNode;  // Can be another binary op for chaining
    right: FormulaNode;
}

/**
 * Rollup - Special aggregation over subtasks
 * Example: Rollup(Cost) sums Cost from all subtasks
 */
export interface RollupNode {
    type: 'rollup';
    fieldNode: FieldReferenceNode; // The field to aggregate across subtasks
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count'; // How to aggregate
}

// ==========================================
// FORMULA DEFINITION (stored in Firestore)
// ==========================================

/**
 * Complete formula definition for storage
 */
export interface FormulaDefinition {
    // Raw expression string for display/editing
    expression: string; // e.g., "DateAdd(DateAdd(StartDate, 5), Units)"

    // Parsed AST for evaluation (computed on save)
    ast: FormulaNode;

    // What type this formula returns
    resultType: 'number' | 'date' | 'text' | 'boolean';

    // Simple mode flag (for UI - determines which editor to show)
    isSimpleMode: boolean;
}

// ==========================================
// TOKEN REPRESENTATION (for UI rendering)
// ==========================================

/**
 * Token types for the formula input tokenizer
 */
export type FormulaTokenType =
    | 'function'   // fx DateAdd
    | 'field'      // # Units, 📅 Start date
    | 'operator'   // +, -, *, /
    | 'number'     // 5, 10.5
    | 'text'       // "hello"
    | 'lparen'     // (
    | 'rparen'     // )
    | 'lbrace'     // {
    | 'rbrace'     // }
    | 'comma'      // ,
    | 'whitespace' // spaces
    | 'unknown';   // unrecognized

/**
 * Token for UI rendering
 * Each token is displayed as a styled chip or text
 */
export interface FormulaToken {
    type: FormulaTokenType;
    value: string;           // Display value: "DateAdd", "Units", "+", "(", etc.
    fieldId?: string;        // For field tokens
    fieldType?: string;      // For field tokens: number, date, etc.
    startIndex: number;      // Position in expression string
    endIndex: number;
}

// ==========================================
// BUILT-IN FIELDS
// ==========================================

/**
 * Built-in field that can be used in formulas
 * These are system fields from the task schema
 */
export interface BuiltInField {
    id: string;
    name: string;
    type: 'date' | 'number' | 'text';
    icon: 'calendar' | 'hash' | 'type';
    description?: string;
}

// ==========================================
// FORMULA FUNCTIONS
// ==========================================

/**
 * Formula function definition with metadata
 */
export interface FormulaFunction {
    name: FormulaFunctionName;
    description: string;
    longDescription?: string;
    category: 'date' | 'math' | 'text' | 'logic' | 'aggregate';
    parameters: FormulaParameter[];
    returnType: 'number' | 'date' | 'text' | 'boolean';
    examples: FormulaExample[];
    variadic?: boolean; // If true, function accepts unlimited arguments of the same type
}

/**
 * Function parameter definition
 */
export interface FormulaParameter {
    name: string;
    type: 'date' | 'number' | 'text' | 'boolean' | 'field' | 'any';
    description: string;
    required: boolean;
}

/**
 * Function usage example
 */
export interface FormulaExample {
    expression: string;
    description?: string;
}

// ==========================================
// VALIDATION
// ==========================================

/**
 * Validation error for formula
 */
export interface FormulaValidationError {
    type: 'type_mismatch' | 'missing_field' | 'circular_reference' | 'syntax_error' | 'empty_expression';
    message: string;
    position?: { start: number; end: number }; // Position in expression for highlighting
}

/**
 * Validation result
 */
export interface FormulaValidationResult {
    isValid: boolean;
    errors: FormulaValidationError[];
    warnings?: string[];
}

// ==========================================
// EVALUATION CONTEXT
// ==========================================

import type { GeneratedTask } from '@/types/task-template-schema';
import type { CustomFieldValue, ProjectCustomFieldWithDefinition } from '@/types/custom-field';

/**
 * Context for evaluating formulas
 */
export interface FormulaEvaluationContext {
    task: GeneratedTask;
    subtasks?: GeneratedTask[];
    customFields: Record<string, CustomFieldValue>;
    allFieldDefinitions: ProjectCustomFieldWithDefinition[];
}

/**
 * Evaluation result
 */
export interface FormulaEvaluationResult {
    success: boolean;
    value: CustomFieldValue | null;
    error?: string;
}
