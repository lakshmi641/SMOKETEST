/**
 * BPMN Variable Service
 *
 * Manages process and task variables for BPMN workflows.
 * Supports gateway condition evaluation with safe expression parsing.
 *
 * @module lib/services/bpmn-variable-service
 * @version 1.0.0
 * @since Stage 5 - Variable & Condition Engine
 */

import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { v4 as uuidv4 } from 'uuid'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Variable type supported by Flowable
 */
export type FlowableVariableType =
  | 'string'
  | 'integer'
  | 'long'
  | 'double'
  | 'boolean'
  | 'date'
  | 'json'

/**
 * Process variable definition
 */
export interface ProcessVariable {
  name: string
  value: any
  type: FlowableVariableType
  scope: 'process' | 'task' | 'local'
}

/**
 * Condition evaluation result
 */
export interface ConditionResult {
  result: boolean
  evaluated: string
  error?: string
}

/**
 * Variable change event for audit
 */
export interface VariableChangeEvent {
  variableName: string
  oldValue: any
  newValue: any
  changedBy: string
  changedAt: string
  scope: string
}

/**
 * Gateway condition
 */
export interface GatewayCondition {
  expression: string
  targetId: string
  targetName?: string
  isDefault?: boolean
}

// =============================================================================
// SAFE EXPRESSION EVALUATOR
// =============================================================================

/**
 * Token types for expression parsing
 */
enum TokenType {
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',
  NULL = 'NULL',
  IDENTIFIER = 'IDENTIFIER',
  OPERATOR = 'OPERATOR',
  COMPARISON = 'COMPARISON',
  LOGICAL = 'LOGICAL',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  NOT = 'NOT',
  EOF = 'EOF'
}

interface Token {
  type: TokenType
  value: any
}

/**
 * Lexer for expression tokenization
 */
class ExpressionLexer {
  private expression: string
  private pos: number = 0

  constructor(expression: string) {
    this.expression = expression.trim()
  }

  private peek(): string {
    return this.expression[this.pos] || ''
  }

