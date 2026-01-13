/**
 * Accept Invite API
 *
 * POST /api/invite/accept - Accept an invite with token
 *
 * Phase 1.4: Team Org Creation & Invites
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

// Validation schema
const AcceptInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// Allowed auth providers
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
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Validate provider (must be trusted identity)
    if (!isAllowedProvider(session.user.provider)) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message:
            'Accepting invites requires sign-in with Google, Apple, or Microsoft account',
        },
        { status: 403 }
      );
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const validation = AcceptInviteSchema.safeParse(body);

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

    const { token } = validation.data;

    // 4. Find the invite
    const invite = await prisma.invite.findUnique({
      where: { token },
      include: {
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Invalid invite token' },
        { status: 404 }
      );
    }

    // 5. Check invite status
    if (invite.status !== 'PENDING') {
      return NextResponse.json(
        {
          error: 'Conflict',
          message: `Invite has already been ${invite.status.toLowerCase()}`,
        },
        { status: 409 }
      );
    }

    // 6. Check expiry
    if (invite.expiresAt < new Date()) {
      // Mark as expired
      await prisma.invite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      });

      return NextResponse.json(
        { error: 'Gone', message: 'Invite has expired' },
        { status: 410 }
      );
    }

    // 7. Verify email matches
    if (invite.email.toLowerCase() !== session.user.email.toLowerCase()) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'This invite was sent to a different email address',
        },
        { status: 403 }
      );
    }

    // 8. Check if already a member
    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_orgId: {
          userId: session.user.id,
          orgId: invite.orgId,
        },
      },
    });

    if (existingMembership) {
      // Mark invite as accepted anyway
      await prisma.invite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      return NextResponse.json(
        {
          error: 'Conflict',
          message: 'You are already a member of this organization',
          org: invite.org,
        },
        { status: 409 }
      );
    }

    // 9. Create membership and update invite in transaction
    const membership = await prisma.$transaction(async (tx) => {
      // Create membership
      const newMembership = await tx.membership.create({
        data: {
          userId: session.user.id,
          orgId: invite.orgId,
          role: invite.role,
        },
      });

      // Mark invite as accepted
      await tx.invite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      return newMembership;
    });

    // 10. Return success with org info
    return NextResponse.json({
      message: 'Successfully joined organization',
      org: invite.org,
      role: membership.role,
    });
  } catch (error) {
    console.error('Error accepting invite:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to accept invite' },
      { status: 500 }
    );
  }
}

// GET /api/invite/accept?token=... - Get invite details before accepting
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Token query parameter required' },
        { status: 400 }
      );
    }

    // Find invite (no auth required to view public invite info)
    const invite = await prisma.invite.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        org: {
          select: {
            name: true,
            slug: true,
          },
        },
        invitedBy: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Invalid invite token' },
        { status: 404 }
      );
    }

    // Check if expired
    const isExpired = invite.expiresAt < new Date();
    const isValid = invite.status === 'PENDING' && !isExpired;

    return NextResponse.json({
      email: invite.email,
      role: invite.role,
      status: isExpired ? 'EXPIRED' : invite.status,
      orgName: invite.org.name,
      invitedBy: invite.invitedBy?.name || 'Unknown',
      isValid,
    });
  } catch (error) {
    console.error('Error fetching invite:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch invite' },
      { status: 500 }
    );
  }
}
