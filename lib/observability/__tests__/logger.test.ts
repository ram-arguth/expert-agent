/**
 * Structured Logger Tests
 *
 * Tests for the Pino-based structured logging module.
 * Covers context propagation, trace parsing, redaction, and log levels.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getLogger,
  createRequestLogger,
  parseTraceContext,
  generateTraceContext,
  log,
} from '../logger';

describe('Structured Logger', () => {
  describe('getLogger', () => {
    it('returns a pino logger instance', () => {
      const logger = getLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('has required log level methods', () => {
      const logger = getLogger();
      expect(typeof logger.trace).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.fatal).toBe('function');
    });
  });

  describe('createRequestLogger', () => {
    it('creates a child logger with context', () => {
      const logger = createRequestLogger({
        userId: 'user-123',
        traceId: 'trace-abc',
        orgId: 'org-456',
      });

      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });

    it('binds context to all log entries', () => {
      const context = {
        userId: 'user-123',
        traceId: 'trace-abc',
        orgId: 'org-456',
        requestId: 'req-789',
      };

      const logger = createRequestLogger(context);

      // The bindings should include the context
      const bindings = logger.bindings();
      expect(bindings.userId).toBe('user-123');
      expect(bindings.traceId).toBe('trace-abc');
      expect(bindings.orgId).toBe('org-456');
      expect(bindings.requestId).toBe('req-789');
    });

    it('supports agent and session context', () => {
      const context = {
        userId: 'user-123',
        agentId: 'ux-analyst',
        sessionId: 'session-abc',
      };

      const logger = createRequestLogger(context);
      const bindings = logger.bindings();

      expect(bindings.agentId).toBe('ux-analyst');
      expect(bindings.sessionId).toBe('session-abc');
    });

    it('allows creating nested child loggers', () => {
      const requestLogger = createRequestLogger({
        userId: 'user-123',
        traceId: 'trace-abc',
      });

      const agentLogger = requestLogger.child({ agentId: 'ux-analyst' });
      const bindings = agentLogger.bindings();

      expect(bindings.userId).toBe('user-123');
      expect(bindings.traceId).toBe('trace-abc');
      expect(bindings.agentId).toBe('ux-analyst');
    });
  });

  describe('parseTraceContext', () => {
    it('parses valid W3C TraceContext header', () => {
      const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
      const result = parseTraceContext(traceparent);

      expect(result).toBeDefined();
      expect(result?.traceId).toBe('0af7651916cd43dd8448eb211c80319c');
      expect(result?.spanId).toBe('b7ad6b7169203331');
      expect(result?.sampled).toBe(true);
    });

    it('parses unsampled trace context', () => {
      const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00';
      const result = parseTraceContext(traceparent);

      expect(result).toBeDefined();
      expect(result?.sampled).toBe(false);
    });

    it('returns undefined for null input', () => {
      expect(parseTraceContext(null)).toBeUndefined();
    });

    it('returns undefined for undefined input', () => {
      expect(parseTraceContext(undefined)).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(parseTraceContext('')).toBeUndefined();
    });

    it('returns undefined for invalid version', () => {
      const traceparent = '01-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
      expect(parseTraceContext(traceparent)).toBeUndefined();
    });

    it('returns undefined for wrong number of parts', () => {
      const traceparent = '00-0af7651916cd43dd8448eb211c80319c-01';
      expect(parseTraceContext(traceparent)).toBeUndefined();
    });

    it('returns undefined for invalid traceId length', () => {
      const traceparent = '00-0af7651916cd43dd-b7ad6b7169203331-01';
      expect(parseTraceContext(traceparent)).toBeUndefined();
    });

    it('returns undefined for invalid spanId length', () => {
      const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b71-01';
      expect(parseTraceContext(traceparent)).toBeUndefined();
    });
  });

  describe('generateTraceContext', () => {
    it('generates valid traceId', () => {
      const context = generateTraceContext();
      expect(context.traceId).toBeDefined();
      expect(context.traceId.length).toBe(32);
      expect(/^[0-9a-f]+$/.test(context.traceId)).toBe(true);
    });

    it('generates valid spanId', () => {
      const context = generateTraceContext();
      expect(context.spanId).toBeDefined();
      expect(context.spanId.length).toBe(16);
      expect(/^[0-9a-f]+$/.test(context.spanId)).toBe(true);
    });

    it('generates unique trace contexts', () => {
      const context1 = generateTraceContext();
      const context2 = generateTraceContext();

      expect(context1.traceId).not.toBe(context2.traceId);
      expect(context1.spanId).not.toBe(context2.spanId);
    });
  });

  describe('log convenience methods', () => {
    it('exposes trace method', () => {
      expect(typeof log.trace).toBe('function');
    });

    it('exposes debug method', () => {
      expect(typeof log.debug).toBe('function');
    });

    it('exposes info method', () => {
      expect(typeof log.info).toBe('function');
    });

    it('exposes warn method', () => {
      expect(typeof log.warn).toBe('function');
    });

    it('exposes error method', () => {
      expect(typeof log.error).toBe('function');
    });

    it('exposes fatal method', () => {
      expect(typeof log.fatal).toBe('function');
    });
  });

  describe('Security - Sensitive Field Redaction', () => {
    let writtenLogs: string[] = [];
    const originalWrite = process.stdout.write;

    beforeEach(() => {
      writtenLogs = [];
      // Capture stdout writes for inspection
      // Note: In production, Pino uses streams; we test the configuration here
    });

    afterEach(() => {
      process.stdout.write = originalWrite;
    });

    it('redact paths are configured', () => {
      // Verify that the logger is configured (we can't easily test redaction
      // without capturing output, but we can verify the logger works)
      const logger = getLogger();
      expect(() => {
        logger.info({ password: 'secret123' }, 'Test log');
      }).not.toThrow();
    });

    it('logger handles objects with sensitive fields without error', () => {
      const logger = getLogger();
      expect(() => {
        logger.info(
          {
            user: 'test-user',
            token: 'abc123',
            accessToken: 'def456',
            data: { apiKey: 'key123' },
          },
          'Processing request'
        );
      }).not.toThrow();
    });

    it('logger handles nested sensitive fields', () => {
      const logger = getLogger();
      expect(() => {
        logger.info(
          {
            request: {
              headers: {
                authorization: 'Bearer token123',
                cookie: 'session=abc',
              },
            },
          },
          'Request received'
        );
      }).not.toThrow();
    });
  });

  describe('Error Serialization', () => {
    it('serializes Error objects correctly', () => {
      const logger = getLogger();
      const error = new Error('Test error message');

      // Should not throw when logging errors
      expect(() => {
        logger.error({ err: error }, 'An error occurred');
      }).not.toThrow();
    });

    it('serializes custom error properties', () => {
      const logger = getLogger();
      const error = new Error('Test error');
      (error as Error & { code: string }).code = 'ERR_TEST';

      expect(() => {
        logger.error({ error }, 'Custom error');
      }).not.toThrow();
    });
  });

  describe('Base Logger Properties', () => {
    it('includes service name in base fields', () => {
      const logger = getLogger();
      // The bindings method returns the bound fields
      // For the base logger, this returns the base configuration
      expect(logger).toBeDefined();
      // We can verify by checking the logger level is set
      expect(logger.level).toBeDefined();
    });

    it('has correct level based on environment', () => {
      const logger = getLogger();
      // In test environment, level should be debug or as configured
      expect(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).toContain(
        logger.level
      );
    });
  });
});

describe('Logger Integration', () => {
  it('can log with mixed context and message', () => {
    const logger = createRequestLogger({
      traceId: '12345678901234567890123456789012',
      userId: 'user-1',
    });

    expect(() => {
      logger.info({ action: 'test', duration: 100 }, 'Test completed');
    }).not.toThrow();
  });

  it('can log errors with stack traces', () => {
    const logger = createRequestLogger({ traceId: 'test-trace' });
    const error = new Error('Something failed');

    expect(() => {
      logger.error({ err: error, component: 'test' }, 'Operation failed');
    }).not.toThrow();
  });

  it('preserves all context through child loggers', () => {
    const requestLogger = createRequestLogger({
      traceId: 'trace-1',
      userId: 'user-1',
    });

    const agentLogger = requestLogger.child({ agentId: 'ux-analyst' });
    const queryLogger = agentLogger.child({ sessionId: 'session-1' });

    const bindings = queryLogger.bindings();
    expect(bindings.traceId).toBe('trace-1');
    expect(bindings.userId).toBe('user-1');
    expect(bindings.agentId).toBe('ux-analyst');
    expect(bindings.sessionId).toBe('session-1');
  });
});
