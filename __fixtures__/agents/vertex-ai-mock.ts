/**
 * Vertex AI Mock Implementation
 *
 * Mock implementation for Vertex AI/Gemini client to avoid API costs in tests.
 * Use vitest.mock() to apply this mock in test files.
 *
 * @see docs/IMPEMENTATION.md - AI/LLM Mocking Policy
 *
 * Usage in tests:
 * ```typescript
 * import { mockVertexAI, resetVertexAIMock } from '@/__fixtures__/agents/vertex-ai-mock';
 *
 * beforeEach(() => {
 *   mockVertexAI();
 * });
 *
 * afterEach(() => {
 *   resetVertexAIMock();
 * });
 * ```
 */

import { vi } from 'vitest';
import { uxAnalystSuccessResponse, uxAnalystTokenUsage } from './ux-analyst';

/**
 * Mock response configuration
 */
interface MockConfig {
  /** Response to return (JSON stringified) */
  response?: unknown;
  /** Whether to simulate an error */
  shouldError?: boolean;
  /** Error to throw */
  error?: Error;
  /** Delay in ms to simulate network latency */
  delay?: number;
  /** Token usage to return */
  tokenUsage?: typeof uxAnalystTokenUsage;
}

// Global mock state
let mockConfig: MockConfig = {};

/**
 * Configure the mock response for the next call
 */
export function setMockResponse(config: MockConfig): void {
  mockConfig = config;
}

/**
 * Reset mock configuration to defaults
 */
export function resetVertexAIMock(): void {
  mockConfig = {};
}

/**
 * Create a mock GenerativeModel that returns configured responses
 */
function createMockGenerativeModel() {
  return {
    generateContent: vi.fn().mockImplementation(async () => {
      // Simulate network delay
      if (mockConfig.delay) {
        await new Promise((resolve) => setTimeout(resolve, mockConfig.delay));
      }

      // Simulate error
      if (mockConfig.shouldError && mockConfig.error) {
        throw mockConfig.error;
      }

      // Return configured response or default
      const response = mockConfig.response ?? uxAnalystSuccessResponse;
      const tokenUsage = mockConfig.tokenUsage ?? uxAnalystTokenUsage;

      return {
        response: {
          text: () => JSON.stringify(response),
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(response) }],
                role: 'model',
              },
              finishReason: 'STOP',
              safetyRatings: [],
            },
          ],
          usageMetadata: {
            promptTokenCount: tokenUsage.promptTokens,
            candidatesTokenCount: tokenUsage.completionTokens,
            totalTokenCount: tokenUsage.totalTokens,
          },
        },
      };
    }),
    generateContentStream: vi.fn().mockImplementation(async function* () {
      // Simulate streaming chunks
      const response = mockConfig.response ?? uxAnalystSuccessResponse;
      const text = JSON.stringify(response);
      const chunkSize = 50;

      for (let i = 0; i < text.length; i += chunkSize) {
        yield {
          text: () => text.slice(i, i + chunkSize),
        };
      }
    }),
  };
}

/**
 * Create a mock VertexAI client
 */
function createMockVertexAI() {
  return {
    getGenerativeModel: vi.fn().mockReturnValue(createMockGenerativeModel()),
  };
}

/**
 * Mock the Vertex AI module
 * Call this in beforeEach() or at the top of your test file
 */
export function mockVertexAI(): void {
  vi.mock('@google-cloud/vertexai', () => ({
    VertexAI: vi.fn().mockImplementation(() => createMockVertexAI()),
    HarmCategory: {
      HARM_CATEGORY_UNSPECIFIED: 'HARM_CATEGORY_UNSPECIFIED',
      HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
      HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
      HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    },
    HarmBlockThreshold: {
      BLOCK_NONE: 'BLOCK_NONE',
      BLOCK_LOW_AND_ABOVE: 'BLOCK_LOW_AND_ABOVE',
      BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE',
      BLOCK_ONLY_HIGH: 'BLOCK_ONLY_HIGH',
    },
  }));
}

/**
 * Create mock for specific test scenarios
 */
export const mockScenarios = {
  /**
   * Mock successful UX analysis
   */
  successfulAnalysis: () => {
    setMockResponse({
      response: uxAnalystSuccessResponse,
      tokenUsage: uxAnalystTokenUsage,
    });
  },

  /**
   * Mock rate limit error
   */
  rateLimitError: () => {
    setMockResponse({
      shouldError: true,
      error: new Error('RESOURCE_EXHAUSTED: Quota exceeded'),
    });
  },

  /**
   * Mock content filtered error
   */
  contentFilteredError: () => {
    setMockResponse({
      shouldError: true,
      error: new Error('INVALID_ARGUMENT: Content was blocked due to safety filters'),
    });
  },

  /**
   * Mock slow response (for timeout tests)
   */
  slowResponse: (delayMs = 5000) => {
    setMockResponse({
      response: uxAnalystSuccessResponse,
      delay: delayMs,
    });
  },

  /**
   * Mock empty response
   */
  emptyResponse: () => {
    setMockResponse({
      response: {
        executiveSummary: '',
        findings: [],
        recommendations: [],
        overallScore: 0,
      },
    });
  },
};

/**
 * Default export for easy mocking
 */
export default {
  mockVertexAI,
  resetVertexAIMock,
  setMockResponse,
  mockScenarios,
};
