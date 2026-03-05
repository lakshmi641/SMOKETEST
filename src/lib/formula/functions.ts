// Formula Functions Library
// Defines all supported functions with metadata and evaluation logic

import type { FormulaFunction, FormulaFunctionName } from '@/types/formula';

/**
 * All supported formula functions
 */
export const FORMULA_FUNCTIONS: FormulaFunction[] = [
    // ==========================================
    // DATE FUNCTIONS
    // ==========================================
    {
        name: 'DateAdd',
        description: 'Adds days to a date field',
        longDescription: 'Returns a new date by adding the specified number of days to the input date.',
        category: 'date',
        parameters: [
            { name: 'date', type: 'date', description: 'The date to add to', required: true },
            { name: 'days', type: 'number', description: 'Number of days to add (cannot be a date)', required: true },
        ],
        returnType: 'date',
        examples: [
            { expression: 'DateAdd(Due date, 7)', description: 'Adds 7 days to due date' },
            { expression: 'DateAdd(Start date, Units)', description: 'Adds Units days to start date' },
        ],
    },
    {
        name: 'DateSubtract',
        description: 'Subtracts days from a date or calculates difference between dates',
        longDescription: 'Returns a new date by subtracting days, OR returns the number of days difference if subtracting two dates.',
        category: 'date',
        parameters: [
            { name: 'date', type: 'date', description: 'The date to subtract from', required: true },
            { name: 'value', type: 'any', description: 'Days to subtract (number) or another date', required: true },
        ],
        returnType: 'date',
        examples: [
            { expression: 'DateSubtract(Due date, 7)', description: 'Subtracts 7 days from due date' },
            { expression: 'DateSubtract(End date, Units)', description: 'Subtracts Units days from end date' },
        ],
    },
    {
        name: 'DateMultiply',
        description: 'Multiplies date by number',
        longDescription: 'Multiplies a date timestamp by a number. Useful for complex time calculations. Returns a number (timestamp).',
        category: 'date',
        parameters: [
            { name: 'date', type: 'date', description: 'The date to multiply', required: true },
            { name: 'factor', type: 'number', description: 'Factor to multiply by', required: true },
        ],
        returnType: 'number',
        examples: [
            { expression: 'DateMultiply(Start date, 2)', description: 'Multiplies timestamp by 2' },
        ],
    },
    {
        name: 'DateDivide',
        description: 'Divides date by number',
        longDescription: 'Divides a date timestamp by a number. Useful for averaging dates or complex calculations. Returns a number (timestamp).',
        category: 'date',
        parameters: [
            { name: 'date', type: 'date', description: 'The date to divide', required: true },
            { name: 'divisor', type: 'number', description: 'Divisor', required: true },
        ],
        returnType: 'number',
        examples: [
            { expression: 'DateDivide(Due date, 2)', description: 'Halves the timestamp' },
        ],
    },

    // ==========================================
    // MATH FUNCTIONS
    // ==========================================
    {
        name: 'Add',
        description: 'Add two values',
        longDescription: 'Returns the sum of two numbers. You can also use the + operator.',
        category: 'math',
        parameters: [
            { name: 'value1', type: 'number', description: 'First value', required: true },
            { name: 'value2', type: 'number', description: 'Second value', required: true },
        ],
        returnType: 'number',
        examples: [
            { expression: 'Add(Field 1, Field 2)', description: 'Adds two fields' },
            { expression: 'Field 1 + Field 2', description: 'Shorthand syntax' },
            { expression: '3 + 5 + 8', description: 'Chained addition' },
        ],
    },
    {
        name: 'Subtract',
        description: 'Subtract two values',
        longDescription: 'Returns the difference between two numbers. You can also use the - operator.',
        category: 'math',
        parameters: [
            { name: 'value1', type: 'number', description: 'Value to subtract from', required: true },
            { name: 'value2', type: 'number', description: 'Value to subtract', required: true },
        ],
        returnType: 'number',
        examples: [
            { expression: 'Subtract(Field 1, Field 2)', description: 'Subtracts Field 2 from Field 1' },
            { expression: 'Field 1 - Field 2', description: 'Shorthand syntax' },
            { expression: '13 - 5 - 1', description: 'Chained subtraction' },
        ],
    },
    {
        name: 'Multiply',
        description: 'Multiply two values',
        longDescription: 'Returns the product of two numbers. You can also use the * operator.',
        category: 'math',
        parameters: [
            { name: 'value1', type: 'number', description: 'First value', required: true },
            { name: 'value2', type: 'number', description: 'Second value', required: true },
        ],
        returnType: 'number',
        examples: [
            { expression: 'Multiply(Units, Cost)', description: 'Multiplies Units by Cost' },
            { expression: 'Units * Cost', description: 'Shorthand syntax' },
        ],
    },
    {
        name: 'Divide',
        description: 'Divide two values',
        longDescription: 'Returns the quotient of two numbers. Returns null if dividing by zero.',
        category: 'math',
        parameters: [
            { name: 'dividend', type: 'number', description: 'Value to divide', required: true },
            { name: 'divisor', type: 'number', description: 'Value to divide by', required: true },
        ],
        returnType: 'number',
        examples: [
            { expression: 'Divide(Total, Count)', description: 'Divides Total by Count' },
            { expression: 'Total / Count', description: 'Shorthand syntax' },
        ],
    },
    {
        name: 'Round',
        description: 'Round a number',
        longDescription: 'Rounds a number to the specified number of decimal places.',
        category: 'math',
        parameters: [
            { name: 'value', type: 'number', description: 'Value to round', required: true },
            { name: 'decimals', type: 'number', description: 'Number of decimal places', required: false },
        ],
        returnType: 'number',
        examples: [
            { expression: 'Round(Amount, 2)', description: 'Rounds to 2 decimal places' },
            { expression: 'Round(Average)', description: 'Rounds to nearest integer' },
        ],
    },
    {
        name: 'Abs',
        description: 'Absolute value',
        longDescription: 'Returns the absolute (positive) value of a number.',
        category: 'math',
        parameters: [
            { name: 'value', type: 'number', description: 'Value to get absolute of', required: true },
        ],
        returnType: 'number',
        examples: [
            { expression: 'Abs(Difference)', description: 'Gets absolute value of Difference' },
        ],
    },

    // ==========================================
    // AGGREGATE/ROLLUP FUNCTIONS
    // ==========================================
    {
        name: 'Rollup',
        description: 'Sum up all subtasks in a new field',
        longDescription: 'Aggregates values from all subtasks. To include main task values, add the field again as shown in the first example.',
        category: 'aggregate',
        parameters: [
            { name: 'field', type: 'field', description: 'The field to aggregate from subtasks', required: true },
        ],
        returnType: 'number',
        examples: [
            { expression: 'Rollup(Field 1) + Field 1', description: 'Include parent task value' },
            { expression: 'Rollup(Field 1)', description: 'Just subtasks sum' },
        ],
    },
    {
        name: 'Sum',
        description: 'Sum multiple values',
        longDescription: 'Returns the sum of all provided values.',
        category: 'aggregate',
        parameters: [
            { name: 'values', type: 'number', description: 'Values to sum', required: true },
        ],
        returnType: 'number',
        variadic: true,
        examples: [
            { expression: 'Sum(Field1, Field2, Field3)', description: 'Sums three fields' },
        ],
    },
    {
        name: 'Avg',
        description: 'Average of values',
        longDescription: 'Returns the average (mean) of all provided values.',
        category: 'aggregate',
        parameters: [
            { name: 'values', type: 'number', description: 'Values to average', required: true },
        ],
        returnType: 'number',
        variadic: true,
        examples: [
            { expression: 'Avg(Field1, Field2, Field3)', description: 'Averages three fields' },
        ],
    },
    {
        name: 'Min',
        description: 'Minimum value',
        longDescription: 'Returns the smallest of the provided values.',
        category: 'aggregate',
        parameters: [
            { name: 'values', type: 'number', description: 'Values to compare', required: true },
        ],
        returnType: 'number',
        variadic: true,
        examples: [
            { expression: 'Min(Field1, Field2)', description: 'Returns smaller value' },
        ],
    },
    {
        name: 'Max',
        description: 'Maximum value',
        longDescription: 'Returns the largest of the provided values.',
        category: 'aggregate',
        parameters: [
            { name: 'values', type: 'number', description: 'Values to compare', required: true },
        ],
        returnType: 'number',
        variadic: true,
        examples: [
            { expression: 'Max(Field1, Field2)', description: 'Returns larger value' },
        ],
    },
    {
        name: 'Count',
        description: 'Count of values',
        longDescription: 'Returns the count of non-null values.',
        category: 'aggregate',
        parameters: [
            { name: 'values', type: 'any', description: 'Values to count', required: true },
        ],
        returnType: 'number',
        variadic: true,
        examples: [
            { expression: 'Count(Field1, Field2, Field3)', description: 'Counts non-null values' },
        ],
    },

    // ==========================================
    // LOGIC FUNCTIONS
    // ==========================================
    {
        name: 'If',
        description: 'Conditional logic',
        longDescription: 'Returns one value if condition is true, another if false.',
        category: 'logic',
        parameters: [
            { name: 'condition', type: 'boolean', description: 'The condition to evaluate', required: true },
            { name: 'ifTrue', type: 'any', description: 'Value if condition is true', required: true },
            { name: 'ifFalse', type: 'any', description: 'Value if condition is false', required: true },
        ],
        returnType: 'text',
        examples: [
            { expression: 'If(Progress = 100, "Done", "In Progress")', description: 'Status based on progress' },
        ],
    },
    {
        name: 'And',
        description: 'Logical AND',
        longDescription: 'Returns true if all conditions are true.',
        category: 'logic',
        parameters: [
            { name: 'conditions', type: 'boolean', description: 'Conditions to evaluate', required: true },
        ],
        returnType: 'boolean',
        examples: [
            { expression: 'And(Field1 > 0, Field2 > 0)', description: 'Both must be positive' },
        ],
    },
    {
        name: 'Or',
        description: 'Logical OR',
        longDescription: 'Returns true if any condition is true.',
        category: 'logic',
        parameters: [
            { name: 'conditions', type: 'boolean', description: 'Conditions to evaluate', required: true },
        ],
        returnType: 'boolean',
        examples: [
            { expression: 'Or(Field1 > 0, Field2 > 0)', description: 'Either must be positive' },
        ],
    },
    {
        name: 'Not',
        description: 'Logical NOT',
        longDescription: 'Returns the opposite of the condition.',
        category: 'logic',
        parameters: [
            { name: 'condition', type: 'boolean', description: 'Condition to negate', required: true },
        ],
        returnType: 'boolean',
        examples: [
            { expression: 'Not(Field1 = 0)', description: 'True if Field1 is not zero' },
        ],
    },

    // ==========================================
    // TEXT FUNCTIONS
    // ==========================================
    {
        name: 'Concatenate',
        description: 'Join text values',
        longDescription: 'Joins multiple text values into one.',
        category: 'text',
        parameters: [
            { name: 'values', type: 'text', description: 'Text values to join', required: true },
        ],
        returnType: 'text',
        examples: [
            { expression: 'Concatenate(FirstName, " ", LastName)', description: 'Joins names with space' },
        ],
    },
    {
        name: 'Left',
        description: 'Left characters',
        longDescription: 'Returns the first N characters from a text value.',
        category: 'text',
        parameters: [
            { name: 'text', type: 'text', description: 'Text to extract from', required: true },
            { name: 'count', type: 'number', description: 'Number of characters', required: true },
        ],
        returnType: 'text',
        examples: [
            { expression: 'Left(Name, 3)', description: 'First 3 characters of Name' },
        ],
    },
    {
        name: 'Right',
        description: 'Right characters',
        longDescription: 'Returns the last N characters from a text value.',
        category: 'text',
        parameters: [
            { name: 'text', type: 'text', description: 'Text to extract from', required: true },
            { name: 'count', type: 'number', description: 'Number of characters', required: true },
        ],
        returnType: 'text',
        examples: [
            { expression: 'Right(Code, 4)', description: 'Last 4 characters of Code' },
        ],
    },
    {
        name: 'Length',
        description: 'Text length',
        longDescription: 'Returns the number of characters in a text value.',
        category: 'text',
        parameters: [
            { name: 'text', type: 'text', description: 'Text to measure', required: true },
        ],
        returnType: 'number',
        examples: [
            { expression: 'Length(Description)', description: 'Character count of Description' },
        ],
    },
];

/**
 * Get a function by name
 */
export function getFormulaFunction(name: FormulaFunctionName): FormulaFunction | undefined {
    return FORMULA_FUNCTIONS.find((fn) => fn.name === name);
}

/**
 * Get all functions in a category
 */
export function getFunctionsByCategory(category: FormulaFunction['category']): FormulaFunction[] {
    return FORMULA_FUNCTIONS.filter((fn) => fn.category === category);
}

/**
 * Search functions by name or description
 */
export function searchFunctions(query: string): FormulaFunction[] {
    const lowerQuery = query.toLowerCase();
    return FORMULA_FUNCTIONS.filter(
        (fn) =>
            fn.name.toLowerCase().includes(lowerQuery) ||
            fn.description.toLowerCase().includes(lowerQuery)
    );
}
