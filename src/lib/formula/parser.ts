// Formula Parser
// Parses formula expressions into AST

import type {
    FormulaNode,
    FormulaToken,
    FormulaTokenType,
    FormulaOperator,
    FormulaFunctionName,
    BinaryOperationNode,
    FunctionCallNode,
    FieldReferenceNode,
    LiteralNode,
    FormulaDefinition,
} from '@/types/formula';
import type { ProjectCustomFieldWithDefinition } from '@/types/custom-field';
import { FORMULA_FUNCTIONS } from './functions';
import { BUILT_IN_FIELDS } from './built-in-fields';

// ==========================================
// TOKENIZER
// ==========================================

const OPERATORS = ['+', '-', '*', '/'];
const FUNCTION_NAMES = FORMULA_FUNCTIONS.map((f) => f.name);

/**
 * Tokenize a formula expression string
 */
export function tokenize(
    expression: string,
    availableFields: ProjectCustomFieldWithDefinition[]
): FormulaToken[] {
    const tokens: FormulaToken[] = [];
    let i = 0;

    while (i < expression.length) {
        const char = expression[i] as string; // Safe because of loop condition

        // Skip whitespace
        if (/\s/.test(char)) {
            const start = i;
            while (i < expression.length && /\s/.test(expression[i] as string)) {
                i++;
            }
            tokens.push({
                type: 'whitespace',
                value: expression.substring(start, i),
                startIndex: start,
                endIndex: i,
            });
            continue;
        }

        // Parentheses
        if (char === '(') {
            tokens.push({ type: 'lparen', value: '(', startIndex: i, endIndex: i + 1 });
            i++;
            continue;
        }
        if (char === ')') {
            tokens.push({ type: 'rparen', value: ')', startIndex: i, endIndex: i + 1 });
            i++;
            continue;
        }

        // Braces (for Rollup)
        if (char === '{') {
            tokens.push({ type: 'lbrace', value: '{', startIndex: i, endIndex: i + 1 });
            i++;
            continue;
        }
        if (char === '}') {
            tokens.push({ type: 'rbrace', value: '}', startIndex: i, endIndex: i + 1 });
            i++;
            continue;
        }

        // Comma
        if (char === ',') {
            tokens.push({ type: 'comma', value: ',', startIndex: i, endIndex: i + 1 });
            i++;
            continue;
        }

        // Operators
        if (OPERATORS.includes(char)) {
            tokens.push({ type: 'operator', value: char, startIndex: i, endIndex: i + 1 });
            i++;
            continue;
        }

        // Numbers (including decimals)
        if (/\d/.test(char) || (char === '.' && i + 1 < expression.length && /\d/.test(expression[i + 1] as string))) {
            const start = i;
            let hasDecimal = char === '.';
            i++;
            while (i < expression.length && (/\d/.test(expression[i] as string) || (!hasDecimal && expression[i] === '.'))) {
                if (expression[i] === '.') hasDecimal = true;
                i++;
            }
            tokens.push({
                type: 'number',
                value: expression.substring(start, i),
                startIndex: start,
                endIndex: i,
            });
            continue;
        }

        // Strings (quoted)
        if (char === '"' || char === "'") {
            const quote = char;
            const start = i;
            i++; // Skip opening quote
            while (i < expression.length && expression[i] !== quote) {
                if (expression[i] === '\\' && i + 1 < expression.length) {
                    i++; // Skip escape character
                }
                i++;
            }
            i++; // Skip closing quote
            tokens.push({
                type: 'text',
                value: expression.substring(start, i),
                startIndex: start,
                endIndex: i,
            });
            continue;
        }

        // Identifiers (function names or field names)
        if (/[a-zA-Z_]/.test(char)) {
            const start = i;
            while (i < expression.length && /[a-zA-Z0-9_ ]/.test(expression[i] as string)) {
                // Allow spaces in field names, but trim at the end
                if (expression[i] === ' ') {
                    // Look ahead to see if there's more identifier
                    let j = i + 1;
                    while (j < expression.length && expression[j] === ' ') j++;
                    if (j < expression.length && /[a-zA-Z0-9_]/.test(expression[j] as string)) {
                        i = j;
                        continue;
                    }
                    break;
                }
                i++;
            }
            const value = expression.substring(start, i).trim();

            // Check if it's a function name
            if (FUNCTION_NAMES.includes(value as FormulaFunctionName)) {
                tokens.push({
                    type: 'function',
                    value,
                    startIndex: start,
                    endIndex: i,
                });
                continue;
            }

            // Check if it's a built-in field
            const builtInField = BUILT_IN_FIELDS.find(
                (f) => f.name.toLowerCase() === value.toLowerCase() || f.id.toLowerCase() === value.toLowerCase()
            );
            if (builtInField) {
                tokens.push({
                    type: 'field',
                    value: builtInField.name,
                    fieldId: builtInField.id,
                    fieldType: builtInField.type,
                    startIndex: start,
                    endIndex: i,
                });
                continue;
            }

            // Check if it's a custom field
            const customField = availableFields.find(
                (f) => f.definition.name.toLowerCase() === value.toLowerCase()
            );
            if (customField) {
                let fieldType: string = 'text';
                if (customField.definition.type === 'number') fieldType = 'number';
                else if (customField.definition.type === 'date') fieldType = 'date';
                else if (customField.definition.type === 'formula') fieldType = 'formula';

                tokens.push({
                    type: 'field',
                    value: customField.definition.name,
                    fieldId: customField.definition.id,
                    fieldType,
                    startIndex: start,
                    endIndex: i,
                });
                continue;
            }

            // Unknown identifier - treat as potential field name
            tokens.push({
                type: 'field',
                value,
                startIndex: start,
                endIndex: i,
            });
            continue;
        }

        // Unknown character
        tokens.push({
            type: 'unknown',
            value: char,
            startIndex: i,
            endIndex: i + 1,
        });
        i++;
    }

    return tokens;
}

