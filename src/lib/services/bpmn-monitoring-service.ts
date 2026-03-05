/**
 * BPMN Monitoring & Observability Service
 *
 * Provides monitoring, metrics, and observability for BPMN workflows:
 * - Structured logging with correlation IDs
 * - Metrics collection (latency, throughput, errors)
 * - Health monitoring
 * - Dashboard data
 *
 * @module lib/services/bpmn-monitoring-service
 * @version 1.0.0
 * @since Stage 8 - Monitoring & Observability
 */

import { doc, getDoc, setDoc, collection, addDoc, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Structured log entry
 */
export interface BpmnLogEntry {
  timestamp: string
  level: LogLevel
  message: string
  correlationId?: string
  companyId?: string
  workflowInstanceId?: string
  taskId?: string
  eventType?: string
  duration?: number
  error?: string
  metadata?: Record<string, any>
}

/**
 * Metric types
 */
export type MetricType =
  | 'counter'
  | 'gauge'
  | 'histogram'
  | 'timer'

/**
 * Metric entry
 */
export interface BpmnMetric {
  name: string
  type: MetricType
  value: number
  labels?: Record<string, string>
  timestamp: string
}

/**
 * Aggregated metrics
 */
export interface AggregatedMetrics {
  period: string
  startTime: string
  endTime: string
  metrics: {
    totalEvents: number
    successfulEvents: number
    failedEvents: number
    successRate: number
    avgLatency: number
    p95Latency: number
    p99Latency: number
    eventsPerMinute: number
    eventsByType: Record<string, number>
    errorsByType: Record<string, number>
  }
}

/**
 * Workflow instance status summary
 */
export interface WorkflowStatusSummary {
  companyId: string
  running: number
  completed: number
  failed: number
  suspended: number
  cancelled: number
  total: number
  avgDuration: number
}

/**
 * Dashboard data
 */
export interface BpmnDashboardData {
  timestamp: string
  companyId?: string
  summary: {
    activeWorkflows: number
    pendingTasks: number
    completedToday: number
    failedToday: number
    avgTaskCompletionTime: number
  }
  recentEvents: BpmnLogEntry[]
  metrics: AggregatedMetrics
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    checks: HealthCheck[]
  }
}

/**
 * Health check
 */
export interface HealthCheck {
  name: string
  status: 'pass' | 'fail' | 'warn'
  message?: string
  lastChecked: string
  latency?: number
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  id: string
  name: string
  condition: AlertCondition
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  channels: ('email' | 'slack' | 'webhook')[]
}

/**
 * Alert condition
 */
export interface AlertCondition {
  metric: string
  operator: '>' | '<' | '>=' | '<=' | '==' | '!='
  threshold: number
  duration?: number // In seconds
}

/**
 * Alert event
 */
export interface AlertEvent {
  id?: string
  alertId: string
  alertName: string
  severity: string
  message: string
  value: number
  threshold: number
  triggeredAt: string
  resolvedAt?: string
  acknowledged: boolean
}

// =============================================================================
// STRUCTURED LOGGING
// =============================================================================

/**
 * BpmnLogger - Structured logging with correlation IDs
 */
export class BpmnLogger {
  private static instance: BpmnLogger
  private enabled: boolean = true
  private minLevel: LogLevel = 'info'
  private logs: BpmnLogEntry[] = []
  private maxLogs: number = 1000

  private constructor() {}

  static getInstance(): BpmnLogger {
    if (!BpmnLogger.instance) {
      BpmnLogger.instance = new BpmnLogger()
    }
    return BpmnLogger.instance
  }

  /**
   * Configure logger
   */
  configure(options: { enabled?: boolean; minLevel?: LogLevel; maxLogs?: number }): void {
    if (options.enabled !== undefined) this.enabled = options.enabled
    if (options.minLevel) this.minLevel = options.minLevel
    if (options.maxLogs) this.maxLogs = options.maxLogs
  }

