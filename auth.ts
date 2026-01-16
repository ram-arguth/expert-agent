/**
 * NextAuth.js Configuration
 *
 * Implements authentication for the Expert Agent Platform.
 * Uses NextAuth v5 (beta) with the App Router.
 *
 * Environment Variables Required:
 * - NEXTAUTH_URL: Full URL of the app (e.g., https://ai-dev.oz.ly)
 * - NEXTAUTH_SECRET: Secret for session encryption (openssl rand -base64 32)
 * - GOOGLE_CLIENT_ID: Google OAuth client ID
 * - GOOGLE_CLIENT_SECRET: Google OAuth client secret
 *
 * Optional (enable when configured):
 * - APPLE_CLIENT_ID / APPLE_CLIENT_SECRET: For Apple OAuth
 * - AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET / AZURE_AD_TENANT_ID: For Microsoft OAuth
 *
 * @see https://authjs.dev/getting-started/installation
 */

import NextAuth from 'next-auth';
import type { NextAuthConfig, Session } from 'next-auth';
import Google from 'next-auth/providers/google';
import Apple from 'next-auth/providers/apple';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';

// Extend session type to include user id and provider
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      provider?: string; // The OAuth provider used (google, apple, microsoft-entra-id)
    };
  }
}

// Build providers array dynamically based on available credentials
const providers: NextAuthConfig['providers'] = [];

// Google OAuth - Primary login method (required)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    })
  );
}

// Apple OAuth - Enable when configured
// Setup: https://developer.apple.com/account/resources/identifiers/list/serviceId
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  providers.push(
    Apple({
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    })
  );
}

// Microsoft Entra ID (Azure AD) - Enable when configured
// Setup: https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps
if (
  process.env.AZURE_AD_CLIENT_ID &&
  process.env.AZURE_AD_CLIENT_SECRET &&
  process.env.AZURE_AD_TENANT_ID
) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      // The issuer URL includes the tenant ID
      // Use 'common' for multi-tenant, or specific tenant ID for single-tenant
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
    })
  );
}

export const authConfig: NextAuthConfig = {
  providers,

  // Custom pages for authentication flows
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login', // Show errors on login page
  },

  // Session configuration
  session: {
    strategy: 'jwt', // Use JWT for serverless compatibility
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Callbacks for customizing behavior
  callbacks: {
    // Include user ID in the JWT token
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      if (account) {
        token.provider = account.provider;
      }
      return token;
    },

    // Include user ID and provider in the session
    async session({ session, token }): Promise<Session> {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      if (session.user && token.provider) {
        session.user.provider = token.provider as string;
      }
      return session;
    },

    // Authorize which users can sign in
    async signIn({ user, account, profile }) {
      // Allow all users to sign in for now
      // Add restrictions here for enterprise domains, etc.
      return true;
    },

    // Handle redirects after sign in/out
    async redirect({ url, baseUrl }) {
      // Redirect to dashboard after sign-in
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/dashboard`;
    },
  },

  // Enable debug mode in development
  debug: process.env.NODE_ENV === 'development',

  // Trust the reverse proxy (Cloud Run)
  trustHost: true,
};

// Create base NextAuth utilities
const nextAuthExports = NextAuth(authConfig);

// Re-export handlers, signIn, signOut directly
export const { handlers, signIn, signOut } = nextAuthExports;

// Export the raw NextAuth auth for internal use
export const nextAuthRaw = nextAuthExports.auth;

/**
 * Enhanced auth function with E2E test principal support.
 *
 * This function checks for an E2E test session injected by middleware first,
 * then falls back to the normal NextAuth session.
 *
 * SECURITY: E2E mode is only allowed when:
 * - NODE_ENV !== 'production' OR ALLOW_E2E_TEST_MODE=true
 * - E2E_TEST_SECRET header matches configured secret
 *
 * @returns The current session, or null if not authenticated
 */
export async function auth(): Promise<Session | null> {
  // Import dynamically to avoid circular dependency
  const { getAuthSession } = await import('@/lib/auth/session');
  return getAuthSession();
}

// Re-export Session type
export type { Session } from 'next-auth';