// ==========================================
// PARSER
// ==========================================

/**
 * Parse tokens into an AST
 */
export function parse(tokens: FormulaToken[]): FormulaNode {
    // Filter out whitespace tokens
    const filteredTokens = tokens.filter((t) => t.type !== 'whitespace');

    if (filteredTokens.length === 0) {
        throw new Error('Empty expression');
    }

    let current = 0;

    function peek(): FormulaToken | undefined {
        return filteredTokens[current];
    }

    function consume(): FormulaToken {
        return filteredTokens[current++]!;
    }

    function expect(type: FormulaTokenType): FormulaToken {
        const token = consume();
        if (token.type !== type) {
            throw new Error(`Expected ${type}, got ${token.type}`);
        }
        return token;
    }

    // Parse expression with operator precedence
    function parseExpression(): FormulaNode {
        return parseAddSub();
    }

    // Addition and Subtraction (lower precedence)
    function parseAddSub(): FormulaNode {
        let left = parseMulDiv();

        while (peek()?.type === 'operator' && (peek()?.value === '+' || peek()?.value === '-')) {
            const op = consume().value as FormulaOperator;
            const right = parseMulDiv();
            left = {
                type: 'binary',
                operator: op,
                left,
                right,
            } as BinaryOperationNode;
        }

        return left;
    }

    // Multiplication and Division (higher precedence)
    function parseMulDiv(): FormulaNode {
        let left = parsePrimary();

        while (peek()?.type === 'operator' && (peek()?.value === '*' || peek()?.value === '/')) {
            const op = consume().value as FormulaOperator;
            const right = parsePrimary();
            left = {
                type: 'binary',
                operator: op,
                left,
                right,
            } as BinaryOperationNode;
        }

        return left;
    }

    // Primary expressions (literals, fields, functions, groups)
    function parsePrimary(): FormulaNode {
        const token = peek();

        if (!token) {
            throw new Error('Unexpected end of expression');
        }

        // Parenthesized expression
        if (token.type === 'lparen') {
            consume(); // (
            const expr = parseExpression();
            expect('rparen'); // )
            return expr;
        }

        // Number literal
        if (token.type === 'number') {
            consume();
            return {
                type: 'literal',
                valueType: 'number',
                value: parseFloat(token.value),
            } as LiteralNode;
        }

        // Text literal
        if (token.type === 'text') {
            consume();
            // Remove quotes
            const text = token.value.slice(1, -1).replace(/\\(.)/g, '$1');
            return {
                type: 'literal',
                valueType: 'text',
                value: text,
            } as LiteralNode;
        }

        // Function call
        if (token.type === 'function') {
            consume();
            const funcName = token.value as FormulaFunctionName;

            // Handle Rollup with braces
            if (funcName === 'Rollup' && peek()?.type === 'lbrace') {
                consume(); // {
                const args: FormulaNode[] = [];
                if (peek()?.type !== 'rbrace') {
                    args.push(parseExpression());
                    while (peek()?.type === 'comma') {
                        consume(); // ,
                        args.push(parseExpression());
                    }
                }
                expect('rbrace'); // }
                return {
                    type: 'function',
                    name: funcName,
                    arguments: args,
                } as FunctionCallNode;
            }

            // Regular function with parentheses
            expect('lparen');
            const args: FormulaNode[] = [];
            if (peek()?.type !== 'rparen') {
                args.push(parseExpression());
                while (peek()?.type === 'comma') {
                    consume(); // ,
                    args.push(parseExpression());
                }
            }
            expect('rparen');
            return {
                type: 'function',
                name: funcName,
                arguments: args,
            } as FunctionCallNode;
        }

        // Field reference
        if (token.type === 'field') {
            consume();
            return {
                type: 'field',
                fieldId: token.fieldId || token.value,
                fieldName: token.value,
                fieldType: (token.fieldType as 'number' | 'date' | 'text' | 'formula') || 'text',
            } as FieldReferenceNode;
        }

        throw new Error(`Unexpected token: ${token.type} "${token.value}"`);
    }

    const ast = parseExpression();

    // Make sure we consumed all tokens
    if (current < filteredTokens.length) {
        throw new Error(`Unexpected token after expression: ${filteredTokens[current]!.value}`);
    }

    return ast;
}

