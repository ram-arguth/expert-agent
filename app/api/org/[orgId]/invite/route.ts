/**
 * Team Invite API
 *
 * POST /api/org/[orgId]/invite - Send invite to email
 * GET /api/org/[orgId]/invite - List pending invites
 *
 * Phase 1.4: Team Org Creation & Invites
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getCedarEngine, CedarActions } from '@/lib/authz/cedar';
import { randomBytes } from 'crypto';

// Validation schema
const CreateInviteSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  role: z.enum(['ADMIN', 'MEMBER', 'AUDITOR', 'BILLING_MANAGER']).default('MEMBER'),
});

// Invite expiry (7 days)
const INVITE_EXPIRY_DAYS = 7;

type RouteContext = {
  params: Promise<{ orgId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { orgId } = await context.params;

    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Verify org exists
    const org = await prisma.org.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Organization not found' },
        { status: 404 }
      );
    }

    // 3. Authorize: Only owner/admin can invite
    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: {
          userId: session.user.id,
          orgId,
        },
      },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      // Also verify with Cedar for audit trail
      const cedar = getCedarEngine();
      cedar.isAuthorized({
        principal: {
          type: 'User',
          id: session.user.id,
          attributes: membership 
            ? { orgIds: [orgId], roles: { [orgId]: membership.role } }
            : { orgIds: [], roles: {} },
        },
        action: { type: 'Action', id: CedarActions.InviteMember },
        resource: { type: 'Org', id: orgId },
      });

      return NextResponse.json(
        { error: 'Forbidden', message: 'Only org owners and admins can send invites' },
        { status: 403 }
      );
    }

    // 4. Parse and validate request body
    const body = await request.json();
    const validation = CreateInviteSchema.safeParse(body);

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

    const { email, role } = validation.data;

    // 5. Check if email domain is allowed (only Google/Apple/Microsoft compatible)
    // Note: We allow any email domain but users must authenticate with supported providers
    // This is validated at invite acceptance time

    // 6. Check if user is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const existingMembership = await prisma.membership.findUnique({
        where: {
          userId_orgId: {
            userId: existingUser.id,
            orgId,
          },
        },
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: 'Conflict', message: 'User is already a member of this organization' },
          { status: 409 }
        );
      }
    }

    // 7. Check for existing pending invite
    const existingInvite = await prisma.invite.findFirst({
      where: {
        orgId,
        email,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        {
          error: 'Conflict',
          message: 'A pending invite already exists for this email',
          inviteId: existingInvite.id,
        },
        { status: 409 }
      );
    }

    // 8. Generate secure token and create invite
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const invite = await prisma.invite.create({
      data: {
        orgId,
        email,
        role,
        token,
        invitedById: session.user.id,
        expiresAt,
      },
    });

    // 9. TODO: Send invite email (Phase 1.4 - deferred to email service integration)
    // For now, return the invite link directly
    const inviteLink = `${process.env.NEXTAUTH_URL}/invite?token=${token}`;

    // 10. Return invite info
    return NextResponse.json(
      {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
        inviteLink, // In production, this would be sent via email only
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating invite:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to create invite' },
      { status: 500 }
    );
  }
}

// GET /api/org/[orgId]/invite - List pending invites
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { orgId } = await context.params;

    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Verify membership (owner/admin only)
    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: {
          userId: session.user.id,
          orgId,
        },
      },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Access denied' },
        { status: 403 }
      );
    }

    // 3. Fetch pending invites
    const invites = await prisma.invite.findMany({
      where: {
        orgId,
        status: 'PENDING',
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        expiresAt: true,
        invitedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 4. Mark expired invites
    const now = new Date();
    const invitesWithStatus = invites.map((invite) => ({
      ...invite,
      isExpired: invite.expiresAt < now,
    }));

    return NextResponse.json({ invites: invitesWithStatus });
  } catch (error) {
    console.error('Error listing invites:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to list invites' },
      { status: 500 }
    );
  }
}

// DELETE /api/org/[orgId]/invite - Revoke an invite
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const url = new URL(request.url);
    const inviteId = url.searchParams.get('inviteId');

    if (!inviteId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'inviteId query parameter required' },
        { status: 400 }
      );
    }

    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Verify membership (owner/admin only)
    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: {
          userId: session.user.id,
          orgId,
        },
      },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Access denied' },
        { status: 403 }
      );
    }

    // 3. Revoke invite
    const invite = await prisma.invite.updateMany({
      where: {
        id: inviteId,
        orgId,
        status: 'PENDING',
      },
      data: {
        status: 'REVOKED',
      },
    });

    if (invite.count === 0) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Invite not found or already processed' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Invite revoked successfully' });
  } catch (error) {
    console.error('Error revoking invite:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to revoke invite' },
      { status: 500 }
    );
  }
}
