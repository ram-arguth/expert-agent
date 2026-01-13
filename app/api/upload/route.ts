/**
 * File Upload API - Request Signed URL
 *
 * POST /api/upload - Request a signed URL for file upload
 *
 * Flow:
 * 1. Client requests signed URL with file metadata
 * 2. Server validates and generates GCS signed URL
 * 3. Client uploads directly to GCS using PUT
 * 4. Client confirms upload completion
 *
 * @see docs/DESIGN.md - File Handling section
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getCedarEngine, CedarActions } from '@/lib/authz/cedar';
import { v4 as uuidv4 } from 'uuid';

// Validation schema for upload request
const UploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().positive().max(50 * 1024 * 1024), // 50MB max
  purpose: z.enum(['query', 'context', 'avatar']).default('query'),
});

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'text/markdown',

  // Images
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

// Size limits by purpose
const SIZE_LIMITS: Record<string, number> = {
  query: 10 * 1024 * 1024, // 10MB for query files
  context: 50 * 1024 * 1024, // 50MB for context files
  avatar: 1 * 1024 * 1024, // 1MB for avatars
};

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Parse and validate request
    const body = await request.json();
    const validation = UploadRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: 'Invalid request body',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { filename, mimeType, sizeBytes, purpose } = validation.data;

    // 3. Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        {
          error: 'Invalid File Type',
          message: `File type ${mimeType} is not allowed. Supported types: PDF, Word, Excel, images, text files.`,
        },
        { status: 400 }
      );
    }

    // 4. Validate size for purpose
    const maxSize = SIZE_LIMITS[purpose] || SIZE_LIMITS.query;
    if (sizeBytes > maxSize) {
      return NextResponse.json(
        {
          error: 'File Too Large',
          message: `File size exceeds limit of ${maxSize / 1024 / 1024}MB for ${purpose} uploads.`,
        },
        { status: 400 }
      );
    }

    // 5. Authorization check
    const cedar = getCedarEngine();
    const decision = cedar.isAuthorized({
      principal: { type: 'User', id: session.user.id },
      action: { type: 'Action', id: CedarActions.UploadFile },
      resource: { type: 'File', id: 'new' },
    });

    if (!decision.isAuthorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Not authorized to upload files' },
        { status: 403 }
      );
    }

    // 6. Generate file ID and GCS path
    const fileId = uuidv4();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const gcsPath = `uploads/${session.user.id}/${purpose}/${fileId}/${sanitizedFilename}`;

    // 7. Generate signed URL
    // In production, this uses @google-cloud/storage
    // For now, return mock data for development
    const bucketName = process.env.GCS_BUCKET || 'expert-ai-uploads-dev';
    const signedUrl = await generateSignedUrl(bucketName, gcsPath, mimeType);

    // 8. Return upload details
    return NextResponse.json({
      fileId,
      uploadUrl: signedUrl,
      gcsPath,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min expiry
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}

/**
 * Generate a signed URL for GCS upload
 */
async function generateSignedUrl(
  bucketName: string,
  gcsPath: string,
  contentType: string
): Promise<string> {
  // Check if we're in mock mode
  if (process.env.GCS_MOCK === 'true' || process.env.NODE_ENV === 'test') {
    return `https://storage.googleapis.com/${bucketName}/${gcsPath}?mockSignature=true`;
  }

  // In production, use @google-cloud/storage
  try {
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(gcsPath);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
    });

    return url;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    // Fallback to mock URL in development
    if (process.env.NODE_ENV === 'development') {
      return `https://storage.googleapis.com/${bucketName}/${gcsPath}?devMock=true`;
    }
    throw error;
  }
}
