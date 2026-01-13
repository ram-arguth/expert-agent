/**
 * Sessions API Tests
 *
 * Unit tests for GET /api/sessions and GET/DELETE /api/sessions/[sessionId]
 *
 * @see docs/IMPEMENTATION.md - Phase 3.4 Session APIs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    session: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock Cedar
vi.mock('@/lib/authz/cedar', () => ({
  getCedarEngine: vi.fn(() => ({
    isAuthorized: vi.fn(() => ({ isAuthorized: true })),
  })),
  CedarActions: {
    ListSessions: 'ListSessions',
    GetSession: 'GetSession',
    DeleteSession: 'DeleteSession',
    CreateSession: 'CreateSession',
  },
}));

import { GET as listSessions } from '../route';
import { GET as getSession, DELETE as deleteSession } from '../[sessionId]/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getCedarEngine } from '@/lib/authz/cedar';

// Test data
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
};

const mockSessions = [
  {
    id: 'session-1',
    userId: 'user-123',
    agentId: 'ux-analyst',
    createdAt: new Date('2026-01-10T10:00:00Z'),
    updatedAt: new Date('2026-01-12T15:30:00Z'),
    archived: false,
    summaryUrl: null,
    messages: [
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Here is my analysis of your design...',
        createdAt: new Date('2026-01-12T15:30:00Z'),
      },
    ],
    _count: { messages: 5 },
  },
  {
    id: 'session-2',
    userId: 'user-123',
    agentId: 'legal-advisor',
    createdAt: new Date('2026-01-08T09:00:00Z'),
    updatedAt: new Date('2026-01-08T10:00:00Z'),
    archived: false,
    summaryUrl: null,
    messages: [
      {
        id: 'msg-2',
        role: 'user',
        content: 'Please review this contract',
        createdAt: new Date('2026-01-08T10:00:00Z'),
      },
    ],
    _count: { messages: 2 },
  },
];

const mockSessionDetail = {
  id: 'session-1',
  userId: 'user-123',
  agentId: 'ux-analyst',
  createdAt: new Date('2026-01-10T10:00:00Z'),
  updatedAt: new Date('2026-01-12T15:30:00Z'),
  archived: false,
  summaryUrl: null,
  messages: [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Analyze this screenshot',
      jsonData: null,
      inputTokens: 100,
      outputTokens: 0,
      createdAt: new Date('2026-01-12T15:00:00Z'),
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'Here is my analysis...',
      jsonData: { summary: 'Good design' },
      inputTokens: 0,
      outputTokens: 500,
      createdAt: new Date('2026-01-12T15:30:00Z'),
    },
  ],
};

describe('Sessions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({
      user: mockUser,
      expires: new Date(Date.now() + 3600000).toISOString(),
    });
    vi.mocked(getCedarEngine).mockReturnValue({
      isAuthorized: vi.fn(() => ({ isAuthorized: true })),
    } as ReturnType<typeof getCedarEngine>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/sessions', () => {
    it('returns 401 for unauthenticated requests', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/sessions');
      const response = await listSessions(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 403 when Cedar denies access', async () => {
      vi.mocked(getCedarEngine).mockReturnValueOnce({
        isAuthorized: vi.fn(() => ({ isAuthorized: false })),
      } as ReturnType<typeof getCedarEngine>);

      const request = new NextRequest('http://localhost:3000/api/sessions');
      const response = await listSessions(request);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
    });

    it('returns paginated sessions list', async () => {
      vi.mocked(prisma.session.findMany).mockResolvedValueOnce(mockSessions);

      const request = new NextRequest('http://localhost:3000/api/sessions');
      const response = await listSessions(request);

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.sessions).toHaveLength(2);
      expect(body.sessions[0].id).toBe('session-1');
      expect(body.sessions[0].agentName).toBe('UX Analyst');
      expect(body.sessions[0].messageCount).toBe(5);
      expect(body.sessions[0].lastMessage).toBeDefined();
      expect(body.pagination.hasMore).toBe(false);
    });

    it('filters sessions by agentId', async () => {
      vi.mocked(prisma.session.findMany).mockResolvedValueOnce([mockSessions[0]]);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions?agentId=ux-analyst'
      );
      const response = await listSessions(request);

      expect(response.status).toBe(200);
      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            agentId: 'ux-analyst',
          }),
        })
      );
    });

    it('respects limit parameter', async () => {
      vi.mocked(prisma.session.findMany).mockResolvedValueOnce([mockSessions[0]]);

      const request = new NextRequest('http://localhost:3000/api/sessions?limit=1');
      await listSessions(request);

      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 2, // limit + 1 for pagination check
        })
      );
    });

    it('supports cursor-based pagination', async () => {
      vi.mocked(prisma.session.findMany).mockResolvedValueOnce([mockSessions[1]]);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions?cursor=550e8400-e29b-41d4-a716-446655440000'
      );
      await listSessions(request);

      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { lt: '550e8400-e29b-41d4-a716-446655440000' },
          }),
        })
      );
    });

    it('returns 400 for invalid cursor format', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/sessions?cursor=invalid-cursor'
      );
      const response = await listSessions(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation Error');
    });

    it('truncates long message previews', async () => {
      const longMessageSession = {
        ...mockSessions[0],
        messages: [
          {
            id: 'msg-1',
            role: 'assistant',
            content: 'A'.repeat(200), // 200 char message
            createdAt: new Date(),
          },
        ],
      };

      vi.mocked(prisma.session.findMany).mockResolvedValueOnce([longMessageSession]);

      const request = new NextRequest('http://localhost:3000/api/sessions');
      const response = await listSessions(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.sessions[0].lastMessage.preview.length).toBeLessThanOrEqual(153); // 150 + '...'
    });

    it('handles database errors gracefully', async () => {
      vi.mocked(prisma.session.findMany).mockRejectedValueOnce(
        new Error('DB connection failed')
      );

      const request = new NextRequest('http://localhost:3000/api/sessions');
      const response = await listSessions(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Internal Server Error');
      // Should not expose internal error details
      expect(body.message).not.toContain('DB connection');
    });
  });

  describe('GET /api/sessions/[sessionId]', () => {
    const createParams = (sessionId: string) => ({
      params: Promise.resolve({ sessionId }),
    });

    it('returns 401 for unauthenticated requests', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/550e8400-e29b-41d4-a716-446655440000'
      );
      const response = await getSession(
        request,
        createParams('550e8400-e29b-41d4-a716-446655440000')
      );

      expect(response.status).toBe(401);
    });

    it('returns 400 for invalid session ID format', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/sessions/invalid-format'
      );
      const response = await getSession(request, createParams('invalid-format'));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Invalid Session ID');
    });

    it('returns 404 for non-existent session', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValueOnce(null);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/550e8400-e29b-41d4-a716-446655440000'
      );
      const response = await getSession(
        request,
        createParams('550e8400-e29b-41d4-a716-446655440000')
      );

      expect(response.status).toBe(404);
    });

    it('returns 403 when Cedar denies access', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValueOnce(mockSessionDetail);
      vi.mocked(getCedarEngine).mockReturnValueOnce({
        isAuthorized: vi.fn(() => ({ isAuthorized: false })),
      } as ReturnType<typeof getCedarEngine>);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/550e8400-e29b-41d4-a716-446655440000'
      );
      const response = await getSession(
        request,
        createParams('550e8400-e29b-41d4-a716-446655440000')
      );

      expect(response.status).toBe(403);
    });

    it('returns full session with message history', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValueOnce(mockSessionDetail);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/550e8400-e29b-41d4-a716-446655440000'
      );
      const response = await getSession(
        request,
        createParams('550e8400-e29b-41d4-a716-446655440000')
      );

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.id).toBe('session-1');
      expect(body.agentId).toBe('ux-analyst');
      expect(body.agentName).toBe('UX Analyst');
      expect(body.messages).toHaveLength(2);
      expect(body.usage.totalInputTokens).toBe(100);
      expect(body.usage.totalOutputTokens).toBe(500);
      expect(body.usage.totalTokens).toBe(600);
    });

    it('includes structured data in message response', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValueOnce(mockSessionDetail);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/550e8400-e29b-41d4-a716-446655440000'
      );
      const response = await getSession(
        request,
        createParams('550e8400-e29b-41d4-a716-446655440000')
      );

      const body = await response.json();
      expect(body.messages[1].structuredData).toEqual({ summary: 'Good design' });
    });

    // Security test: prevents cross-user session access
    it('enforces user ownership in query', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValueOnce(null);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/550e8400-e29b-41d4-a716-446655440000'
      );
      await getSession(
        request,
        createParams('550e8400-e29b-41d4-a716-446655440000')
      );

      // Verify that the query includes userId filter (defense in depth)
      expect(prisma.session.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123', // Current user
          }),
        })
      );
    });
  });

  describe('DELETE /api/sessions/[sessionId]', () => {
    const createParams = (sessionId: string) => ({
      params: Promise.resolve({ sessionId }),
    });

    it('returns 401 for unauthenticated requests', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/550e8400-e29b-41d4-a716-446655440000',
        { method: 'DELETE' }
      );
      const response = await deleteSession(
        request,
        createParams('550e8400-e29b-41d4-a716-446655440000')
      );

      expect(response.status).toBe(401);
    });

    it('returns 404 for non-existent session', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValueOnce(null);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/550e8400-e29b-41d4-a716-446655440000',
        { method: 'DELETE' }
      );
      const response = await deleteSession(
        request,
        createParams('550e8400-e29b-41d4-a716-446655440000')
      );

      expect(response.status).toBe(404);
    });

    it('returns 403 when Cedar denies access', async () => {
      // First mock: session exists
      vi.mocked(prisma.session.findFirst).mockResolvedValueOnce({
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-123',
        agentId: 'ux-analyst',
        createdAt: new Date(),
        updatedAt: new Date(),
        archived: false,
        summaryUrl: null,
        orgId: null,
        vertexSessionId: null,
      } as never);
      
      // Second mock: Cedar denies (use mockReturnValueOnce to override just for this call)
      vi.mocked(getCedarEngine).mockReturnValueOnce({
        isAuthorized: vi.fn(() => ({ isAuthorized: false })),
        policies: [],
        loadDefaultPolicies: vi.fn(),
        addPolicy: vi.fn(),
      } as unknown as ReturnType<typeof getCedarEngine>);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/550e8400-e29b-41d4-a716-446655440000',
        { method: 'DELETE' }
      );
      const response = await deleteSession(
        request,
        createParams('550e8400-e29b-41d4-a716-446655440000')
      );

      expect(response.status).toBe(403);
    });

    it('soft-deletes session (marks as archived)', async () => {
      // Reset Cedar mock to authorized
      vi.mocked(getCedarEngine).mockReturnValue({
        isAuthorized: vi.fn(() => ({ isAuthorized: true })),
        policies: [],
        loadDefaultPolicies: vi.fn(),
        addPolicy: vi.fn(),
      } as unknown as ReturnType<typeof getCedarEngine>);

      vi.mocked(prisma.session.findFirst).mockResolvedValueOnce({
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-123',
        agentId: 'ux-analyst',
        createdAt: new Date(),
        updatedAt: new Date(),
        archived: false,
        summaryUrl: null,
      } as never);
      vi.mocked(prisma.session.update).mockResolvedValueOnce({} as never);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/550e8400-e29b-41d4-a716-446655440000',
        { method: 'DELETE' }
      );
      const response = await deleteSession(
        request,
        createParams('550e8400-e29b-41d4-a716-446655440000')
      );

      expect(response.status).toBe(200);
      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000' },
        data: { archived: true },
      });
    });

    // Security test: prevents deleting other users' sessions
    it('enforces user ownership before delete', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValueOnce(null);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/550e8400-e29b-41d4-a716-446655440000',
        { method: 'DELETE' }
      );
      await deleteSession(
        request,
        createParams('550e8400-e29b-41d4-a716-446655440000')
      );

      // Verify that the query includes userId filter
      expect(prisma.session.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
          }),
        })
      );
    });
  });

  describe('Security Tests', () => {
    const createParams = (sessionId: string) => ({
      params: Promise.resolve({ sessionId }),
    });

    it('does not expose internal error details', async () => {
      vi.mocked(prisma.session.findMany).mockRejectedValueOnce(
        new Error('PostgreSQL: relation "sessions" does not exist')
      );

      const request = new NextRequest('http://localhost:3000/api/sessions');
      const response = await listSessions(request);

      const body = await response.json();
      expect(body.message).not.toContain('PostgreSQL');
      expect(body.message).not.toContain('relation');
    });

    it('validates UUID format strictly', async () => {
      // SQL injection attempt
      const request = new NextRequest(
        "http://localhost:3000/api/sessions/'; DROP TABLE sessions; --"
      );
      const response = await getSession(
        request,
        createParams("'; DROP TABLE sessions; --")
      );

      expect(response.status).toBe(400);
      expect(prisma.session.findFirst).not.toHaveBeenCalled();
    });

    it('prevents path traversal in session ID', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/sessions/../../../etc/passwd'
      );
      const response = await getSession(
        request,
        createParams('../../../etc/passwd')
      );

      expect(response.status).toBe(400);
    });
  });
});
