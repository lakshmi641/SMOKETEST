/**
 * BPMN Resilience Service
 *
 * Implements resilience patterns for reliable BPMN workflow integration:
 * - Exponential backoff retry
 * - Circuit breaker
 * - Dead letter queue handling
 * - Health monitoring
 *
 * @module lib/services/bpmn-resilience-service
 * @version 1.0.0
 * @since Stage 7 - Error Recovery & Resilience
 */

import { doc, getDoc, setDoc, collection, addDoc, query, where, getDocs, updateDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Retry options for operations
 */
export interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  retryableErrors?: string[]
  onRetry?: (attempt: number, error: Error, delay: number) => void
}

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  threshold?: number
  timeout?: number
  volumeThreshold?: number
  errorThresholdPercentage?: number
}

/**
 * Circuit breaker state
 */
export type CircuitState = 'closed' | 'open' | 'half-open'

/**
 * Circuit breaker stats
 */
export interface CircuitStats {
  state: CircuitState
  failures: number
  successes: number
  lastFailure: Date | null
  lastSuccess: Date | null
  totalRequests: number
}

/**
 * Dead letter event
 */
export interface DeadLetterEvent {
  id?: string
  companyId: string
  eventType: string
  payload: Record<string, any>
  error: string
  originalCollection: string
  retryCount: number
  movedAt: string
  correlationId?: string
  metadata?: Record<string, any>
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean
  checks: {
    name: string
    status: 'pass' | 'fail' | 'warn'
    message?: string
    latency?: number
  }[]
  timestamp: string
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  success: boolean
  result?: T
  error?: Error
  attempts: number
  totalTime: number
}

// =============================================================================
// RETRY UTILITIES
// =============================================================================

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate delay with jitter for exponential backoff
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoffMultiplier: number
): number {
  const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt)
  const delay = Math.min(exponentialDelay, maxDelay)

  // Add jitter (0-25% random variation)
  const jitter = delay * 0.25 * Math.random()
  return Math.floor(delay + jitter)
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: Error, retryableErrors?: string[]): boolean {
  const defaultRetryable = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'NETWORK_ERROR',
    'TIMEOUT',
    'SERVICE_UNAVAILABLE',
    '429', // Rate limited
    '500',
    '502',
    '503',
    '504'
  ]

  const errorPatterns = retryableErrors || defaultRetryable
  const errorString = error.message.toLowerCase()

  return errorPatterns.some(pattern =>
    errorString.includes(pattern.toLowerCase())
  )
}

/**
 * Execute operation with exponential backoff retry
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    retryableErrors,
    onRetry
  } = options

  const startTime = Date.now()
  let lastError: Error | undefined
  let attempts = 0

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++

    try {
      const result = await operation()
      return {
        success: true,
        result,
        attempts,
        totalTime: Date.now() - startTime
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === maxRetries) {
        break
      }

      // Check if error is retryable
      if (!isRetryableError(lastError, retryableErrors)) {
        console.log('[Retry] Non-retryable error, not retrying', {
          error: lastError.message
        })
        break
      }

      const delay = calculateDelay(attempt, baseDelay, maxDelay, backoffMultiplier)

      console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
        error: lastError.message
      })

      if (onRetry) {
        onRetry(attempt + 1, lastError, delay)
      }

      await sleep(delay)
    }
  }

  return {
    success: false,
    error: lastError,
    attempts,
    totalTime: Date.now() - startTime
  }
}

// =============================================================================
// CIRCUIT BREAKER
// =============================================================================

/**
 * Circuit Breaker implementation
 *
 * Prevents cascading failures by opening the circuit when
 * too many failures occur within a time window.
 */
