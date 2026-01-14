#!/usr/bin/env tsx
/**
 * AuthZ Coverage Check Script
 *
 * Scans all API routes and verifies each has a Cedar authorization call.
 * Fails CI if any route is missing authorization.
 *
 * Usage: pnpm test:authz-coverage
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

// Patterns that indicate Cedar authorization is present
export const AUTHZ_PATTERNS = [
  /withAuthZ\s*\(/,
  /cedar\.isAuthorized\s*\(/,
  /isAuthorized\s*\(/,
  /requireAuth\s*\(/,
  /checkAuthorization\s*\(/,
];

// Route handlers to check
export const ROUTE_HANDLERS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// Default exceptions for public endpoints
export const DEFAULT_EXCEPTIONS = [
  'app/api/health/route.ts',
  'app/api/stripe/webhook/route.ts', // Verified by Stripe signature
];

export interface RouteCheckResult {
  path: string;
  hasAuthZ: boolean;
  isException: boolean;
  handlers: string[];
}

/**
 * Load exceptions from file if exists
 */
export function loadExceptions(exceptionsFile: string): string[] {
  if (existsSync(exceptionsFile)) {
    return JSON.parse(readFileSync(exceptionsFile, 'utf-8'));
  }
  return [];
}

/**
 * Recursively find all route.ts files
 */
export function findRouteFiles(dir: string): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) {
    return files;
  }

  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findRouteFiles(fullPath));
    } else if (entry === 'route.ts' || entry === 'route.tsx') {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check if a route file has Cedar authorization
 */
export function checkRouteForAuthZ(
  filePath: string,
  basePath: string,
  exceptions: string[]
): RouteCheckResult {
  const content = readFileSync(filePath, 'utf-8');
  const relativePath = relative(basePath, filePath);

  // Find which handlers are exported
  const handlers = ROUTE_HANDLERS.filter((handler) =>
    new RegExp(`export\\s+(async\\s+)?function\\s+${handler}\\b`).test(content)
  );

  // Check if any authZ pattern is present
  const hasAuthZ = AUTHZ_PATTERNS.some((pattern) => pattern.test(content));

  // Check if this route is in exceptions list
  const allExceptions = [...DEFAULT_EXCEPTIONS, ...exceptions];
  const isException = allExceptions.some(
    (exception) =>
      relativePath.includes(exception) || exception.includes(relativePath)
  );

  return {
    path: relativePath,
    hasAuthZ,
    isException,
    handlers,
  };
}

/**
 * Check content string directly (for testing)
 */
export function checkContentForAuthZ(content: string): boolean {
  return AUTHZ_PATTERNS.some((pattern) => pattern.test(content));
}

/**
 * Check if a route should be excepted
 */
export function isRouteException(
  relativePath: string,
  exceptions: string[]
): boolean {
  const allExceptions = [...DEFAULT_EXCEPTIONS, ...exceptions];
  return allExceptions.some(
    (exception) =>
      relativePath.includes(exception) || exception.includes(relativePath)
  );
}

/**
 * Main function
 */
export function main() {
  console.log('🔍 Checking AuthZ coverage for all API routes...\n');

  const basePath = process.cwd();
  const apiDir = join(basePath, 'app', 'api');
  const routeFiles = findRouteFiles(apiDir);
  const exceptions = loadExceptions('authz-exceptions.json');

  if (routeFiles.length === 0) {
    console.log('⚠️  No API routes found in app/api/');
    process.exit(0);
  }

  const results = routeFiles.map((file) =>
    checkRouteForAuthZ(file, basePath, exceptions)
  );

  let hasErrors = false;

  // Report results
  console.log('Results:\n');

  for (const result of results) {
    if (result.handlers.length === 0) {
      continue; // Skip files without route handlers
    }

    if (result.isException) {
      console.log(`⏭️  ${result.path} (exception - skipped)`);
    } else if (result.hasAuthZ) {
      console.log(`✅ ${result.path}`);
    } else {
      console.log(`❌ ${result.path} - MISSING AUTHZ`);
      console.log(`   Handlers: ${result.handlers.join(', ')}`);
      hasErrors = true;
    }
  }

  // Summary
  console.log('\n--- Summary ---');
  const covered = results.filter((r) => r.hasAuthZ && r.handlers.length > 0);
  const exceptedRoutes = results.filter((r) => r.isException && r.handlers.length > 0);
  const missing = results.filter(
    (r) => !r.hasAuthZ && !r.isException && r.handlers.length > 0
  );

  console.log(`Total routes: ${results.filter((r) => r.handlers.length > 0).length}`);
  console.log(`✅ With AuthZ: ${covered.length}`);
  console.log(`⏭️  Exceptions: ${exceptedRoutes.length}`);
  console.log(`❌ Missing AuthZ: ${missing.length}`);

  if (hasErrors) {
    console.log(
      '\n❌ AuthZ coverage check FAILED. Add Cedar authorization to the routes above.'
    );
    console.log(
      'If a route is intentionally public, add it to authz-exceptions.json'
    );
    process.exit(1);
  } else {
    console.log('\n✅ All API routes have AuthZ coverage!');
    process.exit(0);
  }
}

// Only run main if this is the entry point
if (require.main === module) {
  main();
}
