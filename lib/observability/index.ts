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
