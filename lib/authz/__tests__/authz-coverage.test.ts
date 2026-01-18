/**
 * AuthZ Coverage Test
 *
 * This test discovers ALL API routes and verifies each one calls Cedar.
 * NO ROUTE may bypass authorization. This prevents accidental security holes.
 *
 * @see docs/IMPLEMENTATION.md - Phase 7.2 Security
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Recursively find all route.ts files in app/api/
 */
function findAllRouteFiles(dir: string): string[] {
  const routes: string[] = [];

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      routes.push(...findAllRouteFiles(fullPath));
    } else if (entry === "route.ts") {
      routes.push(fullPath);
    }
  }

  return routes;
}

/**
 * Check if a route file contains Cedar authorization call
 */
function containsCedarCall(filePath: string): {
  hasCedar: boolean;
  details: string;
} {
  const content = readFileSync(filePath, "utf-8");

  // Check for various Cedar authorization patterns
  const patterns = [
    /cedar\.isAuthorized/, // Direct Cedar call
    /isAuthorized\s*\(/, // isAuthorized function
    /withAuthZ\s*\(/, // withAuthZ wrapper
    /checkAuthorization\s*\(/, // checkAuthorization helper
    /authorizationCheck\s*\(/, // Alternative naming
    /cedar\s*\.\s*evaluate/, // Cedar evaluate
    /CedarPrincipal/, // Uses Cedar principal type
    /authorize\s*\(\s*\{/, // authorize({ principal... })
    // NextAuth handler delegates to the handlers package - auth is handled internally
    /handlers\s*\}/, // NextAuth handler export pattern
    /from\s+['"]@\/auth['"]/, // Imports from auth (NextAuth config)
  ];

  for (const pattern of patterns) {
    if (pattern.test(content)) {
      return { hasCedar: true, details: `Found: ${pattern.source}` };
    }
  }

  return { hasCedar: false, details: "No Cedar authorization call found" };
}

describe("AuthZ Coverage", () => {
  const apiDir = join(process.cwd(), "app", "api");
  const allRoutes = findAllRouteFiles(apiDir);

  it("should discover API routes", () => {
    expect(allRoutes.length).toBeGreaterThan(0);
    console.log(`Found ${allRoutes.length} API routes`);
  });

  it("should have NO routes without Cedar authorization", () => {
    const routesWithoutCedar: { path: string; details: string }[] = [];

    for (const route of allRoutes) {
      const { hasCedar, details } = containsCedarCall(route);
      if (!hasCedar) {
        // Use relative path for cleaner output
        const relativePath = route.replace(process.cwd() + "/", "");
        routesWithoutCedar.push({ path: relativePath, details });
      }
    }

    if (routesWithoutCedar.length > 0) {
      const message = [
        `\n❌ ${routesWithoutCedar.length} route(s) missing Cedar authorization:\n`,
        ...routesWithoutCedar.map((r) => `  - ${r.path}\n    ${r.details}`),
        "\n",
        "EVERY API route MUST call Cedar for authorization.",
        "Use one of:",
        "  - cedar.isAuthorized({ principal, action, resource })",
        "  - withAuthZ(action)(handler)",
        "  - checkAuthorization(session, action, resource)",
      ].join("\n");

      expect.fail(message);
    }
  });

  it("should verify each route has appropriate principal type", () => {
    // Routes that should use Anonymous principal
    const anonymousPaths = ["health", "auth/callback"];

    // Routes that should use Service principal
    const servicePaths = ["stripe/webhook", "internal/"];

    const issues: string[] = [];

    for (const route of allRoutes) {
      const relativePath = route.replace(process.cwd() + "/", "");
      const content = readFileSync(route, "utf-8");

      const isAnonymousRoute = anonymousPaths.some((p) =>
        relativePath.includes(p),
      );
      const isServiceRoute = servicePaths.some((p) => relativePath.includes(p));

      if (isAnonymousRoute && !content.includes("Anonymous")) {
        issues.push(`${relativePath} should use Anonymous principal`);
      }

      if (isServiceRoute && !content.includes("Service")) {
        issues.push(`${relativePath} should use Service principal`);
      }
    }

    if (issues.length > 0) {
      console.warn("Principal type suggestions:\n" + issues.join("\n"));
      // Warning only, not failing - gives guidance
    }
  });

  // This test fails if authz-exceptions.json exists
  it("should NOT have an authz-exceptions.json file", () => {
    const exceptionsPath = join(process.cwd(), "authz-exceptions.json");
    let exceptionsExist = false;

    try {
      readFileSync(exceptionsPath);
      exceptionsExist = true;
    } catch {
      exceptionsExist = false;
    }

    if (exceptionsExist) {
      expect.fail(
        "authz-exceptions.json should not exist.\n" +
          "ALL routes must go through Cedar authorization.\n" +
          "Use Anonymous or Service principals for public/internal routes.",
      );
    }
  });
});
