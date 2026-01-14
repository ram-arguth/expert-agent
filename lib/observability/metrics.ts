/**
 * Application Metrics Module
 *
 * Defines and tracks key application metrics for observability.
 * Designed to emit to Cloud Monitoring in production, with in-memory
 * tracking for development and testing.
 *
 * Key Metrics:
 * - Request latency (histogram)
 * - Token usage (counter)
 * - Error count (counter)
 * - Active sessions (gauge)
 * - Query processing time (histogram)
 *
 * @see docs/DESIGN.md - Observability section
 * @see docs/IMPLEMENTATION.md - Phase 0.5 Observability Foundation
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Metric types supported
 */
export type MetricType = 'counter' | 'gauge' | 'histogram';

/**
 * Label key-value pairs for metric dimensions
 */
export type MetricLabels = Record<string, string | number | boolean>;

/**
 * Metric definition
 */
export interface MetricDefinition {
  name: string;
  description: string;
  type: MetricType;
  unit: string;
  labels: string[];
}

/**
 * Recorded metric value
 */
export interface MetricValue {
  name: string;
  value: number;
  labels: MetricLabels;
  timestamp: Date;
}

/**
 * Histogram bucket configuration
 */
export interface HistogramBuckets {
  boundaries: number[];
  counts: number[];
  sum: number;
  count: number;
}

// =============================================================================
// Metric Definitions
// =============================================================================

/**
 * Pre-defined application metrics aligned with DESIGN.md requirements
 */
export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  // Request metrics
  'request.latency': {
    name: 'expert_agent/request/latency',
    description: 'Request latency in milliseconds',
    type: 'histogram',
    unit: 'ms',
    labels: ['endpoint', 'method', 'status_code'],
  },
  'request.count': {
    name: 'expert_agent/request/count',
    description: 'Total request count',
    type: 'counter',
    unit: '1',
    labels: ['endpoint', 'method', 'status_code'],
  },
  'request.error': {
    name: 'expert_agent/request/error',
    description: 'Request error count',
    type: 'counter',
    unit: '1',
    labels: ['endpoint', 'error_type', 'status_code'],
  },

  // AI/Token metrics
  'ai.tokens.input': {
    name: 'expert_agent/ai/tokens/input',
    description: 'Input tokens consumed',
    type: 'counter',
    unit: '1',
    labels: ['agent_id', 'model'],
  },
  'ai.tokens.output': {
    name: 'expert_agent/ai/tokens/output',
    description: 'Output tokens generated',
    type: 'counter',
    unit: '1',
    labels: ['agent_id', 'model'],
  },
  'ai.latency': {
    name: 'expert_agent/ai/latency',
    description: 'AI call latency in milliseconds',
    type: 'histogram',
    unit: 'ms',
    labels: ['agent_id', 'model', 'success'],
  },
  'ai.error': {
    name: 'expert_agent/ai/error',
    description: 'AI call error count',
    type: 'counter',
    unit: '1',
    labels: ['agent_id', 'error_type'],
  },

  // Session metrics
  'session.active': {
    name: 'expert_agent/session/active',
    description: 'Currently active sessions',
    type: 'gauge',
    unit: '1',
    labels: ['org_id'],
  },
  'session.created': {
    name: 'expert_agent/session/created',
    description: 'Sessions created',
    type: 'counter',
    unit: '1',
    labels: ['org_id', 'agent_id'],
  },

  // Security metrics
  'security.blocked': {
    name: 'expert_agent/security/blocked',
    description: 'Blocked requests (security)',
    type: 'counter',
    unit: '1',
    labels: ['reason', 'severity'],
  },
  'security.pii_detected': {
    name: 'expert_agent/security/pii_detected',
    description: 'PII detection events',
    type: 'counter',
    unit: '1',
    labels: ['pii_type', 'direction', 'action'],
  },

  // Rate limiting metrics
  'rate_limit.exceeded': {
    name: 'expert_agent/rate_limit/exceeded',
    description: 'Rate limit exceeded events',
    type: 'counter',
    unit: '1',
    labels: ['tier', 'limit_type'],
  },

  // Cost metrics
  'cost.estimated': {
    name: 'expert_agent/cost/estimated',
    description: 'Estimated cost in USD cents',
    type: 'counter',
    unit: 'USD_cents',
    labels: ['user_id', 'org_id'],
  },

  // Query processing metrics
  'query.duration': {
    name: 'expert_agent/query/duration',
    description: 'Total query processing time',
    type: 'histogram',
    unit: 'ms',
    labels: ['agent_id', 'success'],
  },
  'query.file_count': {
    name: 'expert_agent/query/file_count',
    description: 'Files processed per query',
    type: 'histogram',
    unit: '1',
    labels: ['agent_id'],
  },
};