  private advance(): string {
    return this.expression[this.pos++] || ''
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.peek())) {
      this.advance()
    }
  }

  tokenize(): Token[] {
    const tokens: Token[] = []

    while (this.pos < this.expression.length) {
      this.skipWhitespace()

      const char = this.peek()

      if (!char) break

      // Numbers
      const nextChar = this.expression[this.pos + 1]
      if (/\d/.test(char) || (char === '-' && nextChar && /\d/.test(nextChar))) {
        let num = ''
        if (char === '-') {
          num += this.advance()
        }
        while (/[\d.]/.test(this.peek())) {
          num += this.advance()
        }
        tokens.push({ type: TokenType.NUMBER, value: parseFloat(num) })
        continue
      }

      // Strings (single or double quoted)
      if (char === '"' || char === "'") {
        const quote = this.advance()
        let str = ''
        while (this.peek() && this.peek() !== quote) {
          if (this.peek() === '\\') {
            this.advance() // Skip escape char
            str += this.advance()
          } else {
            str += this.advance()
          }
        }
        this.advance() // Closing quote
        tokens.push({ type: TokenType.STRING, value: str })
        continue
      }

      // Operators and comparisons
      if (char === '=' && this.expression[this.pos + 1] === '=') {
        this.advance()
        this.advance()
        tokens.push({ type: TokenType.COMPARISON, value: '==' })
        continue
      }

      if (char === '!' && this.expression[this.pos + 1] === '=') {
        this.advance()
        this.advance()
        tokens.push({ type: TokenType.COMPARISON, value: '!=' })
        continue
      }

      if (char === '>' && this.expression[this.pos + 1] === '=') {
        this.advance()
        this.advance()
        tokens.push({ type: TokenType.COMPARISON, value: '>=' })
        continue
      }

      if (char === '<' && this.expression[this.pos + 1] === '=') {
        this.advance()
        this.advance()
        tokens.push({ type: TokenType.COMPARISON, value: '<=' })
        continue
      }

      if (char === '>') {
        this.advance()
        tokens.push({ type: TokenType.COMPARISON, value: '>' })
        continue
      }

      if (char === '<') {
        this.advance()
        tokens.push({ type: TokenType.COMPARISON, value: '<' })
        continue
      }

      if (char === '&' && this.expression[this.pos + 1] === '&') {
        this.advance()
        this.advance()
        tokens.push({ type: TokenType.LOGICAL, value: '&&' })
        continue
      }

      if (char === '|' && this.expression[this.pos + 1] === '|') {
        this.advance()
        this.advance()
        tokens.push({ type: TokenType.LOGICAL, value: '||' })
        continue
      }

      if (char === '!') {
        this.advance()
        tokens.push({ type: TokenType.NOT, value: '!' })
        continue
      }

      if (char === '(') {
        this.advance()
        tokens.push({ type: TokenType.LPAREN, value: '(' })
        continue
      }

      if (char === ')') {
        this.advance()
        tokens.push({ type: TokenType.RPAREN, value: ')' })
        continue
      }

      // Identifiers and keywords
      if (/[a-zA-Z_$]/.test(char)) {
        let ident = ''
        while (/[a-zA-Z0-9_$.]/.test(this.peek())) {
          ident += this.advance()
        }

        // Check for keywords
        if (ident === 'true') {
          tokens.push({ type: TokenType.BOOLEAN, value: true })
        } else if (ident === 'false') {
          tokens.push({ type: TokenType.BOOLEAN, value: false })
        } else if (ident === 'null' || ident === 'undefined') {
          tokens.push({ type: TokenType.NULL, value: null })
        } else {
          tokens.push({ type: TokenType.IDENTIFIER, value: ident })
        }
        continue
      }

      // Skip unknown characters
      this.advance()
    }

    tokens.push({ type: TokenType.EOF, value: null })
    return tokens
  }
}

/**
 * Parser for expression evaluation
 */
class ExpressionParser {
  private tokens: Token[]
  private pos: number = 0
  private context: Record<string, any>

  constructor(tokens: Token[], context: Record<string, any>) {
    this.tokens = tokens
    this.context = context
  }

  private peek(): Token {
    return this.tokens[this.pos] || { type: TokenType.EOF, value: null }
  }

  private advance(): Token {
    return this.tokens[this.pos++] || { type: TokenType.EOF, value: null }
  }

  private expect(type: TokenType): Token {
    const token = this.advance()
    if (token.type !== type) {
      throw new Error(`Expected ${type}, got ${token.type}`)
    }
    return token
  }

  parse(): boolean {
    const result = this.parseOr()
    return Boolean(result)
  }

  private parseOr(): any {
    let left = this.parseAnd()

    while (this.peek().type === TokenType.LOGICAL && this.peek().value === '||') {
      this.advance()
      const right = this.parseAnd()
      left = left || right
    }

    return left
  }

  private parseAnd(): any {
    let left = this.parseComparison()

    while (this.peek().type === TokenType.LOGICAL && this.peek().value === '&&') {
      this.advance()
      const right = this.parseComparison()
      left = left && right
    }

    return left
  }

  private parseComparison(): any {
    let left = this.parseUnary()

    while (this.peek().type === TokenType.COMPARISON) {
      const op = this.advance().value
      const right = this.parseUnary()

      switch (op) {
        case '==':
          left = left == right
          break
        case '!=':
          left = left != right
          break
        case '>':
          left = left > right
          break
        case '<':
          left = left < right
          break
        case '>=':
          left = left >= right
          break
        case '<=':
          left = left <= right
          break
      }
    }

    return left
  }

  private parseUnary(): any {
    if (this.peek().type === TokenType.NOT) {
      this.advance()
      return !this.parseUnary()
    }
    return this.parsePrimary()
  }

