/**
 * Structured Logging with Pino
 *
 * Provides JSON-formatted logs with context propagation for
 * traceId, spanId, userId, and orgId.
 *
 * @see docs/DESIGN.md - Observability section
 * @see docs/IMPLEMENTATION.md - Phase 0.5 Observability Foundation
 */

import pino from 'pino';

// Environment-based log level
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Base logger configuration
const baseLogger = pino({
  level: LOG_LEVEL,
  // Use structured JSON format in production, pretty print in development
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined // Default JSON transport for production
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
  // Base fields added to all logs
  base: {
    env: process.env.NODE_ENV || 'development',
    service: 'expert-agent',
    version: process.env.APP_VERSION || '0.1.0',
  },
  // Timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,
  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      'secret',
      'authorization',
      'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
  // Serializers for common objects
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      // Don't log full headers in production
      headers: process.env.NODE_ENV === 'production'
        ? {
            'user-agent': req.headers?.['user-agent'],
            'content-type': req.headers?.['content-type'],
          }
        : req.headers,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

/**
 * Request context for logging
 * Propagates trace context and user information through the request lifecycle
 */
export interface LogContext {
  /** W3C TraceContext trace ID */
  traceId?: string;
  /** W3C TraceContext span ID */
  spanId?: string;
  /** Authenticated user ID */
  userId?: string;
  /** Active organization ID */
  orgId?: string;
  /** Request ID (for correlation) */
  requestId?: string;
  /** Agent ID (for agent-specific logs) */
  agentId?: string;
  /** Session ID (for session-specific logs) */
  sessionId?: string;
}

/**
 * Logger instance with context binding
 */
export type Logger = typeof baseLogger;

/**
 * Get the base logger without context
 */
export function getLogger() {
  return baseLogger;
}

/**
 * Create a child logger with request context
 * Use this to bind context that should appear in all logs for a request
 *
 * @example
 * const logger = createRequestLogger({
 *   traceId: 'abc123',
 *   userId: 'user-1',
 *   requestId: 'req-456'
 * });
 * logger.info({ action: 'query-start' }, 'Starting query');
 */
export function createRequestLogger(context: LogContext) {
  return baseLogger.child(context);
}

/**
 * Extract trace context from W3C TraceContext header
 *
 * @param traceparent - The traceparent header value (e.g., "00-traceId-spanId-flags")
 * @returns Parsed trace context or undefined if invalid
 */
export function parseTraceContext(traceparent: string | null | undefined): {
  traceId: string;
  spanId: string;
  sampled: boolean;
} | undefined {
  if (!traceparent) return undefined;

  // W3C TraceContext format: version-traceId-parentSpanId-traceFlags
  const parts = traceparent.split('-');
  if (parts.length !== 4) return undefined;

  const [version, traceId, spanId, flags] = parts;

  // Only support version 00
  if (version !== '00') return undefined;

  // Validate traceId and spanId lengths
  if (traceId.length !== 32 || spanId.length !== 16) return undefined;

  // Parse flags (01 = sampled)
  const sampled = (parseInt(flags, 16) & 1) === 1;

  return { traceId, spanId, sampled };
}

/**
 * Generate a new trace context for requests that don't have one
 */
export function generateTraceContext(): { traceId: string; spanId: string } {
  // Generate random hex strings for trace and span IDs
  const randomHex = (length: number) => {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * 16)];
    }
    return result;
  };

  return {
    traceId: randomHex(32),
    spanId: randomHex(16),
  };
}

// Named log levels for convenience
export const log = {
  /** Log at trace level (verbose debugging) */
  trace: baseLogger.trace.bind(baseLogger),
  /** Log at debug level */
  debug: baseLogger.debug.bind(baseLogger),
  /** Log at info level (normal operations) */
  info: baseLogger.info.bind(baseLogger),
  /** Log at warn level (potential issues) */
  warn: baseLogger.warn.bind(baseLogger),
  /** Log at error level (errors requiring attention) */
  error: baseLogger.error.bind(baseLogger),
  /** Log at fatal level (critical failures) */
  fatal: baseLogger.fatal.bind(baseLogger),
};

// Export default logger
export default baseLogger;
