/**
 * Organization API - Create Team
 *
 * POST /api/org - Create a new team organization
 *
 * Phase 1.4: Team Org Creation & Invites
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getCedarEngine, CedarActions } from '@/lib/authz/cedar';

// Validation schema
const CreateOrgSchema = z.object({
  name: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name must be at most 100 characters')
    .trim(),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug must be at most 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  type: z.enum(['TEAM']).default('TEAM'), // Only TEAM allowed for self-serve
});

// Allowed auth providers for team creation
const ALLOWED_PROVIDERS = ['google', 'apple', 'microsoft'];

// Check if provider is allowed (handles variants like microsoft-entra-id)
function isAllowedProvider(provider: string | undefined): boolean {
  if (!provider) return false;
  const lowerProvider = provider.toLowerCase();
  return ALLOWED_PROVIDERS.some((allowed) => lowerProvider.startsWith(allowed));
}

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

    // 2. Validate provider (only Google, Apple, Microsoft allowed)
    if (!isAllowedProvider(session.user.provider)) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message:
            'Team creation requires sign-in with Google, Apple, or Microsoft account',
        },
        { status: 403 }
      );
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const validation = CreateOrgSchema.safeParse(body);

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

    const { name, type } = validation.data;

    // 4. Generate slug from name if not provided
    let slug = validation.data.slug;
    if (!slug) {
      slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Ensure uniqueness by appending random suffix
      const existingOrg = await prisma.org.findUnique({ where: { slug } });
      if (existingOrg) {
        slug = `${slug}-${Math.random().toString(36).substring(2, 8)}`;
      }
    }

    // 5. Check if slug is already taken
    const existingSlug = await prisma.org.findUnique({ where: { slug } });
    if (existingSlug) {
      return NextResponse.json(
        { error: 'Conflict', message: 'Organization slug already exists' },
        { status: 409 }
      );
    }

    // 6. Check user's existing team count (limit to prevent abuse)
    const userOwnedOrgs = await prisma.membership.count({
      where: {
        userId: session.user.id,
        role: 'OWNER',
      },
    });

    const MAX_OWNED_ORGS = 5;
    if (userOwnedOrgs >= MAX_OWNED_ORGS) {
      return NextResponse.json(
        {
          error: 'Limit Exceeded',
          message: `You can own at most ${MAX_OWNED_ORGS} organizations`,
        },
        { status: 400 }
      );
    }

    // 7. Create org and owner membership in a transaction
    const org = await prisma.$transaction(async (tx) => {
      // Create the org
      const newOrg = await tx.org.create({
        data: {
          name,
          slug,
          type,
        },
      });

      // Create owner membership
      await tx.membership.create({
        data: {
          userId: session.user.id,
          orgId: newOrg.id,
          role: 'OWNER',
        },
      });

      return newOrg;
    });

    // 8. Authorization audit log (Cedar action tracking)
    const cedar = getCedarEngine();
    cedar.isAuthorized({
      principal: { type: 'User', id: session.user.id },
      action: { type: 'Action', id: CedarActions.CreateOrg },
      resource: { type: 'Org', id: org.id },
    });

    // 9. Return created org
    return NextResponse.json(
      {
        id: org.id,
        name: org.name,
        slug: org.slug,
        type: org.type,
        createdAt: org.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to create organization' },
      { status: 500 }
    );
  }
}

// GET /api/org - List user's organizations
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: session.user.id },
      include: {
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            plan: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      organizations: memberships.map((m) => ({
        ...m.org,
        role: m.role,
        memberSince: m.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error listing organizations:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to list organizations' },
      { status: 500 }
    );
  }
}