  private parsePrimary(): any {
    const token = this.peek()

    switch (token.type) {
      case TokenType.NUMBER:
        this.advance()
        return token.value

      case TokenType.STRING:
        this.advance()
        return token.value

      case TokenType.BOOLEAN:
        this.advance()
        return token.value

      case TokenType.NULL:
        this.advance()
        return null

      case TokenType.IDENTIFIER:
        this.advance()
        return this.resolveIdentifier(token.value)

      case TokenType.LPAREN:
        this.advance()
        const result = this.parseOr()
        this.expect(TokenType.RPAREN)
        return result

      default:
        throw new Error(`Unexpected token: ${token.type}`)
    }
  }

  private resolveIdentifier(name: string): any {
    // Support dot notation for nested properties
    const parts = name.split('.')
    let value: any = this.context

    for (const part of parts) {
      if (value === null || value === undefined) {
        return null
      }
      value = value[part]
    }

    return value
  }
}

/**
 * Internal expression evaluator that throws errors
 * Used by evaluateCondition to capture error details
 */
function evaluateExpression(expression: string, context: Record<string, any>): boolean {
  // Replace ${variable} syntax with direct variable reference
  const normalizedExpr = expression.replace(/\$\{(\w+(?:\.\w+)*)\}/g, '$1')

  const lexer = new ExpressionLexer(normalizedExpr)
  const tokens = lexer.tokenize()
  const parser = new ExpressionParser(tokens, context)

  return parser.parse()
}

/**
 * Safe expression evaluator
 * Only allows comparison and logical operators
 * Returns false on error instead of throwing
 */
function safeEvaluate(expression: string, context: Record<string, any>): boolean {
  try {
    return evaluateExpression(expression, context)
  } catch (error) {
    console.error('[SafeEvaluate] Expression evaluation error', { expression, error })
    return false
  }
}

// =============================================================================
// BPMN VARIABLE SERVICE
// =============================================================================

/**
 * BpmnVariableService
 *
 * Manages process and task variables for BPMN workflows
 */
export class BpmnVariableService {

  /**
   * Get all variables for a workflow instance
   */
  static async getProcessVariables(
    companyId: string,
    workflowInstanceId: string
  ): Promise<Record<string, any>> {
    const instanceRef = doc(
      db, 'companies', companyId, 'workflowInstances', workflowInstanceId
    )
    const instanceSnap = await getDoc(instanceRef)

    if (!instanceSnap.exists()) {
      throw new Error('Workflow instance not found')
    }

    return instanceSnap.data().variables || {}
  }

  /**
   * Get a specific variable value
   */
  static async getProcessVariable(
    companyId: string,
    workflowInstanceId: string,
    variableName: string
  ): Promise<any> {
    const variables = await this.getProcessVariables(companyId, workflowInstanceId)
    return variables[variableName]
  }

  /**
   * Set a process variable
   * Updates Firestore immediately and queues Flowable sync
   */
  static async setProcessVariable(
    companyId: string,
    workflowInstanceId: string,
    variableName: string,
    variableValue: any,
    userId?: string
  ): Promise<void> {
    const instanceRef = doc(
      db, 'companies', companyId, 'workflowInstances', workflowInstanceId
    )
    const instanceSnap = await getDoc(instanceRef)

    if (!instanceSnap.exists()) {
      throw new Error('Workflow instance not found')
    }

    const instance = instanceSnap.data()
    const oldValue = instance.variables?.[variableName]

    // Update Firestore
    await updateDoc(instanceRef, {
      [`variables.${variableName}`]: variableValue,
      updatedAt: new Date().toISOString()
    })

    // Record variable change for audit
    if (userId) {
      const auditRef = collection(db, 'companies', companyId, 'workflowInstances', workflowInstanceId, 'variableHistory')
      await addDoc(auditRef, {
        variableName,
        oldValue,
        newValue: variableValue,
        changedBy: userId,
        changedAt: new Date().toISOString(),
        scope: 'process'
      } as VariableChangeEvent)
    }

    // Queue Flowable sync if process is connected to Flowable
    if (instance.flowableProcessInstanceId) {
      const outboxRef = collection(db, 'companies', companyId, 'bpmnOutbox')
      await addDoc(outboxRef, {
        companyId,
        eventType: 'SET_VARIABLE',
        payload: {
          processInstanceId: instance.flowableProcessInstanceId,
          variableName,
          variableValue,
          variableType: this.inferVariableType(variableValue)
        },
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date().toISOString(),
        correlationId: `var_${workflowInstanceId}_${variableName}_${Date.now()}`
      })
    }
  }

