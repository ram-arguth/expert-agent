/**
 * OpenTelemetry Tracing Setup
 *
 * Initializes OpenTelemetry SDK for distributed tracing in Next.js API routes.
 * Configures W3C TraceContext propagation, environment-aware sampling,
 * and Cloud Trace export for production.
 *
 * @see docs/DESIGN.md - Observability section
 * @see docs/IMPLEMENTATION.md - Phase 0.5 Observability Foundation
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  context,
  trace,
  Span,
  SpanKind,
  SpanStatusCode,
  Tracer,
  SpanContext,
  propagation,
} from '@opentelemetry/api';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Environment configuration for tracing
 */
export interface TracingConfig {
  /** Service name for span identification */
  serviceName: string;
  /** Service version */
  serviceVersion: string;
  /** Environment (dev, beta, gamma, prod) */
  environment: string;
  /** Sample rate (0.0 to 1.0) */
  sampleRate: number;
  /** Whether to use Cloud Trace exporter */
  useCloudTrace: boolean;
  /** OTLP endpoint for local testing (optional) */
  otlpEndpoint?: string;
  /** GCP Project ID for Cloud Trace */
  gcpProjectId?: string;
}

/**
 * Get tracing configuration based on environment
 */
export function getTracingConfig(): TracingConfig {
  const env = process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';
  const environment = process.env.DEPLOY_ENV || env;

  // Sampling rates: 100% in dev/beta, 1% in prod (always sample errors)
  let sampleRate = 1.0;
  if (isProduction || environment === 'gamma') {
    sampleRate = parseFloat(process.env.TRACE_SAMPLE_RATE || '0.01');
  }

  return {
    serviceName: process.env.OTEL_SERVICE_NAME || 'expert-agent',
    serviceVersion: process.env.APP_VERSION || '0.1.0',
    environment,
    sampleRate,
    useCloudTrace: isProduction && !!process.env.GOOGLE_CLOUD_PROJECT,
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    gcpProjectId: process.env.GOOGLE_CLOUD_PROJECT,
  };
}

// =============================================================================
// SDK Initialization
// =============================================================================

let sdk: NodeSDK | null = null;
let isInitialized = false;

/**
 * Initialize OpenTelemetry SDK
 * Should be called once at application startup
 */
export function initializeTracing(config?: Partial<TracingConfig>): void {
  if (isInitialized) {
    console.log('[OTEL] Already initialized, skipping');
    return;
  }

  const cfg = { ...getTracingConfig(), ...config };

  // Skip initialization in test environment
  if (process.env.NODE_ENV === 'test' && !process.env.OTEL_TEST_MODE) {
    console.log('[OTEL] Skipping initialization in test environment');
    isInitialized = true;
    return;
  }

  console.log(`[OTEL] Initializing tracing for ${cfg.serviceName} (${cfg.environment})`);
  console.log(`[OTEL] Sample rate: ${cfg.sampleRate * 100}%`);

  // Configure resource attributes
  const resource = resourceFromAttributes({
    [SEMRESATTRS_SERVICE_NAME]: cfg.serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: cfg.serviceVersion,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: cfg.environment,
  });

  // Configure exporter based on environment
  let traceExporter;
  if (cfg.useCloudTrace && cfg.gcpProjectId) {
    console.log(`[OTEL] Using Cloud Trace exporter (project: ${cfg.gcpProjectId})`);
    traceExporter = new TraceExporter({
      projectId: cfg.gcpProjectId,
    });
  } else if (cfg.otlpEndpoint) {
    console.log(`[OTEL] Using OTLP exporter (endpoint: ${cfg.otlpEndpoint})`);
    traceExporter = new OTLPTraceExporter({
      url: cfg.otlpEndpoint,
    });
  } else {
    console.log('[OTEL] No exporter configured, traces will be logged only');
  }

  // Initialize SDK
  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy instrumentations
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
    // Custom sampler for rate-based sampling
    // Always sample errors regardless of rate
  });

  sdk.start();
  isInitialized = true;

  console.log('[OTEL] Tracing initialized successfully');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[OTEL] Shutting down tracing...');
    await sdk?.shutdown();
    console.log('[OTEL] Tracing shutdown complete');
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/**
 * Shutdown OpenTelemetry SDK
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
    isInitialized = false;
  }
}

// =============================================================================
// Tracing Utilities
// =============================================================================

/**
 * Get the default tracer
 */
export function getTracer(name = 'expert-agent'): Tracer {
  return trace.getTracer(name);
}

/**
 * Get the current active span
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Get the current span context
 */
export function getCurrentSpanContext(): SpanContext | undefined {
  return trace.getActiveSpan()?.spanContext();
}

/**
 * Create a new span and execute callback within it
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  }
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(
    name,
    {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes,
    },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Create a new span synchronously
 */
export function withSpanSync<T>(
  name: string,
  fn: (span: Span) => T,
  options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  }
): T {
  const tracer = getTracer();
  const span = tracer.startSpan(name, {
    kind: options?.kind || SpanKind.INTERNAL,
    attributes: options?.attributes,
  });

  try {
    const result = context.with(trace.setSpan(context.active(), span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add attributes to the current span
 */
export function setSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const span = getCurrentSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Add an event to the current span
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  const span = getCurrentSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Record an error on the current span
 */
export function recordSpanError(error: Error): void {
  const span = getCurrentSpan();
  if (span) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.recordException(error);
  }
}

// =============================================================================
// W3C TraceContext Propagation
// =============================================================================

/**
 * Extract trace context from HTTP headers
 * Used for incoming requests to link frontend → backend traces
 */
export function extractTraceContext(headers: Record<string, string | string[] | undefined>): void {
  // Normalize headers to lowercase string values
  const normalizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      normalizedHeaders[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
    }
  }

  // Extract context using W3C TraceContext propagator
  propagation.extract(context.active(), normalizedHeaders);
}

/**
 * Inject trace context into outgoing HTTP headers
 * Used for outgoing requests to propagate traces
 */
export function injectTraceContext(headers: Record<string, string>): void {
  propagation.inject(context.active(), headers);
}

/**
 * Get traceparent header value from current context
 * Format: {version}-{traceId}-{spanId}-{traceFlags}
 */
export function getTraceparentHeader(): string | undefined {
  const spanContext = getCurrentSpanContext();
  if (!spanContext) return undefined;

  const sampled = spanContext.traceFlags === 1 ? '01' : '00';
  return `00-${spanContext.traceId}-${spanContext.spanId}-${sampled}`;
}

// =============================================================================
// Request Tracing Helper
// =============================================================================

/**
 * Trace context for API route handlers
 */
export interface RequestTraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

/**
 * Create a traced API handler wrapper
 * Automatically extracts trace context and creates a span for the request
 */
export function withTracing<T>(
  handlerName: string,
  handler: (ctx: RequestTraceContext) => Promise<T>
): () => Promise<T> {
  return async () => {
    return withSpan(
      handlerName,
      async (span) => {
        const spanContext = span.spanContext();
        const traceContext: RequestTraceContext = {
          traceId: spanContext.traceId,
          spanId: spanContext.spanId,
        };

        return handler(traceContext);
      },
      { kind: SpanKind.SERVER }
    );
  };
}

// =============================================================================
// Exports
// =============================================================================

export {
  SpanKind,
  SpanStatusCode,
  type Span,
  type Tracer,
  type SpanContext,
};
