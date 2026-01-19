#!/usr/bin/env tsx
/**
 * Component Usage Check Script
 *
 * ⚠️  MANDATORY CHECK - This check is BLOCKING in CI/CD.
 * All UI components must use shared Radix UI primitives.
 *
 * Scans UI components and flags direct HTML elements that should use
 * shared Radix UI primitives from @expert-ai/ui.
 *
 * Exceptions:
 * - Test files (mock components legitimately use raw HTML)
 * - Hidden file inputs (invisible, programmatically triggered)
 * - components/ui/* (the shared implementations themselves)
 *
 * Usage: pnpm test:component-usage
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative } from "path";

// Native HTML elements that should use shared components
export const FLAGGED_ELEMENTS = [
  { element: "<button", replacement: "<Button> from @/components/ui/button" },
  { element: "<input", replacement: "<Input> from @/components/ui/input" },
  { element: "<select", replacement: "<Select> from @/components/ui/select" },
  { element: "<dialog", replacement: "<Dialog> from @/components/ui/dialog" },
  {
    element: "<textarea",
    replacement: "<Textarea> from @/components/ui/textarea",
  },
];

// Directories to skip
export const SKIP_DIRS = ["node_modules", ".next", "dist", ".git"];

// Files to skip (shared component implementations and test files with mocks)
export const SKIP_FILES = [
  "components/ui/",
  ".test.tsx",
  ".test.ts",
  "__tests__/",
];

export interface Violation {
  file: string;
  line: number;
  element: string;
  replacement: string;
}

/**
 * Find all component files (.tsx, .jsx) recursively
 */
export function findComponentFiles(dir: string): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) {
    return files;
  }

  const entries = readdirSync(dir);

  for (const entry of entries) {
    if (SKIP_DIRS.includes(entry)) continue;

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findComponentFiles(fullPath));
    } else if (entry.endsWith(".tsx") || entry.endsWith(".jsx")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check a file for component violations
 */
export function checkFile(filePath: string, basePath: string): Violation[] {
  const relativePath = relative(basePath, filePath);

  // Skip shared component implementations
  if (SKIP_FILES.some((skip) => relativePath.includes(skip))) {
    return [];
  }

  const content = readFileSync(filePath, "utf-8");
  return checkContent(content, relativePath);
}

/**
 * Check content string for violations (for testing)
 */
export function checkContent(content: string, filePath: string): Violation[] {
  const lines = content.split("\n");
  const violations: Violation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const { element, replacement } of FLAGGED_ELEMENTS) {
      // Skip if it's a comment
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) {
        continue;
      }

      // Skip hidden file inputs - these are intentionally raw HTML
      // because they're invisible and programmatically triggered
      // Check: on same line, or previous line has comment marker, or next lines have hidden+file
      if (element === "<input") {
        // Check same line (single-line hidden file input)
        if (
          line.includes('type="file"') &&
          line.includes('className="hidden"')
        ) {
          continue;
        }

        // Check if previous line has hidden file input comment
        const prevLine = i > 0 ? lines[i - 1] : "";
        if (prevLine.toLowerCase().includes("hidden file input")) {
          continue;
        }

        // Check if this is a multi-line input with type="file" and className="hidden"
        // Look ahead at the next 10 lines for the closing tag and attributes
        const nextLines = lines
          .slice(i, Math.min(i + 12, lines.length))
          .join("\n");
        if (
          line.includes("<input") &&
          nextLines.includes('type="file"') &&
          nextLines.includes('className="hidden"') &&
          nextLines.includes("/>")
        ) {
          continue;
        }
      }

      // Check for the element usage
      if (line.includes(element)) {
        violations.push({
          file: filePath,
          line: i + 1,
          element: element.replace("<", ""),
          replacement,
        });
      }
    }
  }

  return violations;
}

/**
 * Get violation count by file
 */
export function countViolationsByFile(
  violations: Violation[],
): Map<string, number> {
  const byFile = new Map<string, number>();
  for (const v of violations) {
    byFile.set(v.file, (byFile.get(v.file) || 0) + 1);
  }
  return byFile;
}

/**
 * Main function
 */
export function main() {
  console.log("🔍 Checking component usage for shared primitives...\n");

  const basePath = process.cwd();
  const srcDirs = ["app", "components", "src"];
  let allFiles: string[] = [];

  for (const dir of srcDirs) {
    const dirPath = join(basePath, dir);
    if (existsSync(dirPath)) {
      allFiles = [...allFiles, ...findComponentFiles(dirPath)];
    }
  }

  if (allFiles.length === 0) {
    console.log("⚠️  No component files found");
    process.exit(0);
  }

  const allViolations: Violation[] = [];

  for (const file of allFiles) {
    const violations = checkFile(file, basePath);
    allViolations.push(...violations);
  }

  // Group by file
  const byFile = new Map<string, Violation[]>();
  for (const v of allViolations) {
    if (!byFile.has(v.file)) {
      byFile.set(v.file, []);
    }
    byFile.get(v.file)!.push(v);
  }

  // Report
  if (allViolations.length === 0) {
    console.log("✅ All components using shared primitives!");
    process.exit(0);
  }

  console.log(
    "⚠️  Found raw HTML elements that could use shared components:\n",
  );

  for (const [file, violations] of byFile) {
    console.log(
      `📄 ${file} (${violations.length} issue${violations.length > 1 ? "s" : ""})`,
    );
    for (const v of violations) {
      console.log(`   Line ${v.line}: <${v.element}> → use ${v.replacement}`);
    }
    console.log();
  }

  // Summary
  console.log("--- Summary ---");
  console.log(`Files with issues: ${byFile.size}`);
  console.log(`Total issues: ${allViolations.length}`);
  console.log("\n❌ BLOCKING: This check must pass before commit.");
  console.log("Use shared components from @/components/ui/ for consistency.");

  // Exit 1 to block CI/CD - this is a MANDATORY check
  process.exit(1);
}

// Only run main if this is the entry point
if (require.main === module) {
  main();
}