  /**
   * Check if level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    return levels.indexOf(level) >= levels.indexOf(this.minLevel)
  }

  /**
   * Create log entry
   */
  private createEntry(
    level: LogLevel,
    message: string,
    context?: Partial<BpmnLogEntry>
  ): BpmnLogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context
    }
  }

  /**
   * Add log entry
   */
  private addLog(entry: BpmnLogEntry): void {
    this.logs.push(entry)

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Partial<BpmnLogEntry>): void {
    if (!this.enabled || !this.shouldLog('debug')) return

    const entry = this.createEntry('debug', message, context)
    this.addLog(entry)
    console.debug(`[BPMN:DEBUG] ${message}`, context || '')
  }

  /**
   * Log info message
   */
  info(message: string, context?: Partial<BpmnLogEntry>): void {
    if (!this.enabled || !this.shouldLog('info')) return

    const entry = this.createEntry('info', message, context)
    this.addLog(entry)
    console.log(`[BPMN:INFO] ${message}`, context || '')
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Partial<BpmnLogEntry>): void {
    if (!this.enabled || !this.shouldLog('warn')) return

    const entry = this.createEntry('warn', message, context)
    this.addLog(entry)
    console.warn(`[BPMN:WARN] ${message}`, context || '')
  }

  /**
   * Log error message
   */
  error(message: string, context?: Partial<BpmnLogEntry>): void {
    if (!this.enabled || !this.shouldLog('error')) return

    const entry = this.createEntry('error', message, context)
    this.addLog(entry)
    console.error(`[BPMN:ERROR] ${message}`, context || '')
  }

  /**
   * Log with timing
   */
  timed<T>(
    operation: string,
    fn: () => T | Promise<T>,
    context?: Partial<BpmnLogEntry>
  ): T | Promise<T> {
    const start = Date.now()

    const handleResult = (result: T): T => {
      const duration = Date.now() - start
      this.info(`${operation} completed`, { ...context, duration })
      return result
    }

    const handleError = (error: Error): never => {
      const duration = Date.now() - start
      this.error(`${operation} failed`, {
        ...context,
        duration,
        error: error.message
      })
      throw error
    }

    try {
      const result = fn()

      if (result instanceof Promise) {
        return result.then(handleResult).catch(handleError) as Promise<T>
      }

      return handleResult(result)
    } catch (error) {
      return handleError(error as Error)
    }
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count: number = 100): BpmnLogEntry[] {
    return this.logs.slice(-count)
  }

  /**
   * Get logs by correlation ID
   */
  getLogsByCorrelationId(correlationId: string): BpmnLogEntry[] {
    return this.logs.filter(log => log.correlationId === correlationId)
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): BpmnLogEntry[] {
    return this.logs.filter(log => log.level === level)
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = []
  }
}

// Global logger instance
export const bpmnLogger = BpmnLogger.getInstance()

// =============================================================================
// METRICS COLLECTION
// =============================================================================

/**
 * BpmnMetrics - Metrics collection and aggregation
 */
export class BpmnMetrics {
  private static instance: BpmnMetrics
  private metrics: Map<string, BpmnMetric[]> = new Map()
  private timers: Map<string, number> = new Map()

  private constructor() {}

  static getInstance(): BpmnMetrics {
    if (!BpmnMetrics.instance) {
      BpmnMetrics.instance = new BpmnMetrics()
    }
    return BpmnMetrics.instance
  }

  /**
   * Record a metric
   */
  record(metric: BpmnMetric): void {
    const key = this.getMetricKey(metric.name, metric.labels)
    const existing = this.metrics.get(key) || []
    existing.push(metric)

    // Keep only last 1000 data points per metric
    if (existing.length > 1000) {
      existing.splice(0, existing.length - 1000)
    }

    this.metrics.set(key, existing)
  }

