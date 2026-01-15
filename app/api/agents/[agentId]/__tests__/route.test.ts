/**
 * GET Agent Details API Tests
 *
 * Tests for the individual agent details endpoint:
 * - Agent retrieval
 * - Authorization (Cedar)
 * - JSON Schema generation
 * - Error handling
 * - Security
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies before imports
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    membership: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/authz/cedar', () => ({
  isAuthorized: vi.fn(() => ({ isAuthorized: true, reason: 'Allowed' })),
  buildPrincipalFromSession: vi.fn(() => ({
    type: 'User',
    id: 'anonymous',
    attributes: { isAuthenticated: false, membershipOrgIds: [] },
  })),
  CedarActions: {
    GetAgent: 'GetAgent',
  },
}));

// Import after mocks
import { GET } from '../route';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { isAuthorized } from '@/lib/authz/cedar';

const mockAuth = auth as Mock;
const mockFindManyMemberships = prisma.membership.findMany as Mock;
const mockIsAuthorized = isAuthorized as Mock;

// Helper to create request
function createParams(agentId: string) {
  return { params: Promise.resolve({ agentId }) };
}

describe('GET /api/agents/[agentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthorized.mockReturnValue({ isAuthorized: true, reason: 'Allowed' });
  });

  describe('Agent Retrieval', () => {
    it('returns agent details for valid agentId', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/agents/ux-analyst');
      const response = await GET(request, createParams('ux-analyst'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agent).toBeDefined();
      expect(data.agent.id).toBe('ux-analyst');
      expect(data.agent.displayName).toBe('UX Analyst');
    });

    it('returns 404 for unknown agentId', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/agents/unknown-agent');
      const response = await GET(request, createParams('unknown-agent'));

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Agent not found');
    });

    it('includes agent metadata in response', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/agents/ux-analyst');
      const response = await GET(request, createParams('ux-analyst'));
      const data = await response.json();

      expect(data.agent).toHaveProperty('id');
      expect(data.agent).toHaveProperty('displayName');
      expect(data.agent).toHaveProperty('description');
      expect(data.agent).toHaveProperty('category');
      expect(data.agent).toHaveProperty('isBeta');
      expect(data.agent).toHaveProperty('supportsGuidedInterview');
      expect(data.agent).toHaveProperty('supportsFileUpload');
    });
  });

  describe('JSON Schema Generation', () => {
    it('returns inputSchema as JSON Schema', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/agents/ux-analyst');
      const response = await GET(request, createParams('ux-analyst'));
      const data = await response.json();

      expect(data.inputSchema).toBeDefined();
      // JSON Schema structure may vary - check for essential properties
      expect(typeof data.inputSchema).toBe('object');
    });

    it('includes form configuration', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/agents/ux-analyst');
      const response = await GET(request, createParams('ux-analyst'));
      const data = await response.json();

      expect(data.formConfig).toBeDefined();
    });
  });

  describe('Authorization', () => {
    it('calls isAuthorized with correct parameters', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'user@example.com' },
      });
      mockFindManyMemberships.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/agents/ux-analyst');
      await GET(request, createParams('ux-analyst'));

      expect(mockIsAuthorized).toHaveBeenCalled();
      const authCall = mockIsAuthorized.mock.calls[0][0];
      expect(authCall.action.id).toBe('GetAgent');
      expect(authCall.resource.type).toBe('Agent');
      expect(authCall.resource.id).toBe('ux-analyst');
    });

    it('returns 403 for unauthorized beta agent access', async () => {
      mockAuth.mockResolvedValue(null);
      mockIsAuthorized.mockReturnValue({
        isAuthorized: false,
        reason: 'Beta agent requires authorization',
      });

      const request = new NextRequest('http://localhost/api/agents/ux-analyst');
      const response = await GET(request, createParams('ux-analyst'));

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Access denied');
    });

    it('fetches user memberships for authenticated users', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'user@example.com' },
      });
      mockFindManyMemberships.mockResolvedValue([
        { orgId: 'org-1', role: 'MEMBER' },
      ]);

      const request = new NextRequest('http://localhost/api/agents/ux-analyst');
      await GET(request, createParams('ux-analyst'));

      expect(mockFindManyMemberships).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { orgId: true, role: true },
      });
    });

    it('skips membership fetch for anonymous users', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/agents/ux-analyst');
      await GET(request, createParams('ux-analyst'));

      expect(mockFindManyMemberships).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles database errors gracefully', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'user@example.com' },
      });
      mockFindManyMemberships.mockRejectedValue(new Error('DB connection failed'));

      const request = new NextRequest('http://localhost/api/agents/ux-analyst');
      const response = await GET(request, createParams('ux-analyst'));

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('Security', () => {
    it('does not expose allowedOrgIds in response', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/agents/ux-analyst');
      const response = await GET(request, createParams('ux-analyst'));
      const data = await response.json();

      expect(data.agent).not.toHaveProperty('allowedOrgIds');
    });

    it('does not expose internal schema paths', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/agents/ux-analyst');
      const response = await GET(request, createParams('ux-analyst'));
      const data = await response.json();

      expect(data.agent).not.toHaveProperty('inputSchemaPath');
      expect(data.agent).not.toHaveProperty('outputSchemaPath');
      expect(data.agent).not.toHaveProperty('promptTemplatePath');
    });

    it('resource attributes include security metadata', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/agents/ux-analyst');
      await GET(request, createParams('ux-analyst'));

      const authCall = mockIsAuthorized.mock.calls[0][0];
      expect(authCall.resource.attributes).toHaveProperty('isPublic');
      expect(authCall.resource.attributes).toHaveProperty('isBeta');
      expect(authCall.resource.attributes).toHaveProperty('allowedOrgIds');
    });
  });
});
