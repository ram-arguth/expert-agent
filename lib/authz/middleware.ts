/**
 * Authorization Middleware
 *
 * Provides withAuthZ wrapper for API routes to enforce Cedar authorization.
 * Every API route MUST use this middleware or explicitly call cedar.isAuthorized().
 *
 * @example
 * ```ts
 * // In app/api/agents/route.ts
 * import { withAuthZ } from '@/lib/authz/middleware';
 * import { CedarActions } from '@/lib/authz/cedar';
 *
 * export const GET = withAuthZ({
 *   action: CedarActions.ListAgents,
 *   getResource: () => ({ type: 'Agent', id: '*', attributes: { isPublic: true } }),
 * })(async (req, ctx) => {
 *   // Handler implementation
 *   return NextResponse.json({ agents: [] });
 * });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  isAuthorized,
  buildPrincipalFromSession,
  type CedarResource,
  type CedarContext,
  type CedarActionType,
} from './cedar';

// ============================================
// Types
// ============================================

type RouteParams = { params: Promise<Record<string, string>> };
type RouteHandler<T = unknown> = (req: NextRequest, context: RouteParams) => Promise<NextResponse<T>>;

export interface WithAuthZOptions {
  /** The Cedar action being performed */
  action: CedarActionType;
  /** Function to build the resource from request/params */
  getResource: (req: NextRequest, params: Record<string, string>) => CedarResource | Promise<CedarResource>;
  /** Optional function to add context */
  getContext?: (req: NextRequest) => CedarContext | Promise<CedarContext>;
  /** If true, allow unauthenticated access (will use Anonymous principal) */
  allowAnonymous?: boolean;
}

// ============================================
// Middleware Implementation
// ============================================

/**
 * Wrap an API route handler with Cedar authorization
 */
export function withAuthZ<T = unknown>(options: WithAuthZOptions) {
  return function (handler: RouteHandler<T>): RouteHandler<T> {
    return async (req: NextRequest, routeContext: RouteParams): Promise<NextResponse<T>> => {
      // Get session
      const session = await auth();

      // Check if authentication is required
      if (!session && !options.allowAnonymous) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        ) as NextResponse<T>;
      }

      // Get route params
      const params = await routeContext.params;

      // Build Cedar request components
      const principal = buildPrincipalFromSession(session);
      const resource = await options.getResource(req, params);
      const context = options.getContext ? await options.getContext(req) : undefined;

      // Perform authorization check
      const decision = isAuthorized({
        principal,
        action: { type: 'Action', id: options.action },
        resource,
        context,
      });

      if (!decision.isAuthorized) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: decision.reason || 'You do not have permission to perform this action',
          },
          { status: 403 }
        ) as NextResponse<T>;
      }

      // Authorization passed, execute the handler
      return handler(req, routeContext);
    };
  };
}

/**
 * Create a simple resource builder for common patterns
 */
export function resourceFromParams(
  type: CedarResource['type'],
  idParam: string = 'id',
  attributes: CedarResource['attributes'] = {}
) {
  return (_req: NextRequest, params: Record<string, string>): CedarResource => ({
    type,
    id: params[idParam] || '*',
    attributes,
  });
}

/**
 * Create a public resource (for list endpoints)
 */
export function publicResource(type: CedarResource['type']): CedarResource {
  return {
    type,
    id: '*',
    attributes: { isPublic: true },
  };
}

// ============================================
// Response Helpers
// ============================================

export function unauthorized(message: string = 'Authentication required'): NextResponse {
  return NextResponse.json({ error: 'Unauthorized', message }, { status: 401 });
}

export function forbidden(message: string = 'You do not have permission to perform this action'): NextResponse {
  return NextResponse.json({ error: 'Forbidden', message }, { status: 403 });
}

export function notFound(message: string = 'Resource not found'): NextResponse {
  return NextResponse.json({ error: 'Not Found', message }, { status: 404 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: 'Bad Request', message }, { status: 400 });
}
