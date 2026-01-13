/**
 * Authorization Middleware Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthZ, resourceFromParams, publicResource } from './middleware';
import { CedarActions } from './cedar';

// Mock auth from @/auth
const mockAuth = vi.fn();

vi.mock('@/auth', () => ({
  auth: () => mockAuth(),
}));

// ============================================
// Tests
// ============================================

describe('withAuthZ Middleware', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when no session and allowAnonymous is false', async () => {
    mockAuth.mockResolvedValue(null);

    const handler = vi.fn();
    const wrappedHandler = withAuthZ({
      action: CedarActions.QueryAgent,
      getResource: () => ({ type: 'Agent', id: 'test', attributes: { isPublic: true } }),
    })(handler);

    const req = new NextRequest('http://localhost/api/test');
    const response = await wrappedHandler(req, { params: Promise.resolve({}) });

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('allows anonymous access when allowAnonymous is true and policy permits', async () => {
    mockAuth.mockResolvedValue(null);

    const handler = vi.fn().mockReturnValue(NextResponse.json({ success: true }));
    const wrappedHandler = withAuthZ({
      action: CedarActions.ListAgents,
      getResource: () => ({ type: 'Agent', id: '*', attributes: { isPublic: true } }),
      allowAnonymous: true,
    })(handler);

    const req = new NextRequest('http://localhost/api/agents');
    const response = await wrappedHandler(req, { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('returns 403 when Cedar denies access', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', email: 'user@example.com' },
      expires: '2024-12-31',
    });

    const handler = vi.fn();
    const wrappedHandler = withAuthZ({
      action: CedarActions.DeleteOrg, // Requires owner role
      getResource: () => ({ type: 'Org', id: 'org1' }),
    })(handler);

    const req = new NextRequest('http://localhost/api/org/org1');
    const response = await wrappedHandler(req, { params: Promise.resolve({ id: 'org1' }) });

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.error).toBe('Forbidden');
  });

  it('executes handler when Cedar permits access', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', email: 'user@example.com' },
      expires: '2024-12-31',
    });

    const handler = vi.fn().mockReturnValue(NextResponse.json({ agents: [] }));
    const wrappedHandler = withAuthZ({
      action: CedarActions.ListAgents,
      getResource: () => ({ type: 'Agent', id: '*', attributes: { isPublic: true } }),
    })(handler);

    const req = new NextRequest('http://localhost/api/agents');
    const response = await wrappedHandler(req, { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('passes route params to getResource', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', email: 'user@example.com' },
      expires: '2024-12-31',
    });

    const getResource = vi.fn().mockReturnValue({
      type: 'Agent',
      id: 'agent123',
      attributes: { isPublic: true },
    });

    const handler = vi.fn().mockReturnValue(NextResponse.json({ success: true }));
    const wrappedHandler = withAuthZ({
      action: CedarActions.GetAgent,
      getResource,
    })(handler);

    const req = new NextRequest('http://localhost/api/agents/agent123');
    await wrappedHandler(req, { params: Promise.resolve({ agentId: 'agent123' }) });

    expect(getResource).toHaveBeenCalledWith(expect.any(NextRequest), { agentId: 'agent123' });
  });
});

describe('resourceFromParams', () => {
  it('creates resource from route params', () => {
    const builder = resourceFromParams('Agent', 'agentId');
    const req = new NextRequest('http://localhost/api/agents/test-agent');

    const resource = builder(req, { agentId: 'test-agent' });

    expect(resource.type).toBe('Agent');
    expect(resource.id).toBe('test-agent');
  });

  it('uses wildcard when param is missing', () => {
    const builder = resourceFromParams('Agent', 'agentId');
    const req = new NextRequest('http://localhost/api/agents');

    const resource = builder(req, {});

    expect(resource.id).toBe('*');
  });

  it('includes additional attributes', () => {
    const builder = resourceFromParams('Agent', 'agentId', { isPublic: true });
    const req = new NextRequest('http://localhost/api/agents/test');

    const resource = builder(req, { agentId: 'test' });

    expect(resource.attributes?.isPublic).toBe(true);
  });
});

describe('publicResource', () => {
  it('creates a public resource with wildcard id', () => {
    const resource = publicResource('Agent');

    expect(resource.type).toBe('Agent');
    expect(resource.id).toBe('*');
    expect(resource.attributes?.isPublic).toBe(true);
  });
});
