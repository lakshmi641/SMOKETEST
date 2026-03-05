/**
 * Logger utility for the PMS application
 * Provides environment-aware logging that removes console.log in production
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

const isDevelopment = process.env.NODE_ENV === 'development'

class Logger {
  private shouldLog(level: LogLevel): boolean {
    // Always log errors and warnings, even in production
    if (level === 'error' || level === 'warn') {
      return true
    }
    // Only log info, debug, and log in development
    return isDevelopment
  }

  log(...args: any[]): void {
    if (this.shouldLog('log')) {
      console.log(...args)
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(...args)
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(...args)
    }
  }

  error(...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(...args)
    }
  }

  debug(...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(...args)
    }
  }

  /**
   * Log with context (useful for tracking operations)
   */
  withContext(context: string) {
    return {
      log: (...args: any[]) => this.log(`[${context}]`, ...args),
      info: (...args: any[]) => this.info(`[${context}]`, ...args),
      warn: (...args: any[]) => this.warn(`[${context}]`, ...args),
      error: (...args: any[]) => this.error(`[${context}]`, ...args),
      debug: (...args: any[]) => this.debug(`[${context}]`, ...args),
    }
  }
}

// Export singleton instance
export const logger = new Logger()

// Export default for convenience
export default logger