// =============================================================================
// Metrics Storage (In-Memory for Dev/Test)
// =============================================================================

/**
 * In-memory metrics storage
 * In production, this would push to Cloud Monitoring
 */
class MetricsStore {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, HistogramBuckets> = new Map();
  private recentValues: MetricValue[] = [];
  private maxRecentValues = 1000;

  /**
   * Default histogram boundaries (latency-focused, in ms)
   */
  private defaultBoundaries = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

  /**
   * Increment a counter
   */
  incrementCounter(name: string, value: number, labels: MetricLabels): void {
    const key = this.buildKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    this.recordValue(name, value, labels);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels: MetricLabels): void {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, value);
    this.recordValue(name, value, labels);
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number, labels: MetricLabels): void {
    const key = this.buildKey(name, labels);
    let histogram = this.histograms.get(key);

    if (!histogram) {
      histogram = {
        boundaries: [...this.defaultBoundaries],
        counts: new Array(this.defaultBoundaries.length + 1).fill(0),
        sum: 0,
        count: 0,
      };
      this.histograms.set(key, histogram);
    }

    // Find bucket
    const bucketIndex = histogram.boundaries.findIndex((b) => value <= b);
    const index = bucketIndex === -1 ? histogram.boundaries.length : bucketIndex;
    histogram.counts[index]++;
    histogram.sum += value;
    histogram.count++;

    this.recordValue(name, value, labels);
  }

  /**
   * Get counter value
   */
  getCounter(name: string, labels: MetricLabels): number {
    const key = this.buildKey(name, labels);
    return this.counters.get(key) || 0;
  }

  /**
   * Get gauge value
   */
  getGauge(name: string, labels: MetricLabels): number {
    const key = this.buildKey(name, labels);
    return this.gauges.get(key) || 0;
  }

  /**
   * Get histogram stats
   */
  getHistogram(name: string, labels: MetricLabels): HistogramBuckets | undefined {
    const key = this.buildKey(name, labels);
    return this.histograms.get(key);
  }

  /**
   * Get all counter values
   */
  getAllCounters(): Map<string, number> {
    return new Map(this.counters);
  }

  /**
   * Get all gauge values
   */
  getAllGauges(): Map<string, number> {
    return new Map(this.gauges);
  }

  /**
   * Get recent metric values
   */
  getRecentValues(limit = 100): MetricValue[] {
    return this.recentValues.slice(-limit);
  }

  /**
   * Clear all metrics (for testing)
   */
  clear(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.recentValues = [];
  }

  /**
   * Build a unique key for metric with labels
   */
  private buildKey(name: string, labels: MetricLabels): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  /**
   * Record a value for recent values list
   */
  private recordValue(name: string, value: number, labels: MetricLabels): void {
    this.recentValues.push({
      name,
      value,
      labels,
      timestamp: new Date(),
    });

    // Trim if over limit
    if (this.recentValues.length > this.maxRecentValues) {
      this.recentValues = this.recentValues.slice(-this.maxRecentValues);
    }
  }
}

// Global metrics store instance
const metricsStore = new MetricsStore();

// =============================================================================
// Metrics API
// =============================================================================

/**
 * Increment a counter metric
 */
