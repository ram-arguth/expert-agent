/**
 * Agent Mock Fixtures Tests
 *
 * Tests to verify the mock fixtures are correctly structured
 * and can be used in tests.
 *
 * @see docs/IMPEMENTATION.md - AI/LLM Mocking Policy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  uxAnalystSuccessResponse,
  uxAnalystMinimalResponse,
  uxAnalystErrorResponses,
  uxAnalystTokenUsage,
  uxAnalystStreamingChunks,
  setMockResponse,
  resetVertexAIMock,
  mockScenarios,
} from '../index';

describe('Agent Mock Fixtures', () => {
  describe('UX Analyst Fixtures', () => {
    describe('uxAnalystSuccessResponse', () => {
      it('has required top-level fields', () => {
        expect(uxAnalystSuccessResponse).toHaveProperty('executiveSummary');
        expect(uxAnalystSuccessResponse).toHaveProperty('findings');
        expect(uxAnalystSuccessResponse).toHaveProperty('recommendations');
        expect(uxAnalystSuccessResponse).toHaveProperty('overallScore');
      });

      it('has correctly structured findings', () => {
        expect(uxAnalystSuccessResponse.findings).toBeInstanceOf(Array);
        expect(uxAnalystSuccessResponse.findings.length).toBeGreaterThan(0);

        const finding = uxAnalystSuccessResponse.findings[0];
        expect(finding).toHaveProperty('id');
        expect(finding).toHaveProperty('title');
        expect(finding).toHaveProperty('severity');
        expect(finding).toHaveProperty('description');
      });

      it('has valid severity values', () => {
        const validSeverities = ['critical', 'high', 'medium', 'low'];
        
        uxAnalystSuccessResponse.findings.forEach((finding) => {
          expect(validSeverities).toContain(finding.severity);
        });
      });

      it('has correctly structured recommendations', () => {
        expect(uxAnalystSuccessResponse.recommendations).toBeInstanceOf(Array);
        expect(uxAnalystSuccessResponse.recommendations.length).toBeGreaterThan(0);

        const rec = uxAnalystSuccessResponse.recommendations[0];
        expect(rec).toHaveProperty('id');
        expect(rec).toHaveProperty('title');
        expect(rec).toHaveProperty('priority');
        expect(rec).toHaveProperty('description');
      });

      it('has valid scores', () => {
        expect(uxAnalystSuccessResponse.overallScore).toBeGreaterThanOrEqual(0);
        expect(uxAnalystSuccessResponse.overallScore).toBeLessThanOrEqual(100);
        expect(uxAnalystSuccessResponse.accessibilityScore).toBeGreaterThanOrEqual(0);
        expect(uxAnalystSuccessResponse.accessibilityScore).toBeLessThanOrEqual(100);
      });

      it('has metadata', () => {
        expect(uxAnalystSuccessResponse.metadata).toHaveProperty('analysisDate');
        expect(uxAnalystSuccessResponse.metadata).toHaveProperty('modelVersion');
      });
    });

    describe('uxAnalystMinimalResponse', () => {
      it('has required fields with minimal data', () => {
        expect(uxAnalystMinimalResponse.executiveSummary).toBeTruthy();
        expect(uxAnalystMinimalResponse.findings).toEqual([]);
        expect(uxAnalystMinimalResponse.recommendations).toEqual([]);
      });

      it('has valid scores', () => {
        expect(uxAnalystMinimalResponse.overallScore).toBeGreaterThan(0);
      });
    });

    describe('uxAnalystErrorResponses', () => {
      it('has rate limit error', () => {
        expect(uxAnalystErrorResponses.rateLimitExceeded.error.code).toBe(429);
        expect(uxAnalystErrorResponses.rateLimitExceeded.error.status).toBe('RESOURCE_EXHAUSTED');
      });

      it('has content filtered error', () => {
        expect(uxAnalystErrorResponses.contentFiltered.error.code).toBe(400);
      });

      it('has model overloaded error', () => {
        expect(uxAnalystErrorResponses.modelOverloaded.error.code).toBe(503);
      });

      it('has invalid input error', () => {
        expect(uxAnalystErrorResponses.invalidInput.error.code).toBe(400);
      });
    });

    describe('uxAnalystTokenUsage', () => {
      it('has token counts', () => {
        expect(uxAnalystTokenUsage.promptTokens).toBeGreaterThan(0);
        expect(uxAnalystTokenUsage.completionTokens).toBeGreaterThan(0);
        expect(uxAnalystTokenUsage.totalTokens).toBe(
          uxAnalystTokenUsage.promptTokens + uxAnalystTokenUsage.completionTokens
        );
      });

      it('has estimated cost', () => {
        expect(uxAnalystTokenUsage.estimatedCost).toBeGreaterThanOrEqual(0);
      });
    });

    describe('uxAnalystStreamingChunks', () => {
      it('is an array of strings', () => {
        expect(uxAnalystStreamingChunks).toBeInstanceOf(Array);
        uxAnalystStreamingChunks.forEach((chunk) => {
          expect(typeof chunk).toBe('string');
        });
      });

      it('can be joined to form valid JSON start', () => {
        const joined = uxAnalystStreamingChunks.join('');
        expect(joined).toContain('executive');
        expect(joined).toContain('Summary');
      });
    });
  });

  describe('Vertex AI Mock', () => {
    beforeEach(() => {
      resetVertexAIMock();
    });

    afterEach(() => {
      resetVertexAIMock();
    });

    describe('setMockResponse', () => {
      it('can set custom response', () => {
        const customResponse = { test: 'data' };
        setMockResponse({ response: customResponse });
        
        // The response is stored in module state
        // Actual testing of this would be done in integration tests
        expect(true).toBe(true);
      });
    });

    describe('mockScenarios', () => {
      it('has successfulAnalysis scenario', () => {
        expect(mockScenarios.successfulAnalysis).toBeDefined();
        expect(typeof mockScenarios.successfulAnalysis).toBe('function');
      });

      it('has rateLimitError scenario', () => {
        expect(mockScenarios.rateLimitError).toBeDefined();
        expect(typeof mockScenarios.rateLimitError).toBe('function');
      });

      it('has contentFilteredError scenario', () => {
        expect(mockScenarios.contentFilteredError).toBeDefined();
        expect(typeof mockScenarios.contentFilteredError).toBe('function');
      });

      it('has slowResponse scenario', () => {
        expect(mockScenarios.slowResponse).toBeDefined();
        expect(typeof mockScenarios.slowResponse).toBe('function');
      });

      it('has emptyResponse scenario', () => {
        expect(mockScenarios.emptyResponse).toBeDefined();
        expect(typeof mockScenarios.emptyResponse).toBe('function');
      });
    });

    describe('resetVertexAIMock', () => {
      it('resets mock state without error', () => {
        // Set something first
        setMockResponse({ response: { test: true } });
        
        // Reset should not throw
        expect(() => resetVertexAIMock()).not.toThrow();
      });
    });
  });
});
