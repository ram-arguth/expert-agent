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
 * Optional:
 * - GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET: For GitHub OAuth
 *
 * @see https://authjs.dev/getting-started/installation
 */

import NextAuth from 'next-auth';
import type { NextAuthConfig, Session, User } from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';

// Extend session type to include user id
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

export const authConfig: NextAuthConfig = {
  // Configure authentication providers
  providers: [
    // Google OAuth - Primary login method
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
    }),
    // GitHub OAuth - Optional secondary provider
    ...(process.env.GITHUB_CLIENT_ID
      ? [
          GitHub({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }),
        ]
      : []),
  ],

  // Custom pages for authentication flows
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login', // Show errors on login page
    // Note: signUp not needed - users sign up by signing in
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

    // Include user ID in the session
    async session({ session, token }): Promise<Session> {
      if (session.user && token.id) {
        session.user.id = token.id as string;
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

// Export auth utilities
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
