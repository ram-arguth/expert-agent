/**
 * Agent Catalog API Tests
 *
 * Tests for listing agents with Cedar authorization filtering.
 * Includes positive and negative security tests.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock dependencies before imports
vi.mock('../../../../auth', () => ({
  auth: vi.fn(),
}));

vi.mock('../../../../lib/db', () => ({
  prisma: {
    membership: {
      findMany: vi.fn(),
    },
  },
}));

// Import after mocks
import { GET } from '../route';
import { auth } from '../../../../auth';
import { prisma } from '../../../../lib/db';

const mockAuth = auth as Mock;
const mockFindManyMemberships = prisma.membership.findMany as Mock;

describe('GET /api/agents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Anonymous User', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(null);
    });

    it('returns public agents only', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agents).toBeDefined();
      expect(Array.isArray(data.agents)).toBe(true);

      // Anonymous users should only see public agents
      data.agents.forEach((agent: { isPublic?: boolean; isBeta?: boolean }) => {
        // Public agents should be visible to anonymous
        expect(agent.isBeta).not.toBe(true);
      });
    });

    it('does not return beta agents', async () => {
      const response = await GET();
      const data = await response.json();

      const betaAgents = data.agents.filter(
        (agent: { isBeta?: boolean }) => agent.isBeta === true
      );
      expect(betaAgents.length).toBe(0);
    });
  });

  describe('Authenticated User', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'user@example.com' },
        expires: '2024-12-31',
      });
    });

    it('returns agents with membership check', async () => {
      mockFindManyMemberships.mockResolvedValue([
        { orgId: 'org-1', role: 'MEMBER' },
      ]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agents).toBeDefined();
      expect(mockFindManyMemberships).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { orgId: true, role: true },
      });
    });

    it('includes ux-analyst in results', async () => {
      mockFindManyMemberships.mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      const uxAnalyst = data.agents.find(
        (agent: { id: string }) => agent.id === 'ux-analyst'
      );

      expect(uxAnalyst).toBeDefined();
      expect(uxAnalyst.displayName).toBe('UX Analyst');
      expect(uxAnalyst.category).toBe('design');
    });

    it('returns agent metadata fields', async () => {
      mockFindManyMemberships.mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      const agent = data.agents[0];

      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('displayName');
      expect(agent).toHaveProperty('description');
      expect(agent).toHaveProperty('category');
      expect(agent).toHaveProperty('supportsFileUpload');
      expect(agent).toHaveProperty('supportsStreaming');
    });
  });

  describe('Error Handling', () => {
    it('handles database errors gracefully', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'user@example.com' },
      });
      mockFindManyMemberships.mockRejectedValue(new Error('DB connection failed'));

      const response = await GET();

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('Security Tests', () => {
    it('does not expose allowedOrgIds in response', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'user@example.com' },
      });
      mockFindManyMemberships.mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      data.agents.forEach((agent: Record<string, unknown>) => {
        expect(agent).not.toHaveProperty('allowedOrgIds');
      });
    });

    it('does not expose internal paths in response', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1' },
      });
      mockFindManyMemberships.mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      data.agents.forEach((agent: Record<string, unknown>) => {
        expect(agent).not.toHaveProperty('inputSchemaPath');
        expect(agent).not.toHaveProperty('outputSchemaPath');
        expect(agent).not.toHaveProperty('promptTemplatePath');
        expect(agent).not.toHaveProperty('rendererPath');
      });
    });
  });
});
