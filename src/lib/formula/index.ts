// Formula Library - Barrel Export
// Central export for all formula-related functionality

// Types (re-exported from types/formula.ts)
export type {
    FormulaNode,
    FormulaOperator,
    FormulaFunctionName,
    FormulaToken,
    FormulaTokenType,
    FormulaDefinition,
    FunctionCallNode,
    FieldReferenceNode,
    LiteralNode,
    BinaryOperationNode,
    RollupNode,
    BuiltInField,
    FormulaFunction,
    FormulaParameter,
    FormulaExample,
    FormulaValidationError,
    FormulaValidationResult,
    FormulaEvaluationContext,
    FormulaEvaluationResult,
} from '@/types/formula';

// Built-in Fields
export {
    BUILT_IN_FIELDS,
    getBuiltInField,
    isBuiltInField,
    getBuiltInFieldValue,
} from './built-in-fields';

// Formula Functions
export {
    FORMULA_FUNCTIONS,
    getFormulaFunction,
    getFunctionsByCategory,
    searchFunctions,
} from './functions';

// Parser
export {
    tokenize,
    parse,
    parseFormulaExpression,
    astToExpression,
} from './parser';

// Evaluator
export {
    evaluateFormula,
} from './evaluator';

// Validator
export {
    validateFormulaAst,
    validateFormulaExpression,
    checkCircularReferences,
    getNodeResultType,
} from './validator';
