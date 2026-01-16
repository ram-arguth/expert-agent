/**
 * Cedar Authorization Engine
 *
 * This module provides Cedar-based fine-grained authorization.
 * Every API route MUST call Cedar for authorization (enforced by CI/CD).
 *
 * @see docs/DESIGN.md - Authorization section
 * @see docs/IMPLEMENTATION.md - Phase 1.6 Cedar Policy Engine Integration
 */

import type { Session } from "next-auth";

// ============================================
// Types
// ============================================

/**
 * Represents a Cedar principal (the actor making the request)
 */
export interface CedarPrincipal {
  type: "User" | "Anonymous" | "Service";
  id: string;
  attributes?: {
    email?: string;
    orgIds?: string[];
    roles?: Record<string, string>; // orgId -> role
    authProvider?: string;
    /**
     * SECURITY: Flag indicating this is a test principal.
     * Test principals are created via E2E test injection.
     * Cedar policies MUST explicitly DENY test principals in production.
     */
    isTestPrincipal?: boolean;
  };
}

/**
 * Represents a Cedar action (what the actor wants to do)
 */
export interface CedarAction {
  type: "Action";
  id: string;
}

/**
 * Represents a Cedar resource (what the actor wants to access)
 */
export interface CedarResource {
  type:
    | "Agent"
    | "Org"
    | "File"
    | "Session"
    | "Message"
    | "User"
    | "Invite"
    | "Report";
  id: string;
  attributes?: {
    orgId?: string;
    ownerId?: string;
    userId?: string; // For session/message ownership
    isPublic?: boolean;
    isBeta?: boolean;
    allowedOrgIds?: string[];
  };
}

/**
 * Context for authorization decision
 */
export interface CedarContext {
  activeOrgId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: string;
}

/**
 * Authorization request
 */
export interface AuthorizationRequest {
  principal: CedarPrincipal;
  action: CedarAction;
  resource: CedarResource;
  context?: CedarContext;
}

/**
 * Authorization decision
 */
export interface AuthorizationDecision {
  isAuthorized: boolean;
  reason?: string;
  diagnostics?: {
    policiesEvaluated: number;
    matchedPolicy?: string;
  };
}

// ============================================
// Cedar Actions (centralized action registry)
// ============================================

/**
 * All supported Cedar actions.
 * Add new actions here as you add new API endpoints.
 */
export const CedarActions = {
  // Agent actions
  ListAgents: "ListAgents",
  GetAgent: "GetAgent",
  QueryAgent: "QueryAgent",

  // Organization actions
  CreateOrg: "CreateOrg",
  GetOrg: "GetOrg",
  UpdateOrg: "UpdateOrg",
  DeleteOrg: "DeleteOrg",
  InviteMember: "InviteMember",
  RemoveMember: "RemoveMember",
  UpdateMemberRole: "UpdateMemberRole",
  ConfigureSSO: "ConfigureSSO",
  VerifyDomain: "VerifyDomain",
  ManageContextFiles: "ManageContextFiles", // Upload/delete org context files

  // User actions
  GetProfile: "GetProfile",
  UpdateProfile: "UpdateProfile",
  GetMemberships: "GetMemberships",

  // Session/Conversation actions
  CreateSession: "CreateSession",
  GetSession: "GetSession",
  ListSessions: "ListSessions",
  DeleteSession: "DeleteSession",

  // File actions
  UploadFile: "UploadFile",
  GetFile: "GetFile",
  DeleteFile: "DeleteFile",
  ListFiles: "ListFiles",

  // Billing actions
  ViewBilling: "ViewBilling",
  ManageBilling: "ManageBilling",
  ViewUsage: "ViewUsage",

  // Admin actions
  ViewAuditLog: "ViewAuditLog",
  ManageSettings: "ManageSettings",
} as const;

export type CedarActionType = (typeof CedarActions)[keyof typeof CedarActions];

// ============================================
// Policy Evaluation (In-memory implementation)
// ============================================

/**
 * Cedar policy engine
 *
 * This is a simplified in-memory implementation.
 * For production, consider using @cedar-policy/cedar-wasm
 */
class CedarEngine {
  private policies: Policy[] = [];

  constructor() {
    this.loadDefaultPolicies();
  }