// ==========================================
// HIGH-LEVEL API
// ==========================================

/**
 * Parse a formula expression string into a FormulaDefinition
 */
export function parseFormulaExpression(
    expression: string,
    availableFields: ProjectCustomFieldWithDefinition[]
): FormulaDefinition {
    const tokens = tokenize(expression, availableFields);
    const ast = parse(tokens);

    // Determine result type from AST
    const resultType = inferResultType(ast);

    // Determine if this is a simple formula (field op field)
    const isSimpleMode = checkIfSimpleMode(ast);

    return {
        expression,
        ast,
        resultType,
        isSimpleMode,
    };
}

/**
 * Infer the result type of a formula AST
 */
function inferResultType(node: FormulaNode): 'number' | 'date' | 'text' | 'boolean' {
    switch (node.type) {
        case 'literal':
            if (node.valueType === 'boolean') return 'boolean';
            return node.valueType as 'number' | 'date' | 'text';

        case 'field':
            if (node.fieldType === 'number') return 'number';
            if (node.fieldType === 'date') return 'date';
            if (node.fieldType === 'formula') return 'number'; // Assume formula returns number
            return 'text';

        case 'binary':
            // Most binary ops return numbers
            return 'number';

        case 'function':
            const func = FORMULA_FUNCTIONS.find((f) => f.name === node.name);
            if (func) {
                return func.returnType as 'number' | 'date' | 'text' | 'boolean';
            }
            return 'number';

        case 'rollup':
            return 'number';

        default:
            return 'number';
    }
}

/**
 * Check if AST represents a simple formula (field op field)
 */
function checkIfSimpleMode(node: FormulaNode): boolean {
    if (node.type !== 'binary') return false;

    const { left, right } = node;

    // Simple mode: both operands are fields or literals
    const isSimpleOperand = (n: FormulaNode) => n.type === 'field' || n.type === 'literal';

    return isSimpleOperand(left) && isSimpleOperand(right);
}

/**
 * Convert AST back to expression string
 */
export function astToExpression(node: FormulaNode): string {
    switch (node.type) {
        case 'literal':
            if (node.valueType === 'text') {
                return `"${node.value}"`;
            }
            return String(node.value);

        case 'field':
            return node.fieldName;

        case 'binary':
            const left = astToExpression(node.left);
            const right = astToExpression(node.right);
            return `${left} ${node.operator} ${right}`;

        case 'function':
            const args = node.arguments.map(astToExpression).join(', ');
            return `${node.name}(${args})`;

        case 'rollup':
            return `Rollup(${node.fieldNode.fieldName})`;

        default:
            return '';
    }
}
