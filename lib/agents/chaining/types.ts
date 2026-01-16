/**
 * Multi-Agent Chaining Types
 *
 * Type definitions for agent chaining capabilities.
 * Enables Agent A's output to feed into Agent B's input.
 *
 * @see docs/DESIGN.md - Multi-Agent Chaining section
 * @see docs/IMPLEMENTATION.md - Phase 2.7
 */

import { z } from "zod";

// =============================================================================
// Agent Chaining Configuration
// =============================================================================

/**
 * Defines how one agent can chain to another.
 */
export interface AgentChainConfig {
  /** Target agent ID that this agent can chain to */
  targetAgentId: string;

  /** Human-readable description of this chain */
  description: string;

  /** Mapper function name (e.g., 'ux-to-risk', 'legal-to-finance') */
  mapperId: string;

  /** Whether user confirmation is required before chaining */
  requiresConfirmation?: boolean;
}

/**
 * Extended agent config with chaining support
 */
export interface ChainableAgentConfig {
  id: string;
  displayName: string;
  description: string;
  category: string;
  iconUrl?: string;
  isBeta: boolean;
  isPublic: boolean;
  supportsGuidedInterview?: boolean;
  supportsFileUpload?: boolean;
  supportsStreaming?: boolean;

  /**
   * Whether this agent supports chaining to other agents
   */
  chainable: boolean;

  /**
   * List of agents this agent can chain to
   */
  chainTargets?: AgentChainConfig[];
}

// =============================================================================
// Chain Execution Types
// =============================================================================

/**
 * Request to execute an agent chain
 */
export const ChainExecutionRequestSchema = z.object({
  /** Initial input for the first agent */
  input: z.record(z.unknown()),

  /** Ordered list of agent IDs to execute */
  agentChain: z.array(z.string()).min(2),

  /** Optional session ID to continue from */
  sessionId: z.string().optional(),

  /** Whether to stop on first error (default: true) */
  stopOnError: z.boolean().default(true),

  /** Optional org context for shared context files */
  orgId: z.string().optional(),
});

export type ChainExecutionRequest = z.infer<typeof ChainExecutionRequestSchema>;

/**
 * Result from a single agent in the chain
 */
export interface ChainStepResult {
  /** Agent ID that executed this step */
  agentId: string;

  /** Whether this step succeeded */
  success: boolean;

  /** The output from this agent (if successful) */
  output?: Record<string, unknown>;

  /** Error message (if failed) */
  error?: string;

  /** Execution time in milliseconds */
  durationMs: number;

  /** Token usage for this step */
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
}

/**
 * Complete chain execution result
 */
export interface ChainExecutionResult {
  /** Unique chain execution ID */
  chainId: string;

  /** Overall success status (all steps succeeded) */
  success: boolean;

  /** Results from each step in order */
  steps: ChainStepResult[];

  /** Final output from the last successful agent */
  finalOutput?: Record<string, unknown>;

  /** Rendered Markdown of final output (if available) */
  finalMarkdown?: string;

  /** Total execution time in milliseconds */
  totalDurationMs: number;

  /** Aggregate token usage */
  totalTokenUsage: {
    input: number;
    output: number;
    total: number;
  };
}

// =============================================================================
// Mapper Types
// =============================================================================

/**
 * A mapper transforms one agent's output to another agent's input
 */
export interface AgentMapper<
  TInput = Record<string, unknown>,
  TOutput = Record<string, unknown>,
> {
  /** Unique mapper ID (e.g., 'ux-to-legal') */
  id: string;

  /** Source agent ID */
  sourceAgentId: string;

  /** Target agent ID */
  targetAgentId: string;

  /** Human-readable description */
  description: string;

  /** The mapping function */
  map: (input: TInput) => TOutput;

  /** Whether this mapping is lossy (some data is not transferred) */
  isLossy?: boolean;
}

/**
 * Registry of all available mappers
 */
export interface MapperRegistry {
  /** Get a mapper by ID */
  get(mapperId: string): AgentMapper | undefined;

  /** Get mapper for source -> target pair */
  getForAgents(
    sourceAgentId: string,
    targetAgentId: string,
  ): AgentMapper | undefined;

  /** List all available mappers */
  list(): AgentMapper[];

  /** Check if a chain path is valid */
  isValidChain(agentIds: string[]): boolean;
}

// =============================================================================
// Chain Validation
// =============================================================================

/**
 * Validation result for a chain request
 */
export interface ChainValidationResult {
  /** Whether the chain is valid */
  valid: boolean;

  /** Validation errors (if any) */
  errors: ChainValidationError[];

  /** Warnings (chain can still execute) */
  warnings: string[];
}

export interface ChainValidationError {
  /** Step index where the error occurred */
  stepIndex: number;

  /** Source agent ID */
  sourceAgentId: string;

  /** Target agent ID */
  targetAgentId: string;

  /** Error message */
  message: string;
}
