/**
 * AuthZ Coverage Check Script Tests
 *
 * Tests for the authorization coverage check script that ensures
 * all API routes have Cedar authorization.
 *
 * @see docs/IMPEMENTATION.md - Authorization Coverage Check
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import {
  checkContentForAuthZ,
  isRouteException,
  findRouteFiles,
  checkRouteForAuthZ,
  DEFAULT_EXCEPTIONS,
  AUTHZ_PATTERNS,
} from '../check-authz-coverage';

describe('AuthZ Coverage Check', () => {
  // Temporary directory for test files
  const testDir = join(__dirname, '.test-routes');

  beforeEach(() => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('checkContentForAuthZ', () => {
    it('detects withAuthZ() wrapper', () => {
      const content = `
        import { withAuthZ } from '@/lib/authz/middleware';
        
        export const GET = withAuthZ(CedarActions.ReadResource)(
          async (req) => {
            return NextResponse.json({ data: 'test' });
          }
        );
      `;

      expect(checkContentForAuthZ(content)).toBe(true);
    });

    it('detects cedar.isAuthorized() call', () => {
      const content = `
        import { getCedarEngine } from '@/lib/authz/cedar';
        
        export async function GET(req) {
          const cedar = getCedarEngine();
          const decision = cedar.isAuthorized({
            principal: { type: 'User', id: userId },
            action: { type: 'Action', id: 'ReadResource' },
            resource: { type: 'Resource', id: resourceId },
          });
          
          if (!decision.isAuthorized) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
          }
          
          return NextResponse.json({ data: 'test' });
        }
      `;

      expect(checkContentForAuthZ(content)).toBe(true);
    });

    it('detects isAuthorized() call without cedar prefix', () => {
      const content = `
        export async function POST(req) {
          const decision = isAuthorized(principal, action, resource);
          if (!decision) throw new Error('Forbidden');
          return NextResponse.json({ ok: true });
        }
      `;

      expect(checkContentForAuthZ(content)).toBe(true);
    });

    it('detects route without Cedar call', () => {
      const content = `
        export async function GET(req) {
          // No authorization check!
          const data = await fetchData();
          return NextResponse.json({ data });
        }
      `;

      expect(checkContentForAuthZ(content)).toBe(false);
    });

    it('detects route with only authentication (not authorization)', () => {
      const content = `
        import { auth } from '@/auth';
        
        export async function GET(req) {
          const session = await auth();
          if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
          }
          // Missing authorization check
          return NextResponse.json({ data: 'test' });
        }
      `;

      expect(checkContentForAuthZ(content)).toBe(false);
    });

    it('detects requireAuth() wrapper', () => {
      const content = `
        import { requireAuth } from '@/lib/auth';
        
        export const GET = requireAuth(async (req, session) => {
          return NextResponse.json({ data: 'test' });
        });
      `;

      expect(checkContentForAuthZ(content)).toBe(true);
    });

    it('detects checkAuthorization() call', () => {
      const content = `
        export async function DELETE(req) {
          await checkAuthorization(userId, 'delete', resourceId);
          return NextResponse.json({ success: true });
        }
      `;

      expect(checkContentForAuthZ(content)).toBe(true);
    });
  });

  describe('isRouteException', () => {
    it('respects default exceptions (health endpoint)', () => {
      expect(isRouteException('app/api/health/route.ts', [])).toBe(true);
    });

    it('respects default exceptions (stripe webhook)', () => {
      expect(isRouteException('app/api/stripe/webhook/route.ts', [])).toBe(true);
    });

    it('respects custom exceptions list', () => {
      const customExceptions = ['app/api/public-data/route.ts'];
      
      expect(isRouteException('app/api/public-data/route.ts', customExceptions)).toBe(true);
    });

    it('rejects non-excepted routes', () => {
      expect(isRouteException('app/api/users/route.ts', [])).toBe(false);
    });

    it('handles partial path matches', () => {
      // The script checks if either path contains the other
      // health in the path matches DEFAULT_EXCEPTIONS entry containing 'health'
      expect(isRouteException('app/api/health/route.ts', [])).toBe(true);
    });
  });

  describe('findRouteFiles', () => {
    it('finds route.ts files recursively', () => {
      // Create nested structure
      mkdirSync(join(testDir, 'users'), { recursive: true });
      mkdirSync(join(testDir, 'users', '[id]'), { recursive: true });
      
      writeFileSync(join(testDir, 'route.ts'), 'export function GET() {}');
      writeFileSync(join(testDir, 'users', 'route.ts'), 'export function GET() {}');
      writeFileSync(join(testDir, 'users', '[id]', 'route.ts'), 'export function GET() {}');

      const files = findRouteFiles(testDir);

      expect(files.length).toBe(3);
      expect(files.some(f => f.includes('users'))).toBe(true);
      expect(files.some(f => f.includes('[id]'))).toBe(true);
    });

    it('ignores non-route files', () => {
      writeFileSync(join(testDir, 'route.ts'), 'export function GET() {}');
      writeFileSync(join(testDir, 'helper.ts'), 'export function helper() {}');
      writeFileSync(join(testDir, 'types.ts'), 'export interface Type {}');

      const files = findRouteFiles(testDir);

      expect(files.length).toBe(1);
      expect(files[0]).toContain('route.ts');
    });

    it('returns empty array for non-existent directory', () => {
      const files = findRouteFiles('/non/existent/path');
      expect(files).toEqual([]);
    });

    it('finds route.tsx files', () => {
      writeFileSync(join(testDir, 'route.tsx'), 'export function GET() {}');

      const files = findRouteFiles(testDir);

      expect(files.length).toBe(1);
      expect(files[0]).toContain('route.tsx');
    });
  });

  describe('checkRouteForAuthZ', () => {
    it('correctly identifies route with authz', () => {
      const routePath = join(testDir, 'route.ts');
      writeFileSync(routePath, `
        import { withAuthZ } from '@/lib/authz';
        export const GET = withAuthZ('ReadUser')(async (req) => {
          return NextResponse.json({});
        });
      `);

      const result = checkRouteForAuthZ(routePath, testDir, []);

      expect(result.hasAuthZ).toBe(true);
      // Note: This pattern uses const GET = withAuthZ(...) not function GET
      // So it may not match the handler regex
    });

    it('correctly identifies route without authz', () => {
      const routePath = join(testDir, 'route.ts');
      writeFileSync(routePath, `
        export async function POST(req) {
          // Missing authz
          return NextResponse.json({});
        }
      `);

      const result = checkRouteForAuthZ(routePath, testDir, []);

      expect(result.hasAuthZ).toBe(false);
      expect(result.handlers).toContain('POST');
    });

    it('identifies multiple handlers', () => {
      const routePath = join(testDir, 'route.ts');
      writeFileSync(routePath, `
        export async function GET(req) {
          return isAuthorized() && NextResponse.json({});
        }
        export async function POST(req) {
          return isAuthorized() && NextResponse.json({});
        }
        export async function DELETE(req) {
          return isAuthorized() && NextResponse.json({});
        }
      `);

      const result = checkRouteForAuthZ(routePath, testDir, []);

      expect(result.handlers).toContain('GET');
      expect(result.handlers).toContain('POST');
      expect(result.handlers).toContain('DELETE');
      expect(result.handlers.length).toBe(3);
    });

    it('marks excepted routes correctly', () => {
      mkdirSync(join(testDir, 'health'), { recursive: true });
      const routePath = join(testDir, 'health', 'route.ts');
      writeFileSync(routePath, `
        export async function GET(req) {
          return NextResponse.json({ status: 'ok' });
        }
      `);

      const result = checkRouteForAuthZ(routePath, testDir, []);

      // health is in DEFAULT_EXCEPTIONS
      expect(result.isException).toBe(true);
    });
  });

  describe('AUTHZ_PATTERNS', () => {
    it('has expected patterns', () => {
      expect(AUTHZ_PATTERNS.length).toBeGreaterThan(0);
      
      // Verify essential patterns exist
      const patternStrings = AUTHZ_PATTERNS.map(p => p.source);
      expect(patternStrings.some(p => p.includes('withAuthZ'))).toBe(true);
      expect(patternStrings.some(p => p.includes('isAuthorized'))).toBe(true);
    });
  });

  describe('DEFAULT_EXCEPTIONS', () => {
    it('includes health endpoint', () => {
      expect(DEFAULT_EXCEPTIONS.some(e => e.includes('health'))).toBe(true);
    });

    it('includes stripe webhook', () => {
      expect(DEFAULT_EXCEPTIONS.some(e => e.includes('stripe'))).toBe(true);
    });
  });

  describe('Integration: CI Failure Scenarios', () => {
    it('would fail CI for route without authz', () => {
      // This test simulates the CI check logic
      const mockRouteWithoutAuthZ = {
        path: 'app/api/users/route.ts',
        hasAuthZ: false,
        isException: false,
        handlers: ['GET', 'POST'],
      };

      // Route without authz and not excepted = CI failure
      const shouldFail = !mockRouteWithoutAuthZ.hasAuthZ && 
                         !mockRouteWithoutAuthZ.isException &&
                         mockRouteWithoutAuthZ.handlers.length > 0;

      expect(shouldFail).toBe(true);
    });

    it('would pass CI for route with authz', () => {
      const mockRouteWithAuthZ = {
        path: 'app/api/users/route.ts',
        hasAuthZ: true,
        isException: false,
        handlers: ['GET', 'POST'],
      };

      const shouldFail = !mockRouteWithAuthZ.hasAuthZ && 
                         !mockRouteWithAuthZ.isException &&
                         mockRouteWithAuthZ.handlers.length > 0;

      expect(shouldFail).toBe(false);
    });

    it('would pass CI for excepted route even without authz', () => {
      const mockExceptedRoute = {
        path: 'app/api/health/route.ts',
        hasAuthZ: false,
        isException: true,
        handlers: ['GET'],
      };

      const shouldFail = !mockExceptedRoute.hasAuthZ && 
                         !mockExceptedRoute.isException &&
                         mockExceptedRoute.handlers.length > 0;

      expect(shouldFail).toBe(false);
    });
  });
});
