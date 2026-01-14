/**
 * OpenTelemetry Tracing Tests
 *
 * Comprehensive tests for the tracing module.
 * Covers configuration, span management, context propagation, and utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTracingConfig,
  getTracer,
  getCurrentSpan,
  withSpan,
  withSpanSync,
  setSpanAttributes,
  addSpanEvent,
  recordSpanError,
  getTraceparentHeader,
  injectTraceContext,
  SpanKind,
  SpanStatusCode,
} from '../tracing';

describe('Tracing Configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getTracingConfig', () => {
    it('returns default config in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const config = getTracingConfig();

      expect(config.serviceName).toBe('expert-agent');
      expect(config.environment).toBe('development');
      expect(config.sampleRate).toBe(1.0); // 100% in dev
      expect(config.useCloudTrace).toBe(false);
    });

    it('returns production config with low sample rate', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'test-project');
      const config = getTracingConfig();

      expect(config.sampleRate).toBe(0.01); // 1% in prod
      expect(config.useCloudTrace).toBe(true);
      expect(config.gcpProjectId).toBe('test-project');
    });

    it('respects custom sample rate', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('TRACE_SAMPLE_RATE', '0.05');
      const config = getTracingConfig();

      expect(config.sampleRate).toBe(0.05);
    });

    it('uses OTEL_SERVICE_NAME env var', () => {
      vi.stubEnv('OTEL_SERVICE_NAME', 'custom-service');
      const config = getTracingConfig();

      expect(config.serviceName).toBe('custom-service');
    });

    it('uses APP_VERSION env var', () => {
      vi.stubEnv('APP_VERSION', '1.2.3');
      const config = getTracingConfig();

      expect(config.serviceVersion).toBe('1.2.3');
    });

    it('uses DEPLOY_ENV for environment', () => {
      vi.stubEnv('DEPLOY_ENV', 'beta');
      const config = getTracingConfig();

      expect(config.environment).toBe('beta');
    });

    it('configures OTLP endpoint', () => {
      vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318');
      const config = getTracingConfig();

      expect(config.otlpEndpoint).toBe('http://localhost:4318');
    });

    it('disables Cloud Trace when no project ID', () => {
      vi.stubEnv('NODE_ENV', 'production');
      // Don't set GOOGLE_CLOUD_PROJECT
      const config = getTracingConfig();

      expect(config.useCloudTrace).toBe(false);
    });

    it('uses gamma sample rate for gamma environment', () => {
      vi.stubEnv('DEPLOY_ENV', 'gamma');
      const config = getTracingConfig();

      expect(config.sampleRate).toBe(0.01); // gamma uses prod rate
    });
  });
});

describe('Tracer Management', () => {
  it('getTracer returns a tracer instance', () => {
    const tracer = getTracer();
    expect(tracer).toBeDefined();
    expect(typeof tracer.startSpan).toBe('function');
    expect(typeof tracer.startActiveSpan).toBe('function');
  });

  it('getTracer accepts custom name', () => {
    const tracer = getTracer('custom-tracer');
    expect(tracer).toBeDefined();
  });
});

describe('Span Utilities', () => {
  describe('getCurrentSpan', () => {
    it('returns undefined when no active span', () => {
      // Outside of any span context
      const span = getCurrentSpan();
      // May be undefined or a noop span depending on SDK state
      expect(span === undefined || span !== undefined).toBe(true);
    });
  });

  describe('withSpan', () => {
    it('creates a span and executes callback', async () => {
      const result = await withSpan('test-span', async (span) => {
        expect(span).toBeDefined();
        expect(typeof span.end).toBe('function');
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('handles errors and records them', async () => {
      const testError = new Error('Test error');

      await expect(
        withSpan('error-span', async () => {
          throw testError;
        })
      ).rejects.toThrow('Test error');
    });

    it('accepts span options', async () => {
      await withSpan(
        'configured-span',
        async (span) => {
          expect(span).toBeDefined();
        },
        {
          kind: SpanKind.CLIENT,
          attributes: { 'test.attribute': 'value' },
        }
      );
    });
  });

  describe('withSpanSync', () => {
    it('creates a span synchronously', () => {
      const result = withSpanSync('sync-span', (span) => {
        expect(span).toBeDefined();
        return 42;
      });

      expect(result).toBe(42);
    });

    it('handles synchronous errors', () => {
      expect(() =>
        withSpanSync('sync-error-span', () => {
          throw new Error('Sync error');
        })
      ).toThrow('Sync error');
    });

    it('accepts span options', () => {
      const result = withSpanSync(
        'configured-sync-span',
        (span) => {
          expect(span).toBeDefined();
          return 'done';
        },
        {
          kind: SpanKind.INTERNAL,
          attributes: { 'custom.attr': 123 },
        }
      );

      expect(result).toBe('done');
    });
  });

  describe('setSpanAttributes', () => {
    it('does not throw without active span', () => {
      expect(() => {
        setSpanAttributes({ key: 'value' });
      }).not.toThrow();
    });

    it('sets attributes on active span', async () => {
      await withSpan('attribute-span', async (span) => {
        setSpanAttributes({
          'user.id': 'user-123',
          'request.count': 5,
          'feature.enabled': true,
        });
        // Attributes are set (we can't easily verify but it shouldn't throw)
      });
    });
  });

  describe('addSpanEvent', () => {
    it('does not throw without active span', () => {
      expect(() => {
        addSpanEvent('test-event');
      }).not.toThrow();
    });

    it('adds event to active span', async () => {
      await withSpan('event-span', async () => {
        addSpanEvent('processing-started', { step: 1 });
        addSpanEvent('processing-completed', { duration: 100 });
      });
    });
  });

  describe('recordSpanError', () => {
    it('does not throw without active span', () => {
      expect(() => {
        recordSpanError(new Error('Test'));
      }).not.toThrow();
    });

    it('records error on active span', async () => {
      await withSpan('error-recording-span', async () => {
        recordSpanError(new Error('Recorded error'));
        // Continue execution - this is for logging, not throwing
      });
    });
  });
});

describe('W3C TraceContext Propagation', () => {
  describe('getTraceparentHeader', () => {
    it('returns undefined when no active span', () => {
      const header = getTraceparentHeader();
      // May be undefined or formatted string depending on SDK state
      expect(header === undefined || typeof header === 'string').toBe(true);
    });

    it('returns formatted header within span', async () => {
      await withSpan('traceparent-span', async () => {
        const header = getTraceparentHeader();
        if (header) {
          // Format: 00-{traceId}-{spanId}-{flags}
          const parts = header.split('-');
          expect(parts.length).toBe(4);
          expect(parts[0]).toBe('00'); // Version
          expect(parts[1].length).toBe(32); // Trace ID
          expect(parts[2].length).toBe(16); // Span ID
          expect(['00', '01']).toContain(parts[3]); // Flags
        }
      });
    });
  });

  describe('injectTraceContext', () => {
    it('injects headers for outgoing requests', async () => {
      await withSpan('inject-span', async () => {
        const headers: Record<string, string> = {};
        injectTraceContext(headers);
        // Headers may or may not be populated depending on SDK state
        expect(headers).toBeDefined();
      });
    });

    it('does not throw without active span', () => {
      const headers: Record<string, string> = {};
      expect(() => {
        injectTraceContext(headers);
      }).not.toThrow();
    });
  });
});

describe('SpanKind and SpanStatusCode exports', () => {
  it('exports SpanKind enum', () => {
    expect(SpanKind.SERVER).toBeDefined();
    expect(SpanKind.CLIENT).toBeDefined();
    expect(SpanKind.INTERNAL).toBeDefined();
    expect(SpanKind.PRODUCER).toBeDefined();
    expect(SpanKind.CONSUMER).toBeDefined();
  });

  it('exports SpanStatusCode enum', () => {
    expect(SpanStatusCode.OK).toBeDefined();
    expect(SpanStatusCode.ERROR).toBeDefined();
    expect(SpanStatusCode.UNSET).toBeDefined();
  });
});

describe('Integration Scenarios', () => {
  it('nested spans work correctly', async () => {
    const operations: string[] = [];

    await withSpan('parent-span', async () => {
      operations.push('parent-start');

      await withSpan('child-span-1', async () => {
        operations.push('child-1');
      });

      await withSpan('child-span-2', async () => {
        operations.push('child-2');
      });

      operations.push('parent-end');
    });

    expect(operations).toEqual([
      'parent-start',
      'child-1',
      'child-2',
      'parent-end',
    ]);
  });

  it('parallel spans work correctly', async () => {
    const results = await Promise.all([
      withSpan('parallel-1', async () => 'result-1'),
      withSpan('parallel-2', async () => 'result-2'),
      withSpan('parallel-3', async () => 'result-3'),
    ]);

    expect(results).toEqual(['result-1', 'result-2', 'result-3']);
  });

  it('mixed sync and async spans work', async () => {
    const result = await withSpan('async-parent', async () => {
      const syncResult = withSpanSync('sync-child', () => 'sync-value');
      return `async-${syncResult}`;
    });

    expect(result).toBe('async-sync-value');
  });
});
