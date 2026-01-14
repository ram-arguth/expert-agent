/**
 * Input Validator Tests
 *
 * Tests for input validation including:
 * - File size validation
 * - MIME type validation
 * - Extension security
 * - Multi-file validation
 *
 * @see docs/IMPEMENTATION.md - Phase 0.7 Test Requirements
 */

import { describe, it, expect } from 'vitest';
import {
  validateFileSize,
  validateTotalUploadSize,
  validateFileCount,
  validateMimeType,
  validateFileExtension,
  validateTextLength,
  validateFile,
  validateFiles,
  getFileSizeLimits,
  formatBytes,
  DEFAULT_FILE_SIZE_LIMITS,
  ALLOWED_MIME_TYPES,
  BLOCKED_EXTENSIONS,
} from '../input-validator';

describe('Input Validator', () => {
  describe('validateFileSize', () => {
    it('accepts files under size limit', () => {
      const fiveMB = 5 * 1024 * 1024;
      const result = validateFileSize(fiveMB, 'free');

      expect(result.valid).toBe(true);
      expect(result.actualSize).toBe(fiveMB);
    });

    it('rejects files over size limit', () => {
      const fiftyMB = 50 * 1024 * 1024;
      const result = validateFileSize(fiftyMB, 'free');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('applies correct limits for free tier', () => {
      const result = validateFileSize(1000, 'free');
      expect(result.maxSize).toBe(DEFAULT_FILE_SIZE_LIMITS.free.maxFileSize);
    });

    it('applies correct limits for pro tier', () => {
      const result = validateFileSize(1000, 'pro');
      expect(result.maxSize).toBe(DEFAULT_FILE_SIZE_LIMITS.pro.maxFileSize);
    });

    it('applies correct limits for enterprise tier', () => {
      const result = validateFileSize(1000, 'enterprise');
      expect(result.maxSize).toBe(DEFAULT_FILE_SIZE_LIMITS.enterprise.maxFileSize);
    });

    it('defaults to free tier for unknown plan', () => {
      const result = validateFileSize(1000, 'unknown');
      expect(result.maxSize).toBe(DEFAULT_FILE_SIZE_LIMITS.free.maxFileSize);
    });
  });

  describe('validateTotalUploadSize', () => {
    it('accepts total under limit', () => {
      const tenMB = 10 * 1024 * 1024;
      const result = validateTotalUploadSize(tenMB, 'free');

      expect(result.valid).toBe(true);
    });

    it('rejects total over limit', () => {
      const fiftyMB = 50 * 1024 * 1024;
      const result = validateTotalUploadSize(fiftyMB, 'free');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Total upload size');
    });
  });

  describe('validateFileCount', () => {
    it('accepts count under limit', () => {
      const result = validateFileCount(3, 'free');

      expect(result.valid).toBe(true);
    });

    it('rejects count over limit', () => {
      const result = validateFileCount(10, 'free');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('allows more files for higher tiers', () => {
      const result = validateFileCount(10, 'pro');

      expect(result.valid).toBe(true);
    });
  });

  describe('validateMimeType', () => {
    it('accepts allowed MIME types', () => {
      const allowedTypes = ['image/jpeg', 'application/pdf', 'text/plain'];

      allowedTypes.forEach((type) => {
        const result = validateMimeType(type);
        expect(result.valid).toBe(true);
      });
    });

    it('rejects disallowed MIME types', () => {
      const disallowedTypes = [
        'application/x-executable',
        'application/x-msdownload',
        'text/html', // HTML could be XSS vector
      ];

      disallowedTypes.forEach((type) => {
        const result = validateMimeType(type);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('validateFileExtension', () => {
    it('accepts safe extensions', () => {
      const safeFiles = ['document.pdf', 'image.png', 'data.csv', 'report.docx'];

      safeFiles.forEach((file) => {
        const result = validateFileExtension(file);
        expect(result.valid).toBe(true);
      });
    });

    it('rejects executable extensions', () => {
      const dangerousFiles = [
        'malware.exe',
        'script.bat',
        'shell.sh',
        'powershell.ps1',
        'code.js',
        'module.mjs',
      ];

      dangerousFiles.forEach((file) => {
        const result = validateFileExtension(file);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('not allowed');
      });
    });

    it('handles files without extensions', () => {
      const result = validateFileExtension('README');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateTextLength', () => {
    it('accepts text under limit', () => {
      const result = validateTextLength('short text', 100);
      expect(result.valid).toBe(true);
    });

    it('rejects text over limit', () => {
      const result = validateTextLength('a'.repeat(101), 100);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('accepts text at exact limit', () => {
      const result = validateTextLength('a'.repeat(100), 100);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateFile', () => {
    it('validates good file', () => {
      const file = {
        name: 'document.pdf',
        size: 1024 * 1024, // 1MB
        type: 'application/pdf',
      };

      const result = validateFile(file, 'free');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('collects all errors for bad file', () => {
      const file = {
        name: 'malware.exe',
        size: 100 * 1024 * 1024, // 100MB
        type: 'application/x-executable',
      };

      const result = validateFile(file, 'free');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('validateFiles', () => {
    it('validates array of good files', () => {
      const files = [
        { name: 'doc1.pdf', size: 1024 * 1024, type: 'application/pdf' },
        { name: 'image.png', size: 500 * 1024, type: 'image/png' },
      ];

      const result = validateFiles(files, 'free');

      expect(result.valid).toBe(true);
    });

    it('rejects too many files', () => {
      const files = Array(10)
        .fill(null)
        .map((_, i) => ({
          name: `file${i}.pdf`,
          size: 1024,
          type: 'application/pdf',
        }));

      const result = validateFiles(files, 'free');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('File count'))).toBe(true);
    });

    it('rejects if total size exceeds limit', () => {
      const files = [
        { name: 'large1.pdf', size: 15 * 1024 * 1024, type: 'application/pdf' },
        { name: 'large2.pdf', size: 15 * 1024 * 1024, type: 'application/pdf' },
      ];

      const result = validateFiles(files, 'free');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Total upload size'))).toBe(true);
    });

    it('includes file-specific errors with file names', () => {
      const files = [
        { name: 'good.pdf', size: 1024, type: 'application/pdf' },
        { name: 'bad.exe', size: 1024, type: 'application/x-executable' },
      ];

      const result = validateFiles(files, 'free');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('bad.exe'))).toBe(true);
    });
  });

  describe('getFileSizeLimits', () => {
    it('returns free tier limits for undefined plan', () => {
      const limits = getFileSizeLimits(undefined);
      expect(limits).toEqual(DEFAULT_FILE_SIZE_LIMITS.free);
    });

    it('returns correct limits for each tier', () => {
      expect(getFileSizeLimits('free')).toEqual(DEFAULT_FILE_SIZE_LIMITS.free);
      expect(getFileSizeLimits('pro')).toEqual(DEFAULT_FILE_SIZE_LIMITS.pro);
      expect(getFileSizeLimits('enterprise')).toEqual(DEFAULT_FILE_SIZE_LIMITS.enterprise);
    });

    it('is case-insensitive', () => {
      expect(getFileSizeLimits('PRO')).toEqual(DEFAULT_FILE_SIZE_LIMITS.pro);
    });
  });

  describe('formatBytes', () => {
    it('formats bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('handles fractional values', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });
  });

  describe('Security', () => {
    it('BLOCKED_EXTENSIONS includes common executable extensions', () => {
      const mustBlock = ['.exe', '.bat', '.sh', '.ps1', '.js'];
      mustBlock.forEach((ext) => {
        expect(BLOCKED_EXTENSIONS).toContain(ext);
      });
    });

    it('ALLOWED_MIME_TYPES includes document types', () => {
      const mustAllow = ['application/pdf', 'image/jpeg', 'text/plain'];
      mustAllow.forEach((type) => {
        expect(ALLOWED_MIME_TYPES).toContain(type);
      });
    });

    it('does not allow HTML by default', () => {
      expect(ALLOWED_MIME_TYPES).not.toContain('text/html');
    });

    it('does not allow JavaScript by default', () => {
      expect(ALLOWED_MIME_TYPES).not.toContain('application/javascript');
      expect(ALLOWED_MIME_TYPES).not.toContain('text/javascript');
    });
  });
});
