/**
 * Enterprise SSO Service
 *
 * Handles SAML and OIDC authentication flows for enterprise organizations.
 *
 * @see docs/IMPLEMENTATION.md - Phase 1.3
 */

import { prisma } from "@/lib/db";
import * as client from "openid-client";

export interface SSOConfig {
  type: "SAML" | "OIDC";
  // OIDC config
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  // SAML config
  entryPoint?: string;
  issuerName?: string;
  cert?: string;
}

export interface SSORouteResult {
  shouldRedirect: boolean;
  orgId?: string;
  ssoConfig?: SSOConfig;
  redirectUrl?: string;
  error?: string;
}

/**
 * Check if email domain matches an enterprise org with SSO configured
 */
export async function checkEmailDomainForSSO(
  email: string,
): Promise<SSORouteResult> {
  const domain = email.split("@")[1]?.toLowerCase();

  if (!domain) {
    return { shouldRedirect: false, error: "Invalid email format" };
  }

  // Find org with verified domain and SSO config
  const org = await prisma.org.findFirst({
    where: {
      domainVerified: true,
      domain: domain,
    },
    select: {
      id: true,
      slug: true,
      ssoConfig: true,
    },
  });

  // Check if org exists and has SSO config
  if (!org || !org.ssoConfig) {
    return { shouldRedirect: false };
  }

  const ssoConfig = org.ssoConfig as unknown as SSOConfig;

  return {
    shouldRedirect: true,
    orgId: org.id,
    ssoConfig,
  };
}

/**
 * Build OIDC authorization URL
 */
export async function buildOIDCAuthUrl(
  orgId: string,
  ssoConfig: SSOConfig,
): Promise<string> {
  if (!ssoConfig.issuer || !ssoConfig.clientId) {
    throw new Error("OIDC config missing issuer or clientId");
  }

  const config = await client.discovery(
    new URL(ssoConfig.issuer),
    ssoConfig.clientId,
    ssoConfig.clientSecret,
  );

  const callbackUrl = `${process.env.NEXTAUTH_URL}/api/auth/callback/oidc/${orgId}`;
  const state = generateState();
  const nonce = generateNonce();

  // Store state in session for verification
  await storeOIDCState(orgId, state, nonce);

  const authUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile",
    state,
    nonce,
  });

  return authUrl.toString();
}

/**
 * Handle OIDC callback and validate tokens
 */
export async function handleOIDCCallback(
  orgId: string,
  params: URLSearchParams,
): Promise<{ email: string; name?: string; sub: string }> {
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { ssoConfig: true },
  });

  if (!org?.ssoConfig) {
    throw new Error("SSO config not found");
  }

  const ssoConfig = org.ssoConfig as unknown as SSOConfig;

  if (!ssoConfig.issuer || !ssoConfig.clientId) {
    throw new Error("OIDC config missing issuer or clientId");
  }

  const config = await client.discovery(
    new URL(ssoConfig.issuer),
    ssoConfig.clientId,
    ssoConfig.clientSecret,
  );

  const callbackUrl = `${process.env.NEXTAUTH_URL}/api/auth/callback/oidc/${orgId}`;

  // Get stored state/nonce
  const storedState = await getOIDCState(orgId);
  if (!storedState) {
    throw new Error("OIDC state not found");
  }

  // Validate callback
  const tokens = await client.authorizationCodeGrant(
    config,
    new URL(callbackUrl + "?" + params.toString()),
    {
      expectedState: storedState.state,
      expectedNonce: storedState.nonce,
    },
  );

  const claims = tokens.claims();
  if (!claims) {
    throw new Error("Unable to get claims from token");
  }

  // Clean up state
  await clearOIDCState(orgId);

  return {
    email: claims.email as string,
    name: claims.name as string | undefined,
    sub: claims.sub as string,
  };
}

/**
 * Build SAML AuthnRequest URL
 */