export function incrementCounter(
  metricKey: keyof typeof METRIC_DEFINITIONS,
  value = 1,
  labels: MetricLabels = {}
): void {
  const definition = METRIC_DEFINITIONS[metricKey];
  if (!definition || definition.type !== 'counter') {
    console.warn(`[METRICS] Unknown or invalid counter metric: ${metricKey}`);
    return;
  }
  metricsStore.incrementCounter(definition.name, value, labels);
  emitToCloudMonitoring(definition, value, labels);
}

/**
 * Set a gauge metric value
 */
export function setGauge(
  metricKey: keyof typeof METRIC_DEFINITIONS,
  value: number,
  labels: MetricLabels = {}
): void {
  const definition = METRIC_DEFINITIONS[metricKey];
  if (!definition || definition.type !== 'gauge') {
    console.warn(`[METRICS] Unknown or invalid gauge metric: ${metricKey}`);
    return;
  }
  metricsStore.setGauge(definition.name, value, labels);
  emitToCloudMonitoring(definition, value, labels);
}

/**
 * Record a histogram metric value
 */
export function recordHistogram(
  metricKey: keyof typeof METRIC_DEFINITIONS,
  value: number,
  labels: MetricLabels = {}
): void {
  const definition = METRIC_DEFINITIONS[metricKey];
  if (!definition || definition.type !== 'histogram') {
    console.warn(`[METRICS] Unknown or invalid histogram metric: ${metricKey}`);
    return;
  }
  metricsStore.recordHistogram(definition.name, value, labels);
  emitToCloudMonitoring(definition, value, labels);
}

/**
 * Measure async operation duration and record to histogram
 */
export async function measureDuration<T>(
  metricKey: keyof typeof METRIC_DEFINITIONS,
  operation: () => Promise<T>,
  labels: MetricLabels = {}
): Promise<T> {
  const start = Date.now();
  try {
    const result = await operation();
    const duration = Date.now() - start;
    recordHistogram(metricKey, duration, { ...labels, success: 'true' });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    recordHistogram(metricKey, duration, { ...labels, success: 'false' });
    throw error;
  }
}

/**
 * Measure sync operation duration and record to histogram
 */
export function measureDurationSync<T>(
  metricKey: keyof typeof METRIC_DEFINITIONS,
  operation: () => T,
  labels: MetricLabels = {}
): T {
  const start = Date.now();
  try {
    const result = operation();
    const duration = Date.now() - start;
    recordHistogram(metricKey, duration, { ...labels, success: 'true' });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    recordHistogram(metricKey, duration, { ...labels, success: 'false' });
    throw error;
  }
}

// =============================================================================
// High-Level Metric Helpers
// =============================================================================

/**
 * Record a request (latency + count)
 */
export function recordRequest(
  endpoint: string,
  method: string,
  statusCode: number,
  durationMs: number
): void {
  const labels = { endpoint, method, status_code: String(statusCode) };
  recordHistogram('request.latency', durationMs, labels);
  incrementCounter('request.count', 1, labels);

  if (statusCode >= 400) {
    incrementCounter('request.error', 1, {
      endpoint,
      error_type: statusCode >= 500 ? 'server_error' : 'client_error',
      status_code: String(statusCode),
    });
  }
}

/**
 * Record AI token usage
 */
export function recordTokenUsage(
  agentId: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): void {
  incrementCounter('ai.tokens.input', inputTokens, { agent_id: agentId, model });
  incrementCounter('ai.tokens.output', outputTokens, { agent_id: agentId, model });
}

/**
 * Record AI call latency
 */
export function recordAILatency(
  agentId: string,
  model: string,
  durationMs: number,
  success: boolean
): void {
  recordHistogram('ai.latency', durationMs, {
    agent_id: agentId,
    model,
    success: String(success),
  });
}

/**
 * Record AI error
 */
export function recordAIError(agentId: string, errorType: string): void {
  incrementCounter('ai.error', 1, { agent_id: agentId, error_type: errorType });
}

/**
 * Record security block
 */
export function recordSecurityBlock(reason: string, severity: string): void {
  incrementCounter('security.blocked', 1, { reason, severity });
}

/**
 * Record PII detection
 */