  /**
   * Set multiple process variables at once
   */
  static async setProcessVariables(
    companyId: string,
    workflowInstanceId: string,
    variables: Record<string, any>,
    userId?: string
  ): Promise<void> {
    const instanceRef = doc(
      db, 'companies', companyId, 'workflowInstances', workflowInstanceId
    )
    const instanceSnap = await getDoc(instanceRef)

    if (!instanceSnap.exists()) {
      throw new Error('Workflow instance not found')
    }

    const instance = instanceSnap.data()
    const oldVariables = instance.variables || {}

    // Build update object
    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString()
    }

    for (const [name, value] of Object.entries(variables)) {
      updateData[`variables.${name}`] = value
    }

    // Update Firestore
    await updateDoc(instanceRef, updateData)

    // Record variable changes for audit
    if (userId) {
      const auditRef = collection(db, 'companies', companyId, 'workflowInstances', workflowInstanceId, 'variableHistory')

      for (const [name, value] of Object.entries(variables)) {
        await addDoc(auditRef, {
          variableName: name,
          oldValue: oldVariables[name],
          newValue: value,
          changedBy: userId,
          changedAt: new Date().toISOString(),
          scope: 'process'
        } as VariableChangeEvent)
      }
    }

    // Queue Flowable sync
    if (instance.flowableProcessInstanceId) {
      const outboxRef = collection(db, 'companies', companyId, 'bpmnOutbox')

      for (const [name, value] of Object.entries(variables)) {
        await addDoc(outboxRef, {
          companyId,
          eventType: 'SET_VARIABLE',
          payload: {
            processInstanceId: instance.flowableProcessInstanceId,
            variableName: name,
            variableValue: value,
            variableType: this.inferVariableType(value)
          },
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date().toISOString(),
          correlationId: `var_${workflowInstanceId}_${name}_${Date.now()}`
        })
      }
    }
  }

  /**
   * Delete a process variable
   */
  static async deleteProcessVariable(
    companyId: string,
    workflowInstanceId: string,
    variableName: string,
    userId?: string
  ): Promise<void> {
    const instanceRef = doc(
      db, 'companies', companyId, 'workflowInstances', workflowInstanceId
    )
    const instanceSnap = await getDoc(instanceRef)

    if (!instanceSnap.exists()) {
      throw new Error('Workflow instance not found')
    }

    const instance = instanceSnap.data()
    const oldValue = instance.variables?.[variableName]

    // Get current variables and remove the specified one
    const variables = { ...(instance.variables || {}) }
    delete variables[variableName]

    // Update Firestore with new variables object
    await updateDoc(instanceRef, {
      variables,
      updatedAt: new Date().toISOString()
    })

    // Record deletion for audit
    if (userId) {
      const auditRef = collection(db, 'companies', companyId, 'workflowInstances', workflowInstanceId, 'variableHistory')
      await addDoc(auditRef, {
        variableName,
        oldValue,
        newValue: null,
        changedBy: userId,
        changedAt: new Date().toISOString(),
        scope: 'process'
      } as VariableChangeEvent)
    }

    // Queue Flowable sync to delete variable
    if (instance.flowableProcessInstanceId) {
      const outboxRef = collection(db, 'companies', companyId, 'bpmnOutbox')
      await addDoc(outboxRef, {
        companyId,
        eventType: 'DELETE_VARIABLE',
        payload: {
          processInstanceId: instance.flowableProcessInstanceId,
          variableName
        },
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date().toISOString(),
        correlationId: `delvar_${workflowInstanceId}_${variableName}_${Date.now()}`
      })
    }
  }

  /**
   * Get variable history for a workflow instance
   */
  static async getVariableHistory(
    companyId: string,
    workflowInstanceId: string,
    variableName?: string
  ): Promise<VariableChangeEvent[]> {
    const historyRef = collection(
      db, 'companies', companyId, 'workflowInstances', workflowInstanceId, 'variableHistory'
    )

    let q = query(historyRef)
    if (variableName) {
      q = query(historyRef, where('variableName', '==', variableName))
    }

    const snapshot = await getDocs(q)

    return snapshot.docs
      .map(doc => doc.data() as VariableChangeEvent)
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
  }

  /**
   * Evaluate a gateway condition
   * Used by BPMN engine to determine branching
   */
  static evaluateCondition(
    condition: string,
    variables: Record<string, any>
  ): ConditionResult {
    try {
      // Use evaluateExpression to get proper error propagation
      const result = evaluateExpression(condition, variables)
      return {
        result,
        evaluated: condition
      }
    } catch (error) {
      console.error('[BpmnVariableService] Condition evaluation error', {
        condition,
        error
      })
      return {
        result: false,
        evaluated: condition,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Evaluate multiple gateway conditions and return matching targets
   */
  static evaluateGatewayConditions(
    conditions: GatewayCondition[],
    variables: Record<string, any>
  ): string[] {
    const matchingTargets: string[] = []
    let hasMatch = false

    // Evaluate non-default conditions first
    for (const condition of conditions) {
      if (condition.isDefault) continue

      const result = this.evaluateCondition(condition.expression, variables)
      if (result.result) {
        matchingTargets.push(condition.targetId)
        hasMatch = true
      }
    }

    // If no matches, use default flow
    if (!hasMatch) {
      const defaultCondition = conditions.find(c => c.isDefault)
      if (defaultCondition) {
        matchingTargets.push(defaultCondition.targetId)
      }
    }

    return matchingTargets
  }

  /**
   * Validate a condition expression without evaluating
   */
  static validateCondition(condition: string): { valid: boolean; error?: string } {
    try {
      // Try to tokenize the expression
      const normalizedExpr = condition.replace(/\$\{(\w+(?:\.\w+)*)\}/g, 'testVar')
      const lexer = new ExpressionLexer(normalizedExpr)
      lexer.tokenize()

      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid expression'
      }
    }
  }

  /**
   * Get task-specific variables
   */
  static async getTaskVariables(
    companyId: string,
    taskId: string
  ): Promise<Record<string, any>> {
    const taskRef = doc(db, 'companies', companyId, 'tasks', taskId)
    const taskSnap = await getDoc(taskRef)

    if (!taskSnap.exists()) {
      throw new Error('Task not found')
    }

    return taskSnap.data().bpmnVariables || {}
  }

  /**
   * Set task-specific variables
   */
  static async setTaskVariables(
    companyId: string,
    taskId: string,
    variables: Record<string, any>
  ): Promise<void> {
    const taskRef = doc(db, 'companies', companyId, 'tasks', taskId)
    const taskSnap = await getDoc(taskRef)

    if (!taskSnap.exists()) {
      throw new Error('Task not found')
    }

    const task = taskSnap.data()

    // Build update object
    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString()
    }

    for (const [name, value] of Object.entries(variables)) {
      updateData[`bpmnVariables.${name}`] = value
    }

    // Update Firestore
    await updateDoc(taskRef, updateData)

    // Queue Flowable sync if task is connected to Flowable
    if (task.flowableTaskId) {
      const outboxRef = collection(db, 'companies', companyId, 'bpmnOutbox')
      await addDoc(outboxRef, {
        companyId,
        eventType: 'UPDATE_VARIABLES',
        payload: {
          flowableTaskId: task.flowableTaskId,
          variables
        },
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date().toISOString(),
        correlationId: `taskvar_${taskId}_${Date.now()}`
      })
    }
  }

  /**
   * Sync variables from Flowable to Firestore
   * Called when receiving VARIABLE_UPDATED webhook events
   */
  static async syncVariableFromFlowable(
    companyId: string,
    processInstanceId: string,
    variableName: string,
    variableValue: any
  ): Promise<void> {
    // Find workflow instance by Flowable process instance ID
    const instancesRef = collection(db, 'companies', companyId, 'workflowInstances')
    const q = query(instancesRef, where('flowableProcessInstanceId', '==', processInstanceId))
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      console.warn('[BpmnVariableService] Workflow instance not found for Flowable sync', {
        processInstanceId
      })
      return
    }

    const instanceDoc = snapshot.docs[0]

    // Update the variable without triggering outbox sync
    if (!instanceDoc) {
      throw new Error('Workflow instance not found')
    }
    await updateDoc(instanceDoc.ref, {
      [`variables.${variableName}`]: variableValue,
      updatedAt: new Date().toISOString()
    })

    console.log('[BpmnVariableService] Variable synced from Flowable', {
      workflowInstanceId: instanceDoc.id,
      variableName
    })
  }

  /**
   * Infer Flowable variable type from JavaScript value
   */
  static inferVariableType(value: any): FlowableVariableType {
    if (typeof value === 'boolean') return 'boolean'
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'double'
    }
    if (value instanceof Date) return 'date'
    if (typeof value === 'object' && value !== null) return 'json'
    return 'string'
  }

  /**
   * Convert JavaScript value to Flowable-compatible format
   */
  static toFlowableValue(value: any): { value: any; type: FlowableVariableType } {
    const type = this.inferVariableType(value)

    let convertedValue = value
    if (type === 'date' && value instanceof Date) {
      convertedValue = value.toISOString()
    } else if (type === 'json') {
      convertedValue = JSON.stringify(value)
    }

    return { value: convertedValue, type }
  }

  /**
   * Convert Flowable value to JavaScript type
   */
  static fromFlowableValue(value: any, type: FlowableVariableType): any {
    switch (type) {
      case 'boolean':
        return Boolean(value)
      case 'integer':
      case 'long':
        return parseInt(value, 10)
      case 'double':
        return parseFloat(value)
      case 'date':
        return new Date(value)
      case 'json':
        return typeof value === 'string' ? JSON.parse(value) : value
      default:
        return String(value)
    }
  }

  /**
   * Get variables required for a specific gateway
   * Extracts variable names referenced in conditions
   */
  static extractVariableNames(condition: string): string[] {
    const variablePattern = /\$\{(\w+(?:\.\w+)*)\}/g
    const identifierPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\b/g

    const variables = new Set<string>()

    // Extract ${variable} syntax
    let match
    while ((match = variablePattern.exec(condition)) !== null) {
      const varName = match[1]
      if (varName) {
        const firstPart = varName.split('.')[0]
        if (firstPart) {
          variables.add(firstPart)
        }
      }
    }

    // Extract direct variable references (excluding keywords)
    const keywords = ['true', 'false', 'null', 'undefined']
    while ((match = identifierPattern.exec(condition)) !== null) {
      if (!match[0] || !match[1]) continue
      const firstPart = match[1].split('.')[0]
      if (!firstPart || keywords.includes(firstPart)) continue
      variables.add(firstPart)
    }

    return Array.from(variables)
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  safeEvaluate,
  ExpressionLexer,
  ExpressionParser
}
