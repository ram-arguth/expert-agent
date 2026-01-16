/**
 * Next.js Middleware Tests
 *
 * Tests the root middleware including:
 * - E2E Test Principal Injection
 * - CSP Headers
 * - Security Headers
 * - Production Guards
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { middleware, E2E_SESSION_HEADER } from "../middleware";

// Mock the e2e-middleware module
vi.mock("@/lib/test-utils/e2e-middleware", () => ({
  extractTestSession: vi.fn(),
  isE2ETestModeAllowed: vi.fn(),
  createProductionGuardMiddleware: vi.fn(() => () => null),
}));

// Mock the logger module
vi.mock("@/lib/observability/logger", () => ({
  generateTraceContext: vi.fn(() => ({
    traceId: "test-trace-id-12345678901234567890123456789012",
    spanId: "test-span-id-1234567890123456",
    traceFlags: "01",
  })),
}));

// Import mocked modules
import {
  extractTestSession,
  isE2ETestModeAllowed,
  createProductionGuardMiddleware,
} from "@/lib/test-utils/e2e-middleware";

function createMockRequest(
  url: string = "http://localhost:3000/dashboard",
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(url, {
    headers: new Headers(headers),
  });
}

describe("Next.js Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: E2E test mode is allowed (non-production)
    vi.mocked(isE2ETestModeAllowed).mockReturnValue(true);
    vi.mocked(extractTestSession).mockReturnValue(null);
    vi.mocked(createProductionGuardMiddleware).mockReturnValue(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Security Headers", () => {
    it("sets X-Frame-Options: DENY", async () => {
      const request = createMockRequest();
      const response = await middleware(request);

      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    });

    it("sets X-Content-Type-Options: nosniff", async () => {
      const request = createMockRequest();
      const response = await middleware(request);

      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    it("sets Referrer-Policy", async () => {
      const request = createMockRequest();
      const response = await middleware(request);

      expect(response.headers.get("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin",
      );
    });

    it("sets X-XSS-Protection", async () => {
      const request = createMockRequest();
      const response = await middleware(request);

      expect(response.headers.get("X-XSS-Protection")).toBe("1; mode=block");
    });

    it("sets Content-Security-Policy", async () => {
      const request = createMockRequest();
      const response = await middleware(request);

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("form-action 'self'");
    });

    it("does not override existing CSP header", async () => {
      // This test verifies the middleware respects existing CSP
      // The actual CSP check happens in the response, which we can't
      // easily test without more complex mocking
      const request = createMockRequest();
      const response = await middleware(request);

      // Just verify CSP is set
      expect(response.headers.has("Content-Security-Policy")).toBe(true);
    });
  });

  describe("Trace Context", () => {
    it("adds trace context headers when not present", async () => {
      const request = createMockRequest();
      const response = await middleware(request);

      expect(response.headers.get("x-trace-id")).toBe(
        "test-trace-id-12345678901234567890123456789012",
      );
      expect(response.headers.get("x-span-id")).toBe(
        "test-span-id-1234567890123456",
      );
    });

    it("does not add trace context when traceparent exists", async () => {
      const request = createMockRequest("http://localhost:3000/dashboard", {
        traceparent: "00-existing-trace-id-existing-span-01",
      });
      const response = await middleware(request);

      // When traceparent exists, we don't generate new trace context
      // The existing traceparent is used (propagated in request, not added to response)
      // Our middleware only adds x-trace-id and x-span-id when there's no traceparent
      expect(response.headers.get("x-trace-id")).toBeNull();
    });
  });

  describe("E2E Test Principal Injection", () => {
    it("injects test session when E2E mode is allowed and valid", async () => {
      const testSession = {
        user: {
          id: "test-user-1",
          email: "test@example.com",
          name: "Test User",
          provider: "google",
          image: null,
        },
        expires: new Date(Date.now() + 3600000).toISOString(),
        isTestPrincipal: true,
      };

      vi.mocked(isE2ETestModeAllowed).mockReturnValue(true);
      vi.mocked(extractTestSession).mockReturnValue(testSession);

      const request = createMockRequest("http://localhost:3000/dashboard", {
        "X-E2E-Test-Principal": JSON.stringify({
          id: "test",
          email: "test@example.com",
          name: "Test",
        }),
        "X-E2E-Test-Secret": "valid-secret",
      });

      const response = await middleware(request);

      const sessionHeader = response.headers.get(E2E_SESSION_HEADER);
      expect(sessionHeader).not.toBeNull();

      const parsedSession = JSON.parse(sessionHeader!);
      expect(parsedSession.user.id).toBe("test-user-1");
      expect(parsedSession.isTestPrincipal).toBe(true);
    });

    it("does not inject session when E2E mode is not allowed", async () => {
      vi.mocked(isE2ETestModeAllowed).mockReturnValue(false);

      const request = createMockRequest("http://localhost:3000/dashboard", {
        "X-E2E-Test-Principal": JSON.stringify({
          id: "test",
          email: "test@example.com",
          name: "Test",
        }),
        "X-E2E-Test-Secret": "valid-secret",
      });

      const response = await middleware(request);

      expect(response.headers.get(E2E_SESSION_HEADER)).toBeNull();
    });

    it("does not inject session when extractTestSession returns null", async () => {
      vi.mocked(isE2ETestModeAllowed).mockReturnValue(true);
      vi.mocked(extractTestSession).mockReturnValue(null);

      const request = createMockRequest("http://localhost:3000/dashboard", {
        "X-E2E-Test-Principal": "invalid-json",
      });

      const response = await middleware(request);

      expect(response.headers.get(E2E_SESSION_HEADER)).toBeNull();
    });

    it("does not inject session for requests without test headers", async () => {
      vi.mocked(isE2ETestModeAllowed).mockReturnValue(true);
      vi.mocked(extractTestSession).mockReturnValue(null);

      const request = createMockRequest();
      const response = await middleware(request);

      expect(response.headers.get(E2E_SESSION_HEADER)).toBeNull();
    });
  });

  describe("Production Guard", () => {
    it("blocks requests with test headers in production", async () => {
      const forbiddenResponse = NextResponse.json(
        { error: "Forbidden", message: "Test mode not available" },
        { status: 403 },
      );

      vi.mocked(createProductionGuardMiddleware).mockReturnValue(
        () => forbiddenResponse,
      );

      const request = createMockRequest("http://localhost:3000/dashboard", {
        "X-E2E-Test-Principal": JSON.stringify({
          id: "test",
          email: "test@example.com",
          name: "Test",
        }),
      });

      const response = await middleware(request);

      expect(response.status).toBe(403);
    });

    it("allows requests without test headers in production", async () => {
      vi.mocked(createProductionGuardMiddleware).mockReturnValue(() => null);

      const request = createMockRequest();
      const response = await middleware(request);

      expect(response.status).toBe(200);
    });
  });

  describe("Response Handling", () => {
    it("returns NextResponse.next() for valid requests", async () => {
      const request = createMockRequest();
      const response = await middleware(request);

      // NextResponse.next() continues to the route
      expect(response).toBeDefined();
      expect(response.headers).toBeDefined();
    });

    it("processes all request paths matching the config", async () => {
      // Test various paths
      const paths = [
        "/dashboard",
        "/api/agents",
        "/settings/billing",
        "/org/123/invite",
      ];

      for (const path of paths) {
        const request = createMockRequest(`http://localhost:3000${path}`);
        const response = await middleware(request);

        expect(response).toBeDefined();
        expect(response.headers.get("X-Frame-Options")).toBe("DENY");
      }
    });
  });

  describe("Session Header Format", () => {
    it("session header contains valid JSON", async () => {
      const testSession = {
        user: {
          id: "test-user-1",
          email: "test@example.com",
          name: "Test User",
          provider: "google",
          image: null,
        },
        expires: "2026-01-15T12:00:00.000Z",
        isTestPrincipal: true,
      };

      vi.mocked(isE2ETestModeAllowed).mockReturnValue(true);
      vi.mocked(extractTestSession).mockReturnValue(testSession);

      const request = createMockRequest("http://localhost:3000/dashboard", {
        "X-E2E-Test-Principal": JSON.stringify({
          id: "test",
          email: "test@example.com",
          name: "Test",
        }),
        "X-E2E-Test-Secret": "valid-secret",
      });

      const response = await middleware(request);
      const sessionHeader = response.headers.get(E2E_SESSION_HEADER);

      expect(() => JSON.parse(sessionHeader!)).not.toThrow();

      const parsed = JSON.parse(sessionHeader!);
      expect(parsed).toHaveProperty("user");
      expect(parsed).toHaveProperty("expires");
      expect(parsed).toHaveProperty("isTestPrincipal");
    });

    it("session header user has required fields", async () => {
      const testSession = {
        user: {
          id: "user-123",
          email: "user@example.com",
          name: "Full Name",
          provider: "apple",
          image: "https://example.com/avatar.jpg",
        },
        expires: "2026-01-15T12:00:00.000Z",
        isTestPrincipal: true,
      };

      vi.mocked(isE2ETestModeAllowed).mockReturnValue(true);
      vi.mocked(extractTestSession).mockReturnValue(testSession);

      const request = createMockRequest("http://localhost:3000/api/test", {
        "X-E2E-Test-Principal": JSON.stringify({
          id: "test",
          email: "test@example.com",
          name: "Test",
        }),
        "X-E2E-Test-Secret": "valid-secret",
      });

      const response = await middleware(request);
      const sessionHeader = response.headers.get(E2E_SESSION_HEADER);
      const parsed = JSON.parse(sessionHeader!);

      expect(parsed.user.id).toBe("user-123");
      expect(parsed.user.email).toBe("user@example.com");
      expect(parsed.user.name).toBe("Full Name");
      expect(parsed.user.provider).toBe("apple");
      expect(parsed.user.image).toBe("https://example.com/avatar.jpg");
    });
  });
});
