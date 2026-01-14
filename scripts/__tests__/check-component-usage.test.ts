/**
 * Component Usage Check Script Tests
 *
 * Tests for the component usage check script that flags
 * raw HTML elements that should use shared components.
 *
 * @see docs/IMPEMENTATION.md - Shared Component Usage Check
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import {
  checkContent,
  findComponentFiles,
  checkFile,
  countViolationsByFile,
  FLAGGED_ELEMENTS,
  SKIP_FILES,
} from '../check-component-usage';

describe('Component Usage Check', () => {
  // Temporary directory for test files
  const testDir = join(__dirname, '.test-components');

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

  describe('checkContent', () => {
    it('flags <button> usage in component file', () => {
      const content = `
        export function MyComponent() {
          return (
            <div>
              <button onClick={handleClick}>Click me</button>
            </div>
          );
        }
      `;

      const violations = checkContent(content, 'test.tsx');

      expect(violations.length).toBe(1);
      expect(violations[0].element).toBe('button');
      expect(violations[0].line).toBe(5);
    });

    it('passes <Button> from shared library', () => {
      const content = `
        import { Button } from '@/components/ui/button';
        
        export function MyComponent() {
          return (
            <div>
              <Button onClick={handleClick}>Click me</Button>
            </div>
          );
        }
      `;

      const violations = checkContent(content, 'test.tsx');

      expect(violations.length).toBe(0);
    });

    it('flags <input type="text"> without shared wrapper', () => {
      const content = `
        export function Form() {
          return (
            <form>
              <input type="text" placeholder="Name" />
              <input type="email" placeholder="Email" />
            </form>
          );
        }
      `;

      const violations = checkContent(content, 'test.tsx');

      expect(violations.length).toBe(2);
      expect(violations.every(v => v.element === 'input')).toBe(true);
    });

    it('flags <select> element', () => {
      const content = `
        export function Dropdown() {
          return (
            <select value={value} onChange={handleChange}>
              <option value="1">One</option>
              <option value="2">Two</option>
            </select>
          );
        }
      `;

      const violations = checkContent(content, 'test.tsx');

      expect(violations.length).toBe(1);
      expect(violations[0].element).toBe('select');
    });

    it('flags <textarea> element', () => {
      const content = `
        export function TextArea() {
          return <textarea rows={4} />;
        }
      `;

      const violations = checkContent(content, 'test.tsx');

      expect(violations.length).toBe(1);
      expect(violations[0].element).toBe('textarea');
    });

    it('ignores comments with flagged elements', () => {
      const content = `
        // Don't use <button>, use <Button> instead
        export function MyComponent() {
          return <Button>Click me</Button>;
        }
      `;

      const violations = checkContent(content, 'test.tsx');

      expect(violations.length).toBe(0);
    });

    it('ignores JSDoc comments with flagged elements', () => {
      const content = `
        /**
         * This component replaces raw <button> elements
         * with styled <Button> components.
         */
        export function MyComponent() {
          return <Button>Click me</Button>;
        }
      `;

      const violations = checkContent(content, 'test.tsx');

      expect(violations.length).toBe(0);
    });

    it('detects multiple different element types', () => {
      const content = `
        export function Form() {
          return (
            <form>
              <input type="text" />
              <textarea rows={3} />
              <button type="submit">Submit</button>
            </form>
          );
        }
      `;

      const violations = checkContent(content, 'test.tsx');

      expect(violations.length).toBe(3);
      const elements = violations.map(v => v.element);
      expect(elements).toContain('input');
      expect(elements).toContain('textarea');
      expect(elements).toContain('button');
    });
  });

  describe('countViolationsByFile', () => {
    it('reports count of violations per file', () => {
      const violations = [
        { file: 'a.tsx', line: 1, element: 'button', replacement: '' },
        { file: 'a.tsx', line: 5, element: 'input', replacement: '' },
        { file: 'b.tsx', line: 3, element: 'button', replacement: '' },
      ];

      const counts = countViolationsByFile(violations);

      expect(counts.get('a.tsx')).toBe(2);
      expect(counts.get('b.tsx')).toBe(1);
    });

    it('handles empty violations array', () => {
      const counts = countViolationsByFile([]);
      expect(counts.size).toBe(0);
    });
  });

  describe('findComponentFiles', () => {
    it('finds .tsx files', () => {
      writeFileSync(join(testDir, 'component.tsx'), 'export const C = () => <div />;');

      const files = findComponentFiles(testDir);

      expect(files.length).toBe(1);
      expect(files[0]).toContain('component.tsx');
    });

    it('finds .jsx files', () => {
      writeFileSync(join(testDir, 'component.jsx'), 'export const C = () => <div />;');

      const files = findComponentFiles(testDir);

      expect(files.length).toBe(1);
      expect(files[0]).toContain('component.jsx');
    });

    it('ignores non-component files', () => {
      writeFileSync(join(testDir, 'utils.ts'), 'export const fn = () => {};');
      writeFileSync(join(testDir, 'styles.css'), '.class {}');

      const files = findComponentFiles(testDir);

      expect(files.length).toBe(0);
    });

    it('skips node_modules directory', () => {
      const nodeModulesDir = join(testDir, 'node_modules');
      mkdirSync(nodeModulesDir, { recursive: true });
      writeFileSync(join(nodeModulesDir, 'external.tsx'), '<button />');

      const files = findComponentFiles(testDir);

      expect(files.length).toBe(0);
    });

    it('finds files recursively', () => {
      const nestedDir = join(testDir, 'features', 'auth');
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(join(nestedDir, 'LoginForm.tsx'), 'export const LoginForm = () => <div />;');

      const files = findComponentFiles(testDir);

      expect(files.length).toBe(1);
      expect(files[0]).toContain('LoginForm.tsx');
    });
  });

  describe('checkFile', () => {
    it('skips files in components/ui/', () => {
      // Create a file path that includes components/ui/
      const uiDir = join(testDir, 'components', 'ui');
      mkdirSync(uiDir, { recursive: true });
      writeFileSync(join(uiDir, 'button.tsx'), '<button>Implementation</button>');

      const violations = checkFile(join(uiDir, 'button.tsx'), testDir);

      // Should be empty because components/ui/ is in SKIP_FILES
      expect(violations.length).toBe(0);
    });

    it('checks regular component files', () => {
      writeFileSync(join(testDir, 'MyComponent.tsx'), '<button>Click</button>');

      const violations = checkFile(join(testDir, 'MyComponent.tsx'), testDir);

      expect(violations.length).toBe(1);
    });
  });

  describe('FLAGGED_ELEMENTS', () => {
    it('includes common form elements', () => {
      const elementNames = FLAGGED_ELEMENTS.map(e => e.element);

      expect(elementNames).toContain('<button');
      expect(elementNames).toContain('<input');
      expect(elementNames).toContain('<select');
      expect(elementNames).toContain('<textarea');
    });

    it('provides replacement suggestions', () => {
      for (const { element, replacement } of FLAGGED_ELEMENTS) {
        expect(replacement).toBeTruthy();
        expect(replacement).toContain('from @/components/ui/');
      }
    });
  });

  describe('SKIP_FILES', () => {
    it('includes components/ui/', () => {
      expect(SKIP_FILES).toContain('components/ui/');
    });
  });
});