export class CircuitBreaker {
  private name: string
  private threshold: number
  private timeout: number
  private failures: number = 0
  private successes: number = 0
  private totalRequests: number = 0
  private lastFailure: Date | null = null
  private lastSuccess: Date | null = null
  private state: CircuitState = 'closed'

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name
    this.threshold = options.threshold ?? 5
    this.timeout = options.timeout ?? 60000 // 1 minute default
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      totalRequests: this.totalRequests
    }
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === 'open'
  }

  /**
   * Check if circuit is half-open
   */
  isHalfOpen(): boolean {
    return this.state === 'half-open'
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.state === 'closed'
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++

    // Check if circuit should transition from open to half-open
    if (this.state === 'open') {
      if (this.lastFailure && Date.now() - this.lastFailure.getTime() > this.timeout) {
        console.log(`[CircuitBreaker:${this.name}] Transitioning to half-open`)
        this.state = 'half-open'
      } else {
        throw new Error(`Circuit breaker [${this.name}] is open`)
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successes++
    this.lastSuccess = new Date()

    if (this.state === 'half-open') {
      console.log(`[CircuitBreaker:${this.name}] Circuit closed after successful probe`)
    }

    this.failures = 0
    this.state = 'closed'
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failures++
    this.lastFailure = new Date()

    if (this.state === 'half-open') {
      // In half-open state, a single failure opens the circuit again
      this.state = 'open'
      console.warn(`[CircuitBreaker:${this.name}] Circuit re-opened after probe failure`)
    } else if (this.failures >= this.threshold) {
      this.state = 'open'
      console.warn(`[CircuitBreaker:${this.name}] Circuit opened after ${this.failures} failures`)
    }
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.failures = 0
    this.state = 'closed'
    console.log(`[CircuitBreaker:${this.name}] Circuit manually reset`)
  }

  /**
   * Manually open the circuit breaker
   */
  trip(): void {
    this.state = 'open'
    this.lastFailure = new Date()
    console.warn(`[CircuitBreaker:${this.name}] Circuit manually tripped`)
  }
}

// =============================================================================
// CIRCUIT BREAKER REGISTRY
// =============================================================================

/**
 * Registry for managing multiple circuit breakers
 */
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map()

  /**
   * Get or create a circuit breaker
   */
  getBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    let breaker = this.breakers.get(name)

    if (!breaker) {
      breaker = new CircuitBreaker(name, options)
      this.breakers.set(name, breaker)
    }

    return breaker
  }

  /**
   * Get all circuit breakers
   */
  getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers)
  }

  /**
   * Get stats for all breakers
   */
  getAllStats(): Record<string, CircuitStats> {
    const stats: Record<string, CircuitStats> = {}

    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats()
    }

    return stats
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset()
    }
  }
}

// Global registry instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry()

// =============================================================================
// DEAD LETTER QUEUE
// =============================================================================

/**
 * Dead Letter Queue Service
 *
 * Manages events that have failed after all retry attempts.
 */
export class DeadLetterQueueService {

  /**
   * Move an event to the dead letter queue
   */
  static async moveToDeadLetter(
    companyId: string,
    event: {
      eventType: string
      payload: Record<string, any>
      retryCount: number
      correlationId?: string
    },
    error: string,
    originalCollection: string = 'bpmnOutbox'
  ): Promise<string> {
    const dlqRef = collection(db, 'companies', companyId, 'deadLetterQueue')

    const deadLetterEvent: Omit<DeadLetterEvent, 'id'> = {
      companyId,
      eventType: event.eventType,
      payload: event.payload,
      error,
      originalCollection,
      retryCount: event.retryCount,
      movedAt: new Date().toISOString(),
      correlationId: event.correlationId,
      metadata: {
        movedBy: 'system',
        lastAttempt: new Date().toISOString()
      }
    }

    const docRef = await addDoc(dlqRef, deadLetterEvent)

    console.error('[DeadLetterQueue] Event moved to DLQ', {
      eventId: docRef.id,
      eventType: event.eventType,
      error
    })

    return docRef.id
  }

