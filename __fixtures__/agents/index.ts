/**
 * Agent Fixtures Index
 *
 * Central export for all agent mock fixtures
 *
 * @see docs/IMPEMENTATION.md - AI/LLM Mocking Policy
 */

// UX Analyst fixtures
export {
  uxAnalystSuccessResponse,
  uxAnalystMinimalResponse,
  uxAnalystErrorResponses,
  uxAnalystTokenUsage,
  uxAnalystStreamingChunks,
} from './ux-analyst';

// Vertex AI mocks
export {
  mockVertexAI,
  resetVertexAIMock,
  setMockResponse,
  mockScenarios,
} from './vertex-ai-mock';