export async function buildSAMLAuthUrl(
  orgId: string,
  ssoConfig: SSOConfig,
): Promise<string> {
  if (!ssoConfig.entryPoint) {
    throw new Error("SAML config missing entryPoint");
  }

  const callbackUrl = `${process.env.NEXTAUTH_URL}/api/auth/callback/saml/${orgId}`;
  const requestId = generateRequestId();

  // Store request ID for validation
  await storeSAMLRequest(orgId, requestId);

  // Build SAML AuthnRequest (simplified)
  const samlRequest = buildSAMLRequest(
    callbackUrl,
    ssoConfig.issuerName || "expert-ai",
    requestId,
  );
  const encodedRequest = Buffer.from(samlRequest).toString("base64");

  return `${ssoConfig.entryPoint}?SAMLRequest=${encodeURIComponent(encodedRequest)}`;
}

/**
 * Handle SAML callback and extract user info
 */
export async function handleSAMLCallback(
  orgId: string,
  samlResponse: string,
): Promise<{ email: string; name?: string; nameId: string }> {
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { ssoConfig: true },
  });

  if (!org?.ssoConfig) {
    throw new Error("SSO config not found");
  }

  const ssoConfig = org.ssoConfig as unknown as SSOConfig;

  // Decode and validate SAML response
  const decoded = Buffer.from(samlResponse, "base64").toString("utf-8");

  // Extract user info from SAML assertion
  // In production, use passport-saml or saml2-js for proper validation
  const userInfo = parseSAMLAssertion(decoded, ssoConfig.cert);

  // Clean up stored request
  await clearSAMLRequest(orgId);

  return userInfo;
}

// Helper functions

function generateState(): string {
  return crypto.randomUUID();
}

function generateNonce(): string {
  return crypto.randomUUID();
}

function generateRequestId(): string {
  return `_${crypto.randomUUID()}`;
}

// State storage (using memory for now, should use Redis in production)
const oidcStateStore = new Map<string, { state: string; nonce: string }>();
const samlRequestStore = new Map<string, string>();

async function storeOIDCState(
  orgId: string,
  state: string,
  nonce: string,
): Promise<void> {
  oidcStateStore.set(orgId, { state, nonce });
}

async function getOIDCState(
  orgId: string,
): Promise<{ state: string; nonce: string } | undefined> {
  return oidcStateStore.get(orgId);
}

async function clearOIDCState(orgId: string): Promise<void> {
  oidcStateStore.delete(orgId);
}

async function storeSAMLRequest(
  orgId: string,
  requestId: string,
): Promise<void> {
  samlRequestStore.set(orgId, requestId);
}

async function clearSAMLRequest(orgId: string): Promise<void> {
  samlRequestStore.delete(orgId);
}

function buildSAMLRequest(
  callbackUrl: string,
  issuer: string,
  requestId: string,
): string {
  // Simplified SAML AuthnRequest XML
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" 
  ID="${requestId}" 
  Version="2.0" 
  IssueInstant="${now}"
  AssertionConsumerServiceURL="${callbackUrl}">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${issuer}</saml:Issuer>
</samlp:AuthnRequest>`;
}

function parseSAMLAssertion(
  _xml: string,
  _cert?: string,
): { email: string; name?: string; nameId: string } {
  // Simplified parsing - in production use saml2-js
  // This is a placeholder that would properly validate signatures

  // Extract NameID and attributes from XML
  const nameIdMatch = _xml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
  // Use simpler patterns that don't require dotall flag
  const emailMatch = _xml.match(
    /<saml:Attribute Name="email"[^>]*>[^<]*<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/,
  );
  const nameMatch = _xml.match(
    /<saml:Attribute Name="displayName"[^>]*>[^<]*<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/,
  );

  const nameId = nameIdMatch?.[1] || "";
  const email = emailMatch?.[1] || nameId; // NameID is often email
  const name = nameMatch?.[1];

  if (!email) {
    throw new Error("Unable to extract email from SAML assertion");
  }

  return { email, name, nameId };
}
