/**
 * Cedar Authorization Engine Tests
 *
 * Tests for the Cedar policy engine implementation.
 * Covers all policy rules defined in DESIGN.md and IMPLEMENTATION.md.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CedarEngine,
  getCedarEngine,
  isAuthorized,
  buildPrincipalFromSession,
  CedarActions,
  type CedarPrincipal,
  type CedarResource,
  type AuthorizationRequest,
} from './cedar';

// ============================================
// Test Helpers
// ============================================

function createUserPrincipal(
  userId: string,
  options: {
    email?: string;
    orgIds?: string[];
    roles?: Record<string, string>;
  } = {}
): CedarPrincipal {
  return {
    type: 'User',
    id: userId,
    attributes: {
      email: options.email || `${userId}@example.com`,
      orgIds: options.orgIds || [],
      roles: options.roles || {},
    },
  };
}

function createAnonymousPrincipal(): CedarPrincipal {
  return {
    type: 'Anonymous',
    id: 'anonymous',
  };
}

function createOrgResource(
  orgId: string,
  attributes: Partial<CedarResource['attributes']> = {}
): CedarResource {
  return {
    type: 'Org',
    id: orgId,
    attributes,
  };
}

function createAgentResource(
  agentId: string,
  attributes: Partial<CedarResource['attributes']> = {}
): CedarResource {
  return {
    type: 'Agent',
    id: agentId,
    attributes: {
      isPublic: true,
      ...attributes,
    },
  };
}

function createRequest(
  principal: CedarPrincipal,
  action: string,
  resource: CedarResource
): AuthorizationRequest {
  return {
    principal,
    action: { type: 'Action', id: action },
    resource,
  };
}

// ============================================
// Tests
// ============================================

describe('CedarEngine', () => {
  describe('Default Deny Policy', () => {
    it('denies unknown actions', () => {
      const principal = createUserPrincipal('user1');
      const resource = createOrgResource('org1');
      const request = createRequest(principal, 'UnknownAction', resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(false);
      expect(decision.diagnostics?.matchedPolicy).toBe('default-deny');
    });

    it('denies access when no policy matches', () => {
      const principal = createUserPrincipal('user1');
      const resource: CedarResource = {
        type: 'Report',
        id: 'report1',
      };
      const request = createRequest(principal, 'SomeRandomAction', resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(false);
    });
  });

  describe('Anonymous Principal', () => {
    it('has no permissions by default', () => {
      const principal = createAnonymousPrincipal();
      const resource = createAgentResource('agent1');
      const request = createRequest(principal, CedarActions.QueryAgent, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(false);
    });

    it('can list public agents', () => {
      const principal = createAnonymousPrincipal();
      const resource = createAgentResource('agent1', { isPublic: true });
      const request = createRequest(principal, CedarActions.ListAgents, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(true);
    });
  });

  describe('User Profile Access', () => {
    it('user can view own profile', () => {
      const principal = createUserPrincipal('user1');
      const resource: CedarResource = { type: 'User', id: 'user1' };
      const request = createRequest(principal, CedarActions.GetProfile, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(true);
      expect(decision.diagnostics?.matchedPolicy).toBe('user-own-profile');
    });

    it('user can update own profile', () => {
      const principal = createUserPrincipal('user1');
      const resource: CedarResource = { type: 'User', id: 'user1' };
      const request = createRequest(principal, CedarActions.UpdateProfile, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(true);
    });

    it('user cannot view other users profile', () => {
      const principal = createUserPrincipal('user1');
      const resource: CedarResource = { type: 'User', id: 'user2' };
      const request = createRequest(principal, CedarActions.GetProfile, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(false);
    });
  });

  describe('Agent Access', () => {
    it('authenticated user can list public agents', () => {
      const principal = createUserPrincipal('user1');
      const resource = createAgentResource('agent1', { isPublic: true });
      const request = createRequest(principal, CedarActions.ListAgents, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(true);
    });

    it('authenticated user can query public agents', () => {
      const principal = createUserPrincipal('user1');
      const resource = createAgentResource('agent1', { isPublic: true });
      const request = createRequest(principal, CedarActions.QueryAgent, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(true);
    });

    it('user can access agent allowed for their org', () => {
      const principal = createUserPrincipal('user1', { orgIds: ['org1'] });
      const resource = createAgentResource('beta-agent', {
        isPublic: false,
        isBeta: true,
        allowedOrgIds: ['org1', 'org2'],
      });
      const request = createRequest(principal, CedarActions.QueryAgent, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(true);
    });

    it('user cannot access restricted agent not allowed for their org', () => {
      const principal = createUserPrincipal('user1', { orgIds: ['org3'] });
      const resource = createAgentResource('beta-agent', {
        isPublic: false,
        isBeta: true,
        allowedOrgIds: ['org1', 'org2'],
      });
      const request = createRequest(principal, CedarActions.QueryAgent, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(false);
    });
  });

  describe('Organization Management', () => {
    it('owner can invite members', () => {
      const principal = createUserPrincipal('user1', {
        orgIds: ['org1'],
        roles: { org1: 'owner' },
      });
      const resource = createOrgResource('org1');
      const request = createRequest(principal, CedarActions.InviteMember, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(true);
      expect(decision.diagnostics?.matchedPolicy).toBe('org-admin-invite');
    });

    it('admin can invite members', () => {
      const principal = createUserPrincipal('user1', {
        orgIds: ['org1'],
        roles: { org1: 'admin' },
      });
      const resource = createOrgResource('org1');
      const request = createRequest(principal, CedarActions.InviteMember, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(true);
    });

    it('member cannot invite members', () => {
      const principal = createUserPrincipal('user1', {
        orgIds: ['org1'],
        roles: { org1: 'member' },
      });
      const resource = createOrgResource('org1');
      const request = createRequest(principal, CedarActions.InviteMember, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(false);
    });

    it('user cannot invite to other org', () => {
      const principal = createUserPrincipal('user1', {
        orgIds: ['org1'],
        roles: { org1: 'owner' },
      });
      const resource = createOrgResource('org2');
      const request = createRequest(principal, CedarActions.InviteMember, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(false);
    });

    it('owner can delete org', () => {
      const principal = createUserPrincipal('user1', {
        orgIds: ['org1'],
        roles: { org1: 'owner' },
      });
      const resource = createOrgResource('org1');
      const request = createRequest(principal, CedarActions.DeleteOrg, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(true);
    });

    it('admin cannot delete org', () => {
      const principal = createUserPrincipal('user1', {
        orgIds: ['org1'],
        roles: { org1: 'admin' },
      });
      const resource = createOrgResource('org1');
      const request = createRequest(principal, CedarActions.DeleteOrg, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(false);
    });

    it('member can view org details', () => {
      const principal = createUserPrincipal('user1', {
        orgIds: ['org1'],
        roles: { org1: 'member' },
      });
      const resource = createOrgResource('org1');
      const request = createRequest(principal, CedarActions.GetOrg, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(true);
    });

    it('non-member cannot view org details', () => {
      const principal = createUserPrincipal('user1', {
        orgIds: ['org2'],
        roles: { org2: 'member' },
      });
      const resource = createOrgResource('org1');
      const request = createRequest(principal, CedarActions.GetOrg, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(false);
    });
  });

  describe('Cross-Tenant Access Denial', () => {
    it('user cannot access other orgs resources', () => {
      const principal = createUserPrincipal('user1', {
        orgIds: ['org1'],
        roles: { org1: 'owner' },
      });
      const resource = createOrgResource('org2');
      const request = createRequest(principal, CedarActions.UpdateOrg, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(false);
    });
  });

  describe('Billing Access', () => {
    it('owner can manage billing', () => {
      const principal = createUserPrincipal('user1', {
        orgIds: ['org1'],
        roles: { org1: 'owner' },
      });
      const resource = createOrgResource('org1');
      const request = createRequest(principal, CedarActions.ManageBilling, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(true);
    });

    it('billing_manager can manage billing', () => {
      const principal = createUserPrincipal('user1', {
        orgIds: ['org1'],
        roles: { org1: 'billing_manager' },
      });
      const resource = createOrgResource('org1');
      const request = createRequest(principal, CedarActions.ManageBilling, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(true);
    });

    it('regular member can view billing', () => {
      const principal = createUserPrincipal('user1', {
        orgIds: ['org1'],
        roles: { org1: 'member' },
      });
      const resource = createOrgResource('org1');
      const request = createRequest(principal, CedarActions.ViewBilling, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(true);
    });

    it('regular member cannot manage billing', () => {
      const principal = createUserPrincipal('user1', {
        orgIds: ['org1'],
        roles: { org1: 'member' },
      });
      const resource = createOrgResource('org1');
      const request = createRequest(principal, CedarActions.ManageBilling, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('user can create sessions', () => {
      const principal = createUserPrincipal('user1');
      const resource: CedarResource = { type: 'Session', id: '*' };
      const request = createRequest(principal, CedarActions.CreateSession, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(true);
    });

    it('user can access own session', () => {
      const principal = createUserPrincipal('user1');
      const resource: CedarResource = {
        type: 'Session',
        id: 'session1',
        attributes: { ownerId: 'user1' },
      };
      const request = createRequest(principal, CedarActions.GetSession, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(true);
    });

    it('user cannot access other users session', () => {
      const principal = createUserPrincipal('user1');
      const resource: CedarResource = {
        type: 'Session',
        id: 'session1',
        attributes: { ownerId: 'user2' },
      };
      const request = createRequest(principal, CedarActions.GetSession, resource);

      const decision = isAuthorized(request);

      expect(decision.isAuthorized).toBe(false);
    });
  });
});

describe('buildPrincipalFromSession', () => {
  it('returns Anonymous for null session', () => {
    const principal = buildPrincipalFromSession(null);

    expect(principal.type).toBe('Anonymous');
    expect(principal.id).toBe('anonymous');
  });

  it('returns Anonymous for session without user', () => {
    const principal = buildPrincipalFromSession({} as unknown as null);

    expect(principal.type).toBe('Anonymous');
  });

  it('builds User principal from session with memberships', () => {
    const session = {
      user: {
        id: 'user123',
        email: 'user@example.com',
      },
      expires: '2024-12-31',
    };

    const memberships = [
      { orgId: 'org1', role: 'owner' },
      { orgId: 'org2', role: 'member' },
    ];

    const principal = buildPrincipalFromSession(session, memberships);

    expect(principal.type).toBe('User');
    expect(principal.id).toBe('user123');
    expect(principal.attributes?.email).toBe('user@example.com');
    expect(principal.attributes?.orgIds).toEqual(['org1', 'org2']);
    expect(principal.attributes?.roles).toEqual({
      org1: 'owner',
      org2: 'member',
    });
  });
});
