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
const AUTHZ_PATTERNS = [
  /withAuthZ\s*\(/,
  /cedar\.isAuthorized\s*\(/,
  /isAuthorized\s*\(/,
  /requireAuth\s*\(/,
  /checkAuthorization\s*\(/,
];

// Route handlers to check
const ROUTE_HANDLERS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// Load exceptions list
const EXCEPTIONS_FILE = 'authz-exceptions.json';
let exceptions: string[] = [];

if (existsSync(EXCEPTIONS_FILE)) {
  exceptions = JSON.parse(readFileSync(EXCEPTIONS_FILE, 'utf-8'));
}

// Default exceptions for public endpoints
const DEFAULT_EXCEPTIONS = [
  'app/api/health/route.ts',
  'app/api/stripe/webhook/route.ts', // Verified by Stripe signature
];

const allExceptions = [...DEFAULT_EXCEPTIONS, ...exceptions];

interface RouteCheckResult {
  path: string;
  hasAuthZ: boolean;
  isException: boolean;
  handlers: string[];
}

function findRouteFiles(dir: string): string[] {
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

function checkRouteForAuthZ(filePath: string): RouteCheckResult {
  const content = readFileSync(filePath, 'utf-8');
  const relativePath = relative(process.cwd(), filePath);

  // Find which handlers are exported
  const handlers = ROUTE_HANDLERS.filter((handler) =>
    new RegExp(`export\\s+(async\\s+)?function\\s+${handler}\\b`).test(content)
  );

  // Check if any authZ pattern is present
  const hasAuthZ = AUTHZ_PATTERNS.some((pattern) => pattern.test(content));

  // Check if this route is in exceptions list
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

function main() {
  console.log('🔍 Checking AuthZ coverage for all API routes...\n');

  const apiDir = join(process.cwd(), 'app', 'api');
  const routeFiles = findRouteFiles(apiDir);

  if (routeFiles.length === 0) {
    console.log('⚠️  No API routes found in app/api/');
    process.exit(0);
  }

  const results = routeFiles.map(checkRouteForAuthZ);

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
  const exceptions = results.filter((r) => r.isException && r.handlers.length > 0);
  const missing = results.filter(
    (r) => !r.hasAuthZ && !r.isException && r.handlers.length > 0
  );

  console.log(`Total routes: ${results.filter((r) => r.handlers.length > 0).length}`);
  console.log(`✅ With AuthZ: ${covered.length}`);
  console.log(`⏭️  Exceptions: ${exceptions.length}`);
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

main();