export function recordPIIDetection(
  piiType: string,
  direction: 'input' | 'output',
  action: string
): void {
  incrementCounter('security.pii_detected', 1, { pii_type: piiType, direction, action });
}

/**
 * Record rate limit exceeded
 */
export function recordRateLimitExceeded(tier: string, limitType: string): void {
  incrementCounter('rate_limit.exceeded', 1, { tier, limit_type: limitType });
}

/**
 * Record estimated cost
 */
export function recordCost(userId: string, orgId: string, costCents: number): void {
  incrementCounter('cost.estimated', costCents, { user_id: userId, org_id: orgId });
}

/**
 * Record session creation
 */
export function recordSessionCreated(orgId: string, agentId: string): void {
  incrementCounter('session.created', 1, { org_id: orgId, agent_id: agentId });
}

/**
 * Set active session count
 */
export function setActiveSessionCount(orgId: string, count: number): void {
  setGauge('session.active', count, { org_id: orgId });
}

/**
 * Record query duration
 */
export function recordQueryDuration(
  agentId: string,
  durationMs: number,
  success: boolean
): void {
  recordHistogram('query.duration', durationMs, {
    agent_id: agentId,
    success: String(success),
  });
}

// =============================================================================
// Metrics Access (for testing and dashboards)
// =============================================================================

/**
 * Get a specific counter value
 */
export function getCounterValue(
  metricKey: keyof typeof METRIC_DEFINITIONS,
  labels: MetricLabels = {}
): number {
  const definition = METRIC_DEFINITIONS[metricKey];
  if (!definition) return 0;
  return metricsStore.getCounter(definition.name, labels);
}

/**
 * Get a specific gauge value
 */
export function getGaugeValue(
  metricKey: keyof typeof METRIC_DEFINITIONS,
  labels: MetricLabels = {}
): number {
  const definition = METRIC_DEFINITIONS[metricKey];
  if (!definition) return 0;
  return metricsStore.getGauge(definition.name, labels);
}

/**
 * Get histogram statistics
 */
export function getHistogramStats(
  metricKey: keyof typeof METRIC_DEFINITIONS,
  labels: MetricLabels = {}
): { count: number; sum: number; avg: number } | undefined {
  const definition = METRIC_DEFINITIONS[metricKey];
  if (!definition) return undefined;
  const histogram = metricsStore.getHistogram(definition.name, labels);
  if (!histogram) return undefined;
  return {
    count: histogram.count,
    sum: histogram.sum,
    avg: histogram.count > 0 ? histogram.sum / histogram.count : 0,
  };
}

/**
 * Get all metrics for dashboard/debugging
 */
export function getAllMetrics(): {
  counters: Map<string, number>;
  gauges: Map<string, number>;
  recentValues: MetricValue[];
} {
  return {
    counters: metricsStore.getAllCounters(),
    gauges: metricsStore.getAllGauges(),
    recentValues: metricsStore.getRecentValues(),
  };
}

/**
 * Clear all metrics (for testing)
 */
export function clearMetrics(): void {
  metricsStore.clear();
}

/**
 * Get metric definitions
 */
export function getMetricDefinitions(): typeof METRIC_DEFINITIONS {
  return { ...METRIC_DEFINITIONS };
}

// =============================================================================
// Cloud Monitoring Integration
// =============================================================================

/**
 * Emit metric to Cloud Monitoring
 * In production, this would use the Cloud Monitoring API
 * For now, we log in a structured format that Cloud Logging can parse
 */
function emitToCloudMonitoring(
  definition: MetricDefinition,
  value: number,
  labels: MetricLabels
): void {
  if (process.env.NODE_ENV === 'test') {
    return; // Skip in tests
  }

  // In production, emit to Cloud Monitoring API
  // For now, emit structured log that can be processed
  if (process.env.EMIT_METRICS_TO_LOG === 'true') {
    console.log(
      JSON.stringify({
        metricType: definition.name,
        metricKind: definition.type.toUpperCase(),
        value,
        labels,
        unit: definition.unit,
        timestamp: new Date().toISOString(),
      })
    );
  }
}
