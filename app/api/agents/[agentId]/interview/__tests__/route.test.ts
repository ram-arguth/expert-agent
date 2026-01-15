/**
 * Guided Interview API Tests
 *
 * Tests for the multi-turn context gathering API:
 * - Session management
 * - Question progression
 * - Answer validation
 * - Progress tracking
 * - Error handling
 * - Security
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';

// Mock dependencies
let mockUserId = 'test-user-123';

vi.mock('@/auth', () => ({
  auth: vi.fn(() => Promise.resolve({
    user: { id: mockUserId, email: 'test@example.com' },
  })),
}));

vi.mock('@/lib/observability', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Helper to create request
function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/agents/ux-analyst/interview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createParams(agentId: string) {
  return { params: Promise.resolve({ agentId }) };
}

describe('Guided Interview API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserId = 'test-user-123';
  });

  describe('GET /api/agents/[agentId]/interview', () => {
    it('returns interview config for supported agent', async () => {
      const request = new NextRequest('http://localhost/api/agents/ux-analyst/interview');
      const response = await GET(request, createParams('ux-analyst'));
      const data = await response.json();

      expect(data.supported).toBe(true);
      expect(data.agentId).toBe('ux-analyst');
      expect(data.totalSteps).toBeGreaterThan(0);
      expect(data.steps).toBeInstanceOf(Array);
    });

    it('returns supported=false for unsupported agent', async () => {
      const request = new NextRequest('http://localhost/api/agents/unknown-agent/interview');
      const response = await GET(request, createParams('unknown-agent'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.supported).toBe(false);
    });

    it('returns step metadata for each question', async () => {
      const request = new NextRequest('http://localhost/api/agents/legal-advisor/interview');
      const response = await GET(request, createParams('legal-advisor'));
      const data = await response.json();

      data.steps.forEach((step: { id: string; question: string; type: string; required: boolean }) => {
        expect(step.id).toBeDefined();
        expect(step.question).toBeDefined();
        expect(step.type).toBeDefined();
        expect(typeof step.required).toBe('boolean');
      });
    });
  });

  describe('POST /api/agents/[agentId]/interview - Session Start', () => {
    it('creates new session when no sessionId provided', async () => {
      const request = createRequest({});
      const response = await POST(request, createParams('ux-analyst'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionId).toBeDefined();
      expect(data.sessionId).toMatch(/^interview-/);
      expect(data.currentStep).toBe(1);
      expect(data.progress).toBe(0);
      expect(data.isComplete).toBe(false);
    });

    it('returns first question on new session', async () => {
      const request = createRequest({});
      const response = await POST(request, createParams('ux-analyst'));
      const data = await response.json();

      expect(data.currentQuestion).toBeDefined();
      expect(data.currentQuestion.question).toBeDefined();
      expect(data.currentQuestion.type).toBeDefined();
    });

    it('returns error for unsupported agent', async () => {
      const request = createRequest({});
      const response = await POST(request, createParams('unknown-agent'));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('does not support');
    });
  });

  describe('POST /api/agents/[agentId]/interview - Answer Processing', () => {
    it('accepts valid answer and advances to next question', async () => {
      // Start session
      const startRequest = createRequest({});
      const startResponse = await POST(startRequest, createParams('ux-analyst'));
      const startData = await startResponse.json();
      const sessionId = startData.sessionId;

      // Answer first question
      const answerRequest = createRequest({
        sessionId,
        answer: 'web-app',
      });
      const answerResponse = await POST(answerRequest, createParams('ux-analyst'));
      const answerData = await answerResponse.json();

      expect(answerResponse.status).toBe(200);
      expect(answerData.currentStep).toBe(2);
      expect(answerData.answers).toHaveProperty('product-type', 'web-app');
    });

    it('validates minimum length requirement', async () => {
      // Start session
      const startRequest = createRequest({});
      const startResponse = await POST(startRequest, createParams('ux-analyst'));
      const startData = await startResponse.json();

      // Answer first question
      const answer1Request = createRequest({
        sessionId: startData.sessionId,
        answer: 'web-app',
      });
      await POST(answer1Request, createParams('ux-analyst'));

      // Try to answer second question with too short answer
      const answer2Request = createRequest({
        sessionId: startData.sessionId,
        answer: 'short',  // Less than 10 chars
      });
      const answer2Response = await POST(answer2Request, createParams('ux-analyst'));

      expect(answer2Response.status).toBe(400);
      const data = await answer2Response.json();
      expect(data.error).toContain('at least');
    });

    it('rejects empty answer for required question', async () => {
      const startRequest = createRequest({});
      const startResponse = await POST(startRequest, createParams('ux-analyst'));
      const startData = await startResponse.json();

      const answerRequest = createRequest({
        sessionId: startData.sessionId,
        answer: '',
      });
      const answerResponse = await POST(answerRequest, createParams('ux-analyst'));

      expect(answerResponse.status).toBe(400);
      const data = await answerResponse.json();
      expect(data.error).toContain('required');
    });
  });

  describe('POST /api/agents/[agentId]/interview - Skip Question', () => {
    it('allows skipping optional questions', async () => {
      // Start session and answer required questions first
      const startRequest = createRequest({});
      const startResponse = await POST(startRequest, createParams('ux-analyst'));
      const { sessionId } = await startResponse.json();

      // Answer first 3 required questions
      await POST(createRequest({ sessionId, answer: 'web-app' }), createParams('ux-analyst'));
      await POST(createRequest({ sessionId, answer: 'Tech-savvy developers building SaaS products' }), createParams('ux-analyst'));
      await POST(createRequest({ sessionId, answer: 'Complete a complex workflow with multiple steps' }), createParams('ux-analyst'));

      // Now at optional question - skip it
      const skipRequest = createRequest({
        sessionId,
        skipQuestion: true,
      });
      const skipResponse = await POST(skipRequest, createParams('ux-analyst'));
      const data = await skipResponse.json();

      expect(skipResponse.status).toBe(200);
      expect(data.currentStep).toBe(5); // Advanced past the skipped question
    });

    it('rejects skipping required questions', async () => {
      const startRequest = createRequest({});
      const startResponse = await POST(startRequest, createParams('ux-analyst'));
      const { sessionId } = await startResponse.json();

      const skipRequest = createRequest({
        sessionId,
        skipQuestion: true,
      });
      const skipResponse = await POST(skipRequest, createParams('ux-analyst'));

      expect(skipResponse.status).toBe(400);
      const data = await skipResponse.json();
      expect(data.error).toContain('Cannot skip required');
    });
  });

  describe('POST /api/agents/[agentId]/interview - Progress Tracking', () => {
    it('tracks progress as percentage', async () => {
      const startRequest = createRequest({});
      const startResponse = await POST(startRequest, createParams('ux-analyst'));
      const startData = await startResponse.json();

      expect(startData.progress).toBe(0);
      expect(startData.totalSteps).toBeGreaterThan(0);

      // Answer first question
      const answerRequest = createRequest({
        sessionId: startData.sessionId,
        answer: 'web-app',
      });
      const answerResponse = await POST(answerRequest, createParams('ux-analyst'));
      const answerData = await answerResponse.json();

      expect(answerData.progress).toBeGreaterThan(0);
      expect(answerData.progress).toBeLessThanOrEqual(100);
    });

    it('sets canStartAnalysis when all required answered', async () => {
      const startRequest = createRequest({});
      const startResponse = await POST(startRequest, createParams('ux-analyst'));
      const { sessionId, canStartAnalysis } = await startResponse.json();

      expect(canStartAnalysis).toBe(false);

      // Answer required questions
      await POST(createRequest({ sessionId, answer: 'web-app' }), createParams('ux-analyst'));
      await POST(createRequest({ sessionId, answer: 'Tech-savvy developers building SaaS products' }), createParams('ux-analyst'));
      
      const response = await POST(createRequest({ sessionId, answer: 'Complete a complex workflow with multiple steps' }), createParams('ux-analyst'));
      const data = await response.json();

      expect(data.canStartAnalysis).toBe(true);
    });

    it('marks isComplete when all questions answered', async () => {
      const startRequest = createRequest({});
      const startResponse = await POST(startRequest, createParams('ux-analyst'));
      const { sessionId } = await startResponse.json();

      // Answer all questions
      await POST(createRequest({ sessionId, answer: 'web-app' }), createParams('ux-analyst'));
      await POST(createRequest({ sessionId, answer: 'Tech-savvy developers building SaaS products' }), createParams('ux-analyst'));
      await POST(createRequest({ sessionId, answer: 'Complete a complex workflow with multiple steps' }), createParams('ux-analyst'));
      await POST(createRequest({ sessionId, answer: 'High cart abandonment rate' }), createParams('ux-analyst'));
      
      const finalResponse = await POST(createRequest({ sessionId, answer: 'true' }), createParams('ux-analyst'));
      const data = await finalResponse.json();

      expect(data.isComplete).toBe(true);
      expect(data.progress).toBe(100);
      expect(data.currentQuestion).toBeNull();
      expect(data.nextAction).toBe('complete');
    });
  });

  describe('POST /api/agents/[agentId]/interview - Session Management', () => {
    it('returns 404 for unknown session', async () => {
      const request = createRequest({
        sessionId: 'interview-nonexistent-123',
        answer: 'test',
      });
      const response = await POST(request, createParams('ux-analyst'));

      expect(response.status).toBe(404);
    });

    it('returns 403 when accessing another users session', async () => {
      // Create session as user 1
      mockUserId = 'user-1';
      const startRequest = createRequest({});
      const startResponse = await POST(startRequest, createParams('ux-analyst'));
      const { sessionId } = await startResponse.json();

      // Try to access as user 2
      mockUserId = 'user-2';
      const answerRequest = createRequest({
        sessionId,
        answer: 'web-app',
      });
      const answerResponse = await POST(answerRequest, createParams('ux-analyst'));

      expect(answerResponse.status).toBe(403);
    });

    it('preserves answers across requests', async () => {
      const startRequest = createRequest({});
      const startResponse = await POST(startRequest, createParams('ux-analyst'));
      const { sessionId } = await startResponse.json();

      // Answer first question
      await POST(createRequest({ sessionId, answer: 'web-app' }), createParams('ux-analyst'));

      // Answer second question
      const response = await POST(
        createRequest({ sessionId, answer: 'Tech-savvy developers building SaaS products' }),
        createParams('ux-analyst')
      );
      const data = await response.json();

      expect(data.answers).toHaveProperty('product-type', 'web-app');
      expect(data.answers).toHaveProperty('target-audience', 'Tech-savvy developers building SaaS products');
    });
  });

  describe('POST /api/agents/[agentId]/interview - Authentication', () => {
    it('requires authentication', async () => {
      const { auth } = await import('@/auth');
      // @ts-expect-error - Mock return type
      vi.mocked(auth).mockResolvedValueOnce(null as unknown);

      const request = createRequest({});
      const response = await POST(request, createParams('ux-analyst'));

      expect(response.status).toBe(401);
    });
  });

  describe('Agent-Specific Configurations', () => {
    it('has unique interview config for legal-advisor', async () => {
      const request = createRequest({});
      const response = await POST(request, createParams('legal-advisor'));
      const data = await response.json();

      expect(data.currentQuestion.id).toBe('jurisdiction');
      expect(data.currentQuestion.type).toBe('select');
    });

    it('has unique interview config for finance-planner', async () => {
      const request = createRequest({});
      const response = await POST(request, createParams('finance-planner'));
      const data = await response.json();

      expect(data.currentQuestion.id).toBe('service-type');
    });
  });

  describe('Response Structure', () => {
    it('returns complete response structure', async () => {
      const request = createRequest({});
      const response = await POST(request, createParams('ux-analyst'));
      const data = await response.json();

      expect(data).toHaveProperty('sessionId');
      expect(data).toHaveProperty('currentStep');
      expect(data).toHaveProperty('totalSteps');
      expect(data).toHaveProperty('progress');
      expect(data).toHaveProperty('isComplete');
      expect(data).toHaveProperty('currentQuestion');
      expect(data).toHaveProperty('canStartAnalysis');
      expect(data).toHaveProperty('nextAction');
    });

    it('current question has proper structure', async () => {
      const request = createRequest({});
      const response = await POST(request, createParams('ux-analyst'));
      const data = await response.json();

      const q = data.currentQuestion;
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('question');
      expect(q).toHaveProperty('type');
      expect(q).toHaveProperty('required');
    });
  });
});