  /**
   * Load default policies
   */
  private loadDefaultPolicies(): void {
    // SECURITY: Block test principals in production (HIGHEST PRIORITY)
    // This is defense-in-depth - even if test principals bypass middleware,
    // Cedar will explicitly deny them.
    this.policies.push({
      id: "block-test-principals-in-production",
      effect: "forbid",
      priority: 1000, // Highest priority - evaluated first
      evaluate: (req) => {
        const isTestPrincipal =
          req.principal.attributes?.isTestPrincipal === true;
        const isProduction = process.env.NODE_ENV === "production";

        if (isTestPrincipal && isProduction) {
          console.error(
            "[SECURITY ALERT] Test principal blocked by Cedar in production!",
            {
              principalId: req.principal.id,
              action: req.action.id,
              resource: `${req.resource.type}::${req.resource.id}`,
            },
          );
          return {
            matches: true,
            reason: "SECURITY: Test principals are forbidden in production",
          };
        }
        return { matches: false };
      },
    });

    // Default deny - always evaluated last
    this.policies.push({
      id: "default-deny",
      effect: "forbid",
      priority: 0,
      evaluate: () => ({
        matches: true,
        reason: "Default deny - no policy matched",
      }),
    });

    // Anonymous can only access public resources
    this.policies.push({
      id: "anonymous-public-only",
      effect: "permit",
      priority: 100,
      evaluate: (req) => {
        if (req.principal.type === "Anonymous") {
          const action = req.action.id;
          // Anonymous can list public agents
          if (
            action === CedarActions.ListAgents &&
            req.resource.attributes?.isPublic
          ) {
            return {
              matches: true,
              reason: "Anonymous can list public agents",
            };
          }
          return { matches: false };
        }
        return { matches: false };
      },
    });

    // Authenticated users can access their own profile
    this.policies.push({
      id: "user-own-profile",
      effect: "permit",
      priority: 90,
      evaluate: (req) => {
        if (req.principal.type !== "User") return { matches: false };

        const action = req.action.id;
        if (
          (action === CedarActions.GetProfile ||
            action === CedarActions.UpdateProfile) &&
          req.resource.type === "User" &&
          req.resource.id === req.principal.id
        ) {
          return { matches: true, reason: "User can access own profile" };
        }
        return { matches: false };
      },
    });

    // Authenticated users can list their memberships
    this.policies.push({
      id: "user-list-memberships",
      effect: "permit",
      priority: 90,
      evaluate: (req) => {
        if (req.principal.type !== "User") return { matches: false };

        if (req.action.id === CedarActions.GetMemberships) {
          return { matches: true, reason: "User can list own memberships" };
        }
        return { matches: false };
      },
    });

    // Authenticated users can list agents
    this.policies.push({
      id: "user-list-agents",
      effect: "permit",
      priority: 80,
      evaluate: (req) => {
        if (req.principal.type !== "User") return { matches: false };

        const action = req.action.id;
        if (
          action === CedarActions.ListAgents ||
          action === CedarActions.GetAgent
        ) {
          // Check if agent is public or user's org is in allowedOrgIds
          const isPublic = req.resource.attributes?.isPublic;
          const allowedOrgs = req.resource.attributes?.allowedOrgIds || [];
          const userOrgs = req.principal.attributes?.orgIds || [];

          if (isPublic || allowedOrgs.length === 0) {
            return { matches: true, reason: "Agent is public or unrestricted" };
          }

          if (userOrgs.some((orgId) => allowedOrgs.includes(orgId))) {
            return { matches: true, reason: "User org is in allowed list" };
          }
        }
        return { matches: false };
      },
    });

    // Authenticated users can query agents
    this.policies.push({
      id: "user-query-agent",
      effect: "permit",
      priority: 80,
      evaluate: (req) => {
        if (req.principal.type !== "User") return { matches: false };

        if (req.action.id === CedarActions.QueryAgent) {
          // User must have quota (checked separately) and agent must be accessible
          const isPublic = req.resource.attributes?.isPublic;
          const allowedOrgs = req.resource.attributes?.allowedOrgIds || [];
          const userOrgs = req.principal.attributes?.orgIds || [];

          if (isPublic || allowedOrgs.length === 0) {
            return {
              matches: true,
              reason: "Can query public/unrestricted agent",
            };
          }

          if (userOrgs.some((orgId) => allowedOrgs.includes(orgId))) {
            return {
              matches: true,
              reason: "Can query agent allowed for user org",
            };
          }
        }
        return { matches: false };
      },
    });

    // Org owner/admin can invite members
    this.policies.push({
      id: "org-admin-invite",
      effect: "permit",
      priority: 70,
      evaluate: (req) => {
        if (req.principal.type !== "User") return { matches: false };

        if (
          req.action.id === CedarActions.InviteMember &&
          req.resource.type === "Org"
        ) {
          const roles = req.principal.attributes?.roles || {};
          const orgRole = roles[req.resource.id];

          if (orgRole === "owner" || orgRole === "admin") {
            return { matches: true, reason: "Owner/admin can invite members" };
          }
        }
        return { matches: false };
      },
    });

    // Org owner can manage org settings
    this.policies.push({
      id: "org-owner-manage",
      effect: "permit",
      priority: 70,
      evaluate: (req) => {
        if (req.principal.type !== "User") return { matches: false };

        const ownerActions: readonly string[] = [
          CedarActions.UpdateOrg,
          CedarActions.DeleteOrg,
          CedarActions.ConfigureSSO,
          CedarActions.VerifyDomain,
          CedarActions.RemoveMember,
          CedarActions.UpdateMemberRole,
        ];

        if (
          ownerActions.includes(req.action.id) &&
          req.resource.type === "Org"
        ) {
          const roles = req.principal.attributes?.roles || {};
          const orgRole = roles[req.resource.id];

          if (orgRole === "owner") {
            return { matches: true, reason: "Owner can manage org" };
          }
          if (orgRole === "admin" && req.action.id !== CedarActions.DeleteOrg) {
            return {
              matches: true,
              reason: "Admin can manage org (except delete)",
            };
          }
        }
        return { matches: false };
      },
    });

    // Org members can view org details
    this.policies.push({
      id: "org-member-view",
      effect: "permit",
      priority: 60,
      evaluate: (req) => {
        if (req.principal.type !== "User") return { matches: false };

        if (
          req.action.id === CedarActions.GetOrg &&
          req.resource.type === "Org"
        ) {
          const roles = req.principal.attributes?.roles || {};
          if (roles[req.resource.id]) {
            return { matches: true, reason: "Org member can view org" };
          }
        }
        return { matches: false };
      },
    });

    // Users can create orgs
    this.policies.push({
      id: "user-create-org",
      effect: "permit",
      priority: 60,
      evaluate: (req) => {
        if (req.principal.type !== "User") return { matches: false };

        if (req.action.id === CedarActions.CreateOrg) {
          return {
            matches: true,
            reason: "Authenticated users can create orgs",
          };
        }
        return { matches: false };
      },
    });

    // Users can manage their sessions
    this.policies.push({
      id: "user-manage-sessions",
      effect: "permit",
      priority: 60,
      evaluate: (req) => {
        if (req.principal.type !== "User") return { matches: false };

        const sessionActions: readonly string[] = [
          CedarActions.CreateSession,
          CedarActions.GetSession,
          CedarActions.ListSessions,
          CedarActions.DeleteSession,
        ];

        if (sessionActions.includes(req.action.id)) {
          // CreateSession and ListSessions are always allowed for authenticated users
          if (
            req.action.id === CedarActions.CreateSession ||
            req.action.id === CedarActions.ListSessions
          ) {
            return { matches: true, reason: "User can create/list sessions" };
          }

          // For GetSession and DeleteSession, must own the session
          if (
            req.resource.type === "Session" &&
            req.resource.attributes?.ownerId === req.principal.id
          ) {
            return { matches: true, reason: "User can manage own sessions" };
          }
        }
        return { matches: false };
      },
    });

    // Users can manage their files
    this.policies.push({
      id: "user-manage-files",
      effect: "permit",
      priority: 60,
      evaluate: (req) => {
        if (req.principal.type !== "User") return { matches: false };

        const fileActions: readonly string[] = [
          CedarActions.UploadFile,
          CedarActions.GetFile,
          CedarActions.DeleteFile,
          CedarActions.ListFiles,
        ];

        if (fileActions.includes(req.action.id)) {
          if (
            req.action.id === CedarActions.UploadFile ||
            req.action.id === CedarActions.ListFiles
          ) {
            return { matches: true, reason: "User can upload/list files" };
          }
          if (req.resource.attributes?.ownerId === req.principal.id) {
            return { matches: true, reason: "User can manage own files" };
          }
          // Org files - check membership
          const orgId = req.resource.attributes?.orgId;
          if (orgId && req.principal.attributes?.orgIds?.includes(orgId)) {
            return { matches: true, reason: "User can access org files" };
          }
        }
        return { matches: false };
      },
    });

    // Billing managers and owners can view/manage billing
    this.policies.push({
      id: "billing-access",
      effect: "permit",
      priority: 60,
      evaluate: (req) => {
        if (req.principal.type !== "User") return { matches: false };

        if (
          (req.action.id === CedarActions.ViewBilling ||
            req.action.id === CedarActions.ManageBilling ||
            req.action.id === CedarActions.ViewUsage) &&
          req.resource.type === "Org"
        ) {
          const roles = req.principal.attributes?.roles || {};
          const orgRole = roles[req.resource.id];

          if (
            req.action.id === CedarActions.ViewBilling ||
            req.action.id === CedarActions.ViewUsage
          ) {
            // Any member can view
            if (orgRole) {
              return {
                matches: true,
                reason: "Org member can view billing/usage",
              };
            }
          }

          if (req.action.id === CedarActions.ManageBilling) {
            if (orgRole === "owner" || orgRole === "billing_manager") {
              return {
                matches: true,
                reason: "Owner/billing_manager can manage billing",
              };
            }
          }
        }
        return { matches: false };
      },
    });

    // Sort policies by priority (higher first)
    this.policies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Evaluate authorization request
   */
  isAuthorized(request: AuthorizationRequest): AuthorizationDecision {
    let policiesEvaluated = 0;

    for (const policy of this.policies) {
      policiesEvaluated++;
      const result = policy.evaluate(request);

      if (result.matches) {
        return {
          isAuthorized: policy.effect === "permit",
          reason: result.reason,
          diagnostics: {
            policiesEvaluated,
            matchedPolicy: policy.id,
          },
        };
      }
    }

    // Should never reach here due to default deny
    return {
      isAuthorized: false,
      reason: "No policy matched",
      diagnostics: { policiesEvaluated },
    };
  }

  /**
   * Add a custom policy
   */
  addPolicy(policy: Policy): void {
    this.policies.push(policy);
    this.policies.sort((a, b) => b.priority - a.priority);
  }
}

interface Policy {
  id: string;
  effect: "permit" | "forbid";
  priority: number; // Higher = evaluated first
  evaluate: (request: AuthorizationRequest) => {
    matches: boolean;
    reason?: string;
  };
}

// ============================================
// Singleton Instance
// ============================================

let cedarInstance: CedarEngine | null = null;

export function getCedarEngine(): CedarEngine {
  if (!cedarInstance) {
    cedarInstance = new CedarEngine();
  }
  return cedarInstance;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Build a Cedar principal from a NextAuth session
 */
export function buildPrincipalFromSession(
  session: Session | null,
  memberships?: Array<{ orgId: string; role: string }>,
): CedarPrincipal {
  if (!session?.user) {
    return {
      type: "Anonymous",
      id: "anonymous",
    };
  }

  const roles: Record<string, string> = {};
  const orgIds: string[] = [];

  if (memberships) {
    for (const m of memberships) {
      roles[m.orgId] = m.role;
      orgIds.push(m.orgId);
    }
  }

  return {
    type: "User",
    id: session.user.id || session.user.email || "unknown",
    attributes: {
      email: session.user.email || undefined,
      orgIds,
      roles,
    },
  };
}

/**
 * Check authorization
 */
export function isAuthorized(
  request: AuthorizationRequest,
): AuthorizationDecision {
  const engine = getCedarEngine();
  const decision = engine.isAuthorized(request);

  // Log authorization decision for audit trail
  if (process.env.NODE_ENV !== "test") {
    console.log("[Cedar AuthZ]", {
      principal: `${request.principal.type}::${request.principal.id}`,
      action: request.action.id,
      resource: `${request.resource.type}::${request.resource.id}`,
      decision: decision.isAuthorized ? "PERMIT" : "DENY",
      reason: decision.reason,
      policy: decision.diagnostics?.matchedPolicy,
    });
  }

  return decision;
}

// Export the engine for testing
export { CedarEngine };
