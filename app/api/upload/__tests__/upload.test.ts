/**
 * Upload API Tests
 *
 * Tests for file upload URL generation.
 * Includes security tests for MIME type and size validation.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock dependencies
vi.mock('../../../../auth', () => ({
  auth: vi.fn(),
}));

vi.mock('../../../../lib/db', () => ({
  prisma: {},
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

// Import after mocks
import { POST } from '../route';
import { auth } from '../../../../auth';
import { NextRequest } from 'next/server';

const mockAuth = auth as Mock;

// Helper to create NextRequest
function createRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/upload', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('returns 401 for unauthenticated users', async () => {
      mockAuth.mockResolvedValue(null);

      const request = createRequest({
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'user@example.com' },
      });
    });

    it('accepts valid upload request', async () => {
      const request = createRequest({
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 5 * 1024 * 1024, // 5MB
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('fileId');
      expect(data).toHaveProperty('uploadUrl');
      expect(data).toHaveProperty('gcsPath');
      expect(data).toHaveProperty('expiresAt');
    });

    it('rejects missing filename', async () => {
      const request = createRequest({
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation Error');
    });

    it('rejects empty filename', async () => {
      const request = createRequest({
        filename: '',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('MIME Type Validation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'user@example.com' },
      });
    });

    it('accepts PDF files', async () => {
      const request = createRequest({
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('accepts image files', async () => {
      const mimeTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

      for (const mimeType of mimeTypes) {
        const request = createRequest({
          filename: 'image.png',
          mimeType,
          sizeBytes: 1024,
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
      }
    });

    it('accepts text files', async () => {
      const request = createRequest({
        filename: 'notes.txt',
        mimeType: 'text/plain',
        sizeBytes: 1024,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('rejects executable files', async () => {
      const request = createRequest({
        filename: 'malware.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 1024,
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid File Type');
    });

    it('rejects JavaScript files', async () => {
      const request = createRequest({
        filename: 'script.js',
        mimeType: 'application/javascript',
        sizeBytes: 1024,
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('rejects HTML files', async () => {
      const request = createRequest({
        filename: 'page.html',
        mimeType: 'text/html',
        sizeBytes: 1024,
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('Size Limits', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'user@example.com' },
      });
    });

    it('accepts files under query limit (10MB)', async () => {
      const request = createRequest({
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 9 * 1024 * 1024, // 9MB
        purpose: 'query',
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('rejects files over query limit', async () => {
      const request = createRequest({
        filename: 'large.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 15 * 1024 * 1024, // 15MB
        purpose: 'query',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('File Too Large');
    });

    it('accepts larger files for context purpose (50MB)', async () => {
      const request = createRequest({
        filename: 'context.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 40 * 1024 * 1024, // 40MB
        purpose: 'context',
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('rejects negative file sizes', async () => {
      const request = createRequest({
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: -1,
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('rejects zero-byte files', async () => {
      const request = createRequest({
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 0,
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('Security Tests', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'user@example.com' },
      });
    });

    it('sanitizes filename to prevent path traversal', async () => {
      const request = createRequest({
        filename: '../../../etc/passwd',
        mimeType: 'text/plain',
        sizeBytes: 1024,
      });

      const response = await POST(request);

      // Should succeed but with sanitized filename
      expect(response.status).toBe(200);
      const data = await response.json();

      // Malicious path traversal should be neutralized
      // The filename is the last part of the path after the UUID folder
      const pathParts = data.gcsPath.split('/');
      const sanitizedFilename = pathParts[pathParts.length - 1];
      
      // The filename should not contain actual slashes (path separators)
      expect(sanitizedFilename).not.toContain('/');
      // The dangerous target path should not appear
      expect(data.gcsPath).not.toContain('/etc/passwd');
      
      // Should contain the user ID for proper isolation
      expect(data.gcsPath).toContain('user-1');
    });

    it('sanitizes special characters in filename', async () => {
      const request = createRequest({
        filename: 'file<script>alert(1)</script>.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Angle brackets and parentheses should be removed/replaced
      expect(data.gcsPath).not.toContain('<');
      expect(data.gcsPath).not.toContain('>');
      expect(data.gcsPath).not.toContain('(');
      expect(data.gcsPath).not.toContain(')');
    });

    it('includes user ID in GCS path for isolation', async () => {
      const request = createRequest({
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Path should include user ID for isolation
      expect(data.gcsPath).toContain('user-1');
    });

    it('generates unique file ID', async () => {
      const request = createRequest({
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.fileId).toBe('test-uuid-1234');
    });
  });
});
