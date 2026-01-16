/**
 * Multi-Agent Chaining Module
 *
 * Exports all types and utilities for multi-agent chaining.
 *
 * @see docs/DESIGN.md - Multi-Agent Chaining section
 * @see docs/IMPLEMENTATION.md - Phase 2.7
 */

// Types
export type {
  AgentChainConfig,
  ChainableAgentConfig,
  ChainExecutionRequest,
  ChainStepResult,
  ChainExecutionResult,
  AgentMapper,
  MapperRegistry,
  ChainValidationResult,
  ChainValidationError,
} from "./types";

export { ChainExecutionRequestSchema } from "./types";

// Mapper Registry
export {
  mapperRegistry,
  createMapperRegistry,
  getChainTargets,
  getChainSources,
} from "./mapper-registry";
