/**
 * Observability Module
 *
 * Exports structured logging, tracing, and metrics utilities.
 *
 * @see docs/DESIGN.md - Observability section
 * @see docs/IMPLEMENTATION.md - Phase 0.5 Observability Foundation
 */

// Structured Logging
export {
  getLogger,
  createRequestLogger,
  parseTraceContext,
  generateTraceContext,
  log,
  default as logger,
} from './logger';

export type { LogContext, Logger } from './logger';

// OpenTelemetry Tracing
export {
  initializeTracing,
  shutdownTracing,
  getTracingConfig,
  getTracer,
  getCurrentSpan,
  getCurrentSpanContext,
  withSpan,
  withSpanSync,
  setSpanAttributes,
  addSpanEvent,
  recordSpanError,
  extractTraceContext,
  injectTraceContext,
  getTraceparentHeader,
  withTracing,
  SpanKind,
  SpanStatusCode,
} from './tracing';

export type {
  TracingConfig,
  RequestTraceContext,
  Span,
  Tracer,
  SpanContext,
} from './tracing';

// Application Metrics
export {
  // Core metric functions
  incrementCounter,
  setGauge,
  recordHistogram,
  measureDuration,
  measureDurationSync,
  // High-level helpers
  recordRequest,
  recordTokenUsage,
  recordAILatency,
  recordAIError,
  recordSecurityBlock,
  recordPIIDetection,
  recordRateLimitExceeded,
  recordCost,
  recordSessionCreated,
  setActiveSessionCount,
  recordQueryDuration,
  // Access functions
  getCounterValue,
  getGaugeValue,
  getHistogramStats,
  getAllMetrics,
  clearMetrics,
  getMetricDefinitions,
  METRIC_DEFINITIONS,
} from './metrics';

export type {
  MetricType,
  MetricLabels,
  MetricDefinition,
  MetricValue,
  HistogramBuckets,
} from './metrics';