  /**
   * Get dead letter events for a company
   */
  static async getDeadLetterEvents(
    companyId: string,
    limitCount: number = 100
  ): Promise<DeadLetterEvent[]> {
    const dlqRef = collection(db, 'companies', companyId, 'deadLetterQueue')
    const q = query(dlqRef, orderBy('movedAt', 'desc'), limit(limitCount))

    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as DeadLetterEvent))
  }

  /**
   * Get dead letter event by ID
   */
  static async getDeadLetterEvent(
    companyId: string,
    eventId: string
  ): Promise<DeadLetterEvent | null> {
    const eventRef = doc(db, 'companies', companyId, 'deadLetterQueue', eventId)
    const eventSnap = await getDoc(eventRef)

    if (!eventSnap.exists()) {
      return null
    }

    return {
      id: eventSnap.id,
      ...eventSnap.data()
    } as DeadLetterEvent
  }

  /**
   * Retry a dead letter event
   * Moves it back to the outbox for reprocessing
   */
  static async retryDeadLetterEvent(
    companyId: string,
    eventId: string
  ): Promise<{ success: boolean; newEventId?: string; error?: string }> {
    try {
      const event = await this.getDeadLetterEvent(companyId, eventId)

      if (!event) {
        return { success: false, error: 'Event not found' }
      }

      // Create new outbox event
      const outboxRef = collection(db, 'companies', companyId, 'bpmnOutbox')
      const newEvent = await addDoc(outboxRef, {
        companyId,
        eventType: event.eventType,
        payload: event.payload,
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date().toISOString(),
        correlationId: event.correlationId || `retry_${eventId}_${Date.now()}`,
        metadata: {
          retriedFrom: 'deadLetterQueue',
          originalEventId: eventId
        }
      })

      // Delete from dead letter queue
      await this.deleteDeadLetterEvent(companyId, eventId)

      console.log('[DeadLetterQueue] Event retried', {
        originalEventId: eventId,
        newEventId: newEvent.id
      })

      return { success: true, newEventId: newEvent.id }

    } catch (error) {
      console.error('[DeadLetterQueue] Error retrying event', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Delete a dead letter event
   */
  static async deleteDeadLetterEvent(
    companyId: string,
    eventId: string
  ): Promise<boolean> {
    try {
      const eventRef = doc(db, 'companies', companyId, 'deadLetterQueue', eventId)

      // Note: Using deleteDoc would require import, using updateDoc to mark as deleted
      await updateDoc(eventRef, {
        status: 'deleted',
        deletedAt: new Date().toISOString()
      })

      return true
    } catch (error) {
      console.error('[DeadLetterQueue] Error deleting event', error)
      return false
    }
  }

  /**
   * Get dead letter queue statistics
   */
  static async getStats(companyId: string): Promise<{
    total: number
    byEventType: Record<string, number>
    oldest: string | null
    newest: string | null
  }> {
    const dlqRef = collection(db, 'companies', companyId, 'deadLetterQueue')
    const snapshot = await getDocs(dlqRef)

    const events = snapshot.docs.map(doc => doc.data() as DeadLetterEvent)

    const byEventType: Record<string, number> = {}
    let oldest: string | null = null
    let newest: string | null = null

    for (const event of events) {
      byEventType[event.eventType] = (byEventType[event.eventType] || 0) + 1

      if (!oldest || event.movedAt < oldest) {
        oldest = event.movedAt
      }
      if (!newest || event.movedAt > newest) {
        newest = event.movedAt
      }
    }

    return {
      total: events.length,
      byEventType,
      oldest,
      newest
    }
  }
}

// =============================================================================
// BPMN RESILIENCE SERVICE
// =============================================================================

/**
 * BpmnResilienceService
 *
 * Main service for resilience patterns in BPMN integration
 */
export class BpmnResilienceService {

  // Circuit breakers for different services
  private static flowableBreaker = circuitBreakerRegistry.getBreaker('flowable', {
    threshold: 5,
    timeout: 60000
  })

  private static firestoreBreaker = circuitBreakerRegistry.getBreaker('firestore', {
    threshold: 10,
    timeout: 30000
  })

  /**
   * Execute operation with retry and circuit breaker
   */
  static async executeWithResilience<T>(
    operation: () => Promise<T>,
    options: {
      service?: 'flowable' | 'firestore' | 'custom'
      customBreaker?: CircuitBreaker
      retryOptions?: RetryOptions
    } = {}
  ): Promise<RetryResult<T>> {
    const { service = 'flowable', customBreaker, retryOptions } = options

    // Get appropriate circuit breaker
    let breaker: CircuitBreaker
    switch (service) {
      case 'flowable':
        breaker = this.flowableBreaker
        break
      case 'firestore':
        breaker = this.firestoreBreaker
        break
      case 'custom':
        if (!customBreaker) {
          throw new Error('Custom breaker required when service is "custom"')
        }
        breaker = customBreaker
        break
      default:
        breaker = this.flowableBreaker
    }

    // Check circuit breaker state
    if (breaker.isOpen()) {
      return {
        success: false,
        error: new Error(`Circuit breaker [${service}] is open`),
        attempts: 0,
        totalTime: 0
      }
    }

    // Execute with retry through circuit breaker
    return withRetry(
      () => breaker.execute(operation),
      {
        maxRetries: retryOptions?.maxRetries ?? 3,
        baseDelay: retryOptions?.baseDelay ?? 1000,
        maxDelay: retryOptions?.maxDelay ?? 30000,
        backoffMultiplier: retryOptions?.backoffMultiplier ?? 2,
        retryableErrors: retryOptions?.retryableErrors,
        onRetry: retryOptions?.onRetry
      }
    )
  }

  /**
   * Execute Flowable API call with resilience
   */
  static async callFlowable<T>(
    operation: () => Promise<T>,
    retryOptions?: RetryOptions
  ): Promise<RetryResult<T>> {
    return this.executeWithResilience(operation, {
      service: 'flowable',
      retryOptions
    })
  }

  /**
   * Execute Firestore operation with resilience
   */
  static async callFirestore<T>(
    operation: () => Promise<T>,
    retryOptions?: RetryOptions
  ): Promise<RetryResult<T>> {
    return this.executeWithResilience(operation, {
      service: 'firestore',
      retryOptions
    })
  }

  /**
   * Get health status of all services
   */
  static async getHealthStatus(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = []

    // Check Flowable circuit breaker
    const flowableStats = this.flowableBreaker.getStats()
    checks.push({
      name: 'flowable-circuit',
      status: flowableStats.state === 'closed' ? 'pass' :
              flowableStats.state === 'half-open' ? 'warn' : 'fail',
      message: `State: ${flowableStats.state}, Failures: ${flowableStats.failures}`
    })

    // Check Firestore circuit breaker
    const firestoreStats = this.firestoreBreaker.getStats()
    checks.push({
      name: 'firestore-circuit',
      status: firestoreStats.state === 'closed' ? 'pass' :
              firestoreStats.state === 'half-open' ? 'warn' : 'fail',
      message: `State: ${firestoreStats.state}, Failures: ${firestoreStats.failures}`
    })

    const healthy = checks.every(c => c.status !== 'fail')

    return {
      healthy,
      checks,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Get circuit breaker stats
   */
  static getCircuitBreakerStats(): Record<string, CircuitStats> {
    return circuitBreakerRegistry.getAllStats()
  }

  /**
   * Reset circuit breaker
   */
  static resetCircuitBreaker(name: string): void {
    const breaker = circuitBreakerRegistry.getBreaker(name)
    breaker.reset()
  }

  /**
   * Reset all circuit breakers
   */
  static resetAllCircuitBreakers(): void {
    circuitBreakerRegistry.resetAll()
  }

  /**
   * Handle operation failure with dead letter queue
   */
  static async handleFailure(
    companyId: string,
    event: {
      eventType: string
      payload: Record<string, any>
      retryCount: number
      maxRetries: number
      correlationId?: string
    },
    error: Error
  ): Promise<{ retried: boolean; movedToDlq: boolean; dlqEventId?: string }> {
    // Check if we should retry or move to DLQ
    if (event.retryCount < event.maxRetries) {
      // Will be retried by the scheduled processor
      return { retried: true, movedToDlq: false }
    }

    // Move to dead letter queue
    const dlqEventId = await DeadLetterQueueService.moveToDeadLetter(
      companyId,
      event,
      error.message
    )

    return {
      retried: false,
      movedToDlq: true,
      dlqEventId
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  sleep,
  calculateDelay,
  isRetryableError
}