  /**
   * Increment a counter
   */
  increment(name: string, labels?: Record<string, string>, value: number = 1): void {
    this.record({
      name,
      type: 'counter',
      value,
      labels,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Set a gauge value
   */
  gauge(name: string, value: number, labels?: Record<string, string>): void {
    this.record({
      name,
      type: 'gauge',
      value,
      labels,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Record a histogram value
   */
  histogram(name: string, value: number, labels?: Record<string, string>): void {
    this.record({
      name,
      type: 'histogram',
      value,
      labels,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Start a timer
   */
  startTimer(name: string): string {
    const timerId = `${name}_${Date.now()}_${Math.random()}`
    this.timers.set(timerId, Date.now())
    return timerId
  }

  /**
   * Stop a timer and record duration
   */
  stopTimer(timerId: string, labels?: Record<string, string>): number {
    const start = this.timers.get(timerId)
    if (!start) {
      console.warn('[BpmnMetrics] Timer not found:', timerId)
      return 0
    }

    const duration = Date.now() - start
    this.timers.delete(timerId)

    const nameParts = timerId.split('_')
    const name = nameParts[0] || timerId // Fallback to full timerId if split fails
    this.record({
      name,
      type: 'timer',
      value: duration,
      labels,
      timestamp: new Date().toISOString()
    })

    return duration
  }

  /**
   * Get metric key
   */
  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',')
    return `${name}{${labelStr}}`
  }

  /**
   * Get all metrics for a name
   */
  getMetrics(name: string): BpmnMetric[] {
    const results: BpmnMetric[] = []

    for (const [key, metrics] of this.metrics) {
      if (key.startsWith(name)) {
        results.push(...metrics)
      }
    }

    return results
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0

    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((p / 100) * sorted.length) - 1
    const result = sorted[Math.max(0, index)]
    return result ?? 0
  }

  /**
   * Get aggregated metrics for a time period
   */
  getAggregatedMetrics(periodMinutes: number = 60): AggregatedMetrics {
    const now = new Date()
    const startTime = new Date(now.getTime() - periodMinutes * 60 * 1000)

    const eventMetrics = this.getMetrics('bpmn.event')
      .filter(m => new Date(m.timestamp) >= startTime)

    const latencyMetrics = this.getMetrics('bpmn.latency')
      .filter(m => new Date(m.timestamp) >= startTime)

    const successMetrics = eventMetrics.filter(m => m.labels?.status === 'success')
    const failedMetrics = eventMetrics.filter(m => m.labels?.status === 'failed')

    const latencies = latencyMetrics.map(m => m.value)
    const avgLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0

    // Count by event type
    const eventsByType: Record<string, number> = {}
    const errorsByType: Record<string, number> = {}

    for (const m of eventMetrics) {
      const type = m.labels?.eventType || 'unknown'
      eventsByType[type] = (eventsByType[type] || 0) + 1

      if (m.labels?.status === 'failed') {
        errorsByType[type] = (errorsByType[type] || 0) + 1
      }
    }

    return {
      period: `${periodMinutes}m`,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      metrics: {
        totalEvents: eventMetrics.length,
        successfulEvents: successMetrics.length,
        failedEvents: failedMetrics.length,
        successRate: eventMetrics.length > 0
          ? (successMetrics.length / eventMetrics.length) * 100
          : 100,
        avgLatency: Math.round(avgLatency),
        p95Latency: Math.round(this.percentile(latencies, 95)),
        p99Latency: Math.round(this.percentile(latencies, 99)),
        eventsPerMinute: eventMetrics.length / periodMinutes,
        eventsByType,
        errorsByType
      }
    }
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear()
    this.timers.clear()
  }
}

// Global metrics instance
export const bpmnMetrics = BpmnMetrics.getInstance()

// =============================================================================
// BPMN MONITORING SERVICE
// =============================================================================

/**
 * BpmnMonitoringService
 *
 * Main monitoring service for BPMN workflows
 */
export class BpmnMonitoringService {

  /**
   * Record event processing
   */
  static recordEventProcessing(params: {
    eventType: string
    companyId: string
    correlationId?: string
    success: boolean
    duration: number
    error?: string
  }): void {
    // Record event metric
    bpmnMetrics.increment('bpmn.event', {
      eventType: params.eventType,
      companyId: params.companyId,
      status: params.success ? 'success' : 'failed'
    })

    // Record latency
    bpmnMetrics.histogram('bpmn.latency', params.duration, {
      eventType: params.eventType
    })

    // Log
    if (params.success) {
      bpmnLogger.info('Event processed', {
        eventType: params.eventType,
        companyId: params.companyId,
        correlationId: params.correlationId,
        duration: params.duration
      })
    } else {
      bpmnLogger.error('Event processing failed', {
        eventType: params.eventType,
        companyId: params.companyId,
        correlationId: params.correlationId,
        duration: params.duration,
        error: params.error
      })
    }
  }

  /**
   * Record task completion
   */
  static recordTaskCompletion(params: {
    taskId: string
    companyId: string
    duration: number
    success: boolean
    error?: string
  }): void {
    bpmnMetrics.increment('bpmn.task.completion', {
      companyId: params.companyId,
      status: params.success ? 'success' : 'failed'
    })

    bpmnMetrics.histogram('bpmn.task.duration', params.duration, {
      companyId: params.companyId
    })

    bpmnLogger.info('Task completion recorded', {
      taskId: params.taskId,
      companyId: params.companyId,
      duration: params.duration
    })
  }

  /**
   * Record workflow completion
   */
  static recordWorkflowCompletion(params: {
    workflowInstanceId: string
    companyId: string
    duration: number
    status: 'completed' | 'failed' | 'cancelled'
  }): void {
    bpmnMetrics.increment('bpmn.workflow.completion', {
      companyId: params.companyId,
      status: params.status
    })

    bpmnMetrics.histogram('bpmn.workflow.duration', params.duration, {
      companyId: params.companyId,
      status: params.status
    })

    bpmnLogger.info('Workflow completion recorded', {
      workflowInstanceId: params.workflowInstanceId,
      companyId: params.companyId,
      duration: params.duration
    })
  }

  /**
   * Get workflow status summary
   */
  static async getWorkflowStatusSummary(companyId: string): Promise<WorkflowStatusSummary> {
    const instancesRef = collection(db, 'companies', companyId, 'workflowInstances')

    const [running, completed, failed, suspended, cancelled] = await Promise.all([
      getDocs(query(instancesRef, where('status', '==', 'running'))),
      getDocs(query(instancesRef, where('status', '==', 'completed'))),
      getDocs(query(instancesRef, where('status', '==', 'failed'))),
      getDocs(query(instancesRef, where('status', '==', 'suspended'))),
      getDocs(query(instancesRef, where('status', '==', 'cancelled')))
    ])

    // Calculate average duration for completed workflows
    let totalDuration = 0
    let completedCount = 0

    completed.docs.forEach(doc => {
      const data = doc.data()
      if (data.startedAt && data.completedAt) {
        const start = new Date(data.startedAt).getTime()
        const end = new Date(data.completedAt).getTime()
        totalDuration += end - start
        completedCount++
      }
    })

    return {
      companyId,
      running: running.size,
      completed: completed.size,
      failed: failed.size,
      suspended: suspended.size,
      cancelled: cancelled.size,
      total: running.size + completed.size + failed.size + suspended.size + cancelled.size,
      avgDuration: completedCount > 0 ? Math.round(totalDuration / completedCount) : 0
    }
  }

  /**
   * Get dashboard data
   */
  static async getDashboardData(companyId?: string): Promise<BpmnDashboardData> {
    const metrics = bpmnMetrics.getAggregatedMetrics(60)
    const recentLogs = bpmnLogger.getRecentLogs(20)

    // Get health status
    const healthChecks = await this.runHealthChecks()
    const healthStatus = healthChecks.every(c => c.status === 'pass')
      ? 'healthy'
      : healthChecks.some(c => c.status === 'fail')
        ? 'unhealthy'
        : 'degraded'

    // Calculate summary metrics
    const eventMetrics = bpmnMetrics.getMetrics('bpmn.event')
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todayEvents = eventMetrics.filter(m => new Date(m.timestamp) >= todayStart)
    const completedToday = todayEvents.filter(m => m.labels?.status === 'success').length
    const failedToday = todayEvents.filter(m => m.labels?.status === 'failed').length

    const taskDurations = bpmnMetrics.getMetrics('bpmn.task.duration')
    const avgTaskTime = taskDurations.length > 0
      ? taskDurations.reduce((a, m) => a + m.value, 0) / taskDurations.length
      : 0

    return {
      timestamp: new Date().toISOString(),
      companyId,
      summary: {
        activeWorkflows: 0, // Would need to query Firestore
        pendingTasks: 0,    // Would need to query Firestore
        completedToday,
        failedToday,
        avgTaskCompletionTime: Math.round(avgTaskTime)
      },
      recentEvents: recentLogs,
      metrics,
      health: {
        status: healthStatus,
        checks: healthChecks
      }
    }
  }

  /**
   * Run health checks
   */
  static async runHealthChecks(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = []

    // Check recent error rate
    const metrics = bpmnMetrics.getAggregatedMetrics(5)
    const errorRate = 100 - metrics.metrics.successRate

    checks.push({
      name: 'error-rate',
      status: errorRate < 5 ? 'pass' : errorRate < 20 ? 'warn' : 'fail',
      message: `Error rate: ${errorRate.toFixed(1)}%`,
      lastChecked: new Date().toISOString()
    })

    // Check latency
    checks.push({
      name: 'latency',
      status: metrics.metrics.p95Latency < 5000 ? 'pass' :
              metrics.metrics.p95Latency < 10000 ? 'warn' : 'fail',
      message: `P95 latency: ${metrics.metrics.p95Latency}ms`,
      lastChecked: new Date().toISOString(),
      latency: metrics.metrics.p95Latency
    })

    // Check throughput
    const throughput = metrics.metrics.eventsPerMinute
    checks.push({
      name: 'throughput',
      status: 'pass', // No specific threshold, just reporting
      message: `Throughput: ${throughput.toFixed(2)} events/min`,
      lastChecked: new Date().toISOString()
    })

    return checks
  }

  /**
   * Create alert
   */
  static async createAlert(
    companyId: string,
    alert: AlertEvent
  ): Promise<string> {
    const alertsRef = collection(db, 'companies', companyId, 'bpmnAlerts')

    const docRef = await addDoc(alertsRef, {
      ...alert,
      triggeredAt: new Date().toISOString(),
      acknowledged: false
    })

    bpmnLogger.warn('Alert triggered', {
      companyId,
      metadata: {
        alertId: alert.alertId,
        alertName: alert.alertName,
        severity: alert.severity
      }
    })

    return docRef.id
  }

  /**
   * Get active alerts
   */
  static async getActiveAlerts(companyId: string): Promise<AlertEvent[]> {
    const alertsRef = collection(db, 'companies', companyId, 'bpmnAlerts')
    const q = query(
      alertsRef,
      where('resolvedAt', '==', null),
      orderBy('triggeredAt', 'desc'),
      limit(100)
    )

    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AlertEvent))
  }

  /**
   * Acknowledge alert
   */
  static async acknowledgeAlert(companyId: string, alertId: string): Promise<void> {
    const alertRef = doc(db, 'companies', companyId, 'bpmnAlerts', alertId)

    await setDoc(alertRef, {
      acknowledged: true,
      acknowledgedAt: new Date().toISOString()
    }, { merge: true })
  }

  /**
   * Resolve alert
   */
  static async resolveAlert(companyId: string, alertId: string): Promise<void> {
    const alertRef = doc(db, 'companies', companyId, 'bpmnAlerts', alertId)

    await setDoc(alertRef, {
      resolvedAt: new Date().toISOString()
    }, { merge: true })
  }

  /**
   * Export metrics for external monitoring systems
   */
  static exportMetrics(): Record<string, any> {
    const metrics = bpmnMetrics.getAggregatedMetrics(60)

    return {
      bpmn_events_total: metrics.metrics.totalEvents,
      bpmn_events_success: metrics.metrics.successfulEvents,
      bpmn_events_failed: metrics.metrics.failedEvents,
      bpmn_success_rate: metrics.metrics.successRate,
      bpmn_latency_avg_ms: metrics.metrics.avgLatency,
      bpmn_latency_p95_ms: metrics.metrics.p95Latency,
      bpmn_latency_p99_ms: metrics.metrics.p99Latency,
      bpmn_throughput_per_minute: metrics.metrics.eventsPerMinute
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

// BpmnLogger and bpmnLogger are already exported above
// BpmnMetrics is exported where it's defined
