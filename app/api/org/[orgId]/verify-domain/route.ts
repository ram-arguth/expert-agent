/**
 * Enterprise Domain Verification API
 *
 * POST /api/org/[orgId]/verify-domain
 * Verifies domain ownership via DNS TXT record lookup.
 *
 * GET /api/org/[orgId]/verify-domain
 * Returns verification status and instructions.
 *
 * Cedar Action: VerifyDomain
 *
 * @see docs/DESIGN.md - Enterprise Domain Verification section
 */

import { NextRequest, NextResponse } from 'next/server';
import dns from 'dns/promises';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { isAuthorized, buildPrincipalFromSession, CedarActions } from '@/lib/authz/cedar';

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

// =============================================================================
// GET - Get verification status and instructions
// =============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        domain: true,
        plan: true,
        domainVerified: true,
        verificationToken: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check membership
    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id, orgId },
      select: { role: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Only allow admins and owners to see verification details
    if (membership.role !== 'ADMIN' && membership.role !== 'OWNER') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Enterprise plan check
    if (org.plan !== 'ENTERPRISE') {
      return NextResponse.json(
        { error: 'Domain verification is only available for Enterprise plans' },
        { status: 400 }
      );
    }

    // Generate verification token if not exists
    let verificationToken = org.verificationToken;
    if (!verificationToken) {
      verificationToken = generateVerificationToken();
      await prisma.org.update({
        where: { id: orgId },
        data: { verificationToken },
      });
    }

    const domain = org.domain;
    const dnsRecord = `_expertai-verify.${domain}`;

    return NextResponse.json({
      orgId: org.id,
      domain,
      isVerified: org.domainVerified ?? false,
      verificationToken,
      instructions: {
        recordType: 'TXT',
        recordName: dnsRecord,
        recordValue: verificationToken,
        example: `${dnsRecord} TXT "${verificationToken}"`,
        note: 'Add this DNS TXT record to your domain\'s DNS settings. Propagation may take up to 48 hours.',
      },
    });
  } catch (error) {
    console.error('Error getting domain verification status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// POST - Perform domain verification
// =============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get memberships for authorization
    const memberships = await prisma.membership.findMany({
      where: { userId: session.user.id },
      select: { orgId: true, role: true },
    });

    const principal = buildPrincipalFromSession(session, memberships);

    // Check authorization
    const decision = isAuthorized({
      principal,
      action: { type: 'Action', id: CedarActions.ManageOrg },
      resource: {
        type: 'Org',
        id: orgId,
        attributes: {},
      },
    });

    if (!decision.isAuthorized) {
      return NextResponse.json(
        { error: 'Not authorized to verify domain' },
        { status: 403 }
      );
    }

    // Get org
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        domain: true,
        plan: true,
        domainVerified: true,
        verificationToken: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Enterprise plan check
    if (org.plan !== 'ENTERPRISE') {
      return NextResponse.json(
        { error: 'Domain verification is only available for Enterprise plans' },
        { status: 400 }
      );
    }

    // Domain required
    if (!org.domain) {
      return NextResponse.json(
        { error: 'Organization domain is not set' },
        { status: 400 }
      );
    }

    // Already verified
    if (org.domainVerified) {
      return NextResponse.json({
        success: true,
        isVerified: true,
        message: 'Domain is already verified',
      });
    }

    // Token required
    if (!org.verificationToken) {
      return NextResponse.json(
        { error: 'No verification token found. Please GET verification instructions first.' },
        { status: 400 }
      );
    }

    // Perform DNS lookup
    const dnsRecord = `_expertai-verify.${org.domain}`;
    let txtRecords: string[][] = [];

    try {
      txtRecords = await dns.resolveTxt(dnsRecord);
    } catch (dnsError: unknown) {
      const errorMessage = dnsError instanceof Error ? dnsError.message : String(dnsError);
      // DNS lookup failed - record doesn't exist or other error
      if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ENODATA')) {
        return NextResponse.json({
          success: false,
          isVerified: false,
          message: `DNS TXT record not found for ${dnsRecord}. Please ensure the record is created and DNS has propagated.`,
          recordName: dnsRecord,
          expectedValue: org.verificationToken,
        });
      }
      throw dnsError;
    }

    // Check if any TXT record matches the verification token
    const flatRecords = txtRecords.flat();
    const isMatch = flatRecords.some(
      (record) => record.trim() === org.verificationToken?.trim()
    );

    if (isMatch) {
      // Update org as verified
      await prisma.org.update({
        where: { id: orgId },
        data: { domainVerified: true },
      });

      return NextResponse.json({
        success: true,
        isVerified: true,
        message: `Domain ${org.domain} has been verified successfully!`,
      });
    } else {
      return NextResponse.json({
        success: false,
        isVerified: false,
        message: 'Verification token mismatch. Please ensure the TXT record value exactly matches the expected token.',
        recordName: dnsRecord,
        foundValues: flatRecords,
        expectedValue: org.verificationToken,
      });
    }
  } catch (error) {
    console.error('Error verifying domain:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// Helpers
// =============================================================================

function generateVerificationToken(): string {
  // Generate a secure random token: expertai-verify-{random}
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const hex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `expertai-verify-${hex}`;
}
