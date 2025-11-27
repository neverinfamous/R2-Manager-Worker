/**
 * Logger Service - Centralized logging for the application
 * 
 * Provides environment-aware logging that:
 * - Outputs to console in development mode
 * - Can be configured to send logs to external services in production
 * - Satisfies ESLint no-console rule by providing a proper logging abstraction
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: Date
  context?: string | undefined
  data?: unknown
}

interface LoggerConfig {
  /** Minimum log level to output. Logs below this level will be ignored. */
  minLevel: LogLevel
  /** Whether to output to browser console */
  enableConsole: boolean
  /** Optional callback for external logging services */
  onLog?: (entry: LogEntry) => void
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

/**
 * Determine if we're in development mode
 */
function isDevelopment(): boolean {
  // Check Vite's mode - import.meta.env is always defined in Vite
  if (import.meta.env.DEV) {
    return true
  }
  return import.meta.env.MODE === 'development'
}

class LoggerService {
  private config: LoggerConfig

  constructor() {
    // Default configuration based on environment
    this.config = {
      minLevel: isDevelopment() ? 'debug' : 'warn',
      enableConsole: isDevelopment()
    }
  }

  /**
   * Configure the logger
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Check if a log level should be output based on configuration
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel]
  }

  /**
   * Format a log entry for console output
   */
  private formatMessage(context: string | undefined, message: string): string {
    if (context) {
      return `[${context}] ${message}`
    }
    return message
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: string, data?: unknown): void {
    if (!this.shouldLog(level)) {
      return
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      data
    }

    // Call external log handler if configured
    if (this.config.onLog) {
      this.config.onLog(entry)
    }

    // Output to console if enabled
    if (this.config.enableConsole) {
      const formattedMessage = this.formatMessage(context, message)
      
      switch (level) {
        case 'debug':
          // eslint-disable-next-line no-console
          if (data !== undefined) console.debug(formattedMessage, data)
          // eslint-disable-next-line no-console
          else console.debug(formattedMessage)
          break
        case 'info':
          // eslint-disable-next-line no-console
          if (data !== undefined) console.info(formattedMessage, data)
          // eslint-disable-next-line no-console
          else console.info(formattedMessage)
          break
        case 'warn':
          // eslint-disable-next-line no-console
          if (data !== undefined) console.warn(formattedMessage, data)
          // eslint-disable-next-line no-console
          else console.warn(formattedMessage)
          break
        case 'error':
          // eslint-disable-next-line no-console
          if (data !== undefined) console.error(formattedMessage, data)
          // eslint-disable-next-line no-console
          else console.error(formattedMessage)
          break
      }
    }
  }

  /**
   * Log a debug message (development only by default)
   */
  debug(message: string, data?: unknown): void
  debug(context: string, message: string, data?: unknown): void
  debug(contextOrMessage: string, messageOrData?: unknown, data?: unknown): void {
    if (typeof messageOrData === 'string') {
      this.log('debug', messageOrData, contextOrMessage, data)
    } else {
      this.log('debug', contextOrMessage, undefined, messageOrData)
    }
  }

  /**
   * Log an info message
   */
  info(message: string, data?: unknown): void
  info(context: string, message: string, data?: unknown): void
  info(contextOrMessage: string, messageOrData?: unknown, data?: unknown): void {
    if (typeof messageOrData === 'string') {
      this.log('info', messageOrData, contextOrMessage, data)
    } else {
      this.log('info', contextOrMessage, undefined, messageOrData)
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: unknown): void
  warn(context: string, message: string, data?: unknown): void
  warn(contextOrMessage: string, messageOrData?: unknown, data?: unknown): void {
    if (typeof messageOrData === 'string') {
      this.log('warn', messageOrData, contextOrMessage, data)
    } else {
      this.log('warn', contextOrMessage, undefined, messageOrData)
    }
  }

  /**
   * Log an error message
   */
  error(message: string, data?: unknown): void
  error(context: string, message: string, data?: unknown): void
  error(contextOrMessage: string, messageOrData?: unknown, data?: unknown): void {
    if (typeof messageOrData === 'string') {
      this.log('error', messageOrData, contextOrMessage, data)
    } else {
      this.log('error', contextOrMessage, undefined, messageOrData)
    }
  }
}

// Export singleton instance
export const logger = new LoggerService()

