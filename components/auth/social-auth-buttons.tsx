'use client';

/**
 * SocialAuthButtons Component
 *
 * Provides OAuth sign-in buttons for supported providers.
 * Only shows buttons for providers that are configured (have env vars set).
 */

import * as React from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SocialAuthButtonsProps {
  /** Text prefix for buttons (e.g., "Continue with" or "Sign up with") */
  actionText?: string;
  /** Callback URL after successful auth */
  callbackUrl?: string;
  /** Whether buttons are disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Available providers from NextAuth (fetched from /api/auth/providers) */
  providers?: Record<string, { id: string; name: string }>;
}

// Provider icons
const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const AppleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
  </svg>
);

const MicrosoftIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
    <path fill="#F25022" d="M1 1h10v10H1z" />
    <path fill="#00A4EF" d="M1 13h10v10H1z" />
    <path fill="#7FBA00" d="M13 1h10v10H13z" />
    <path fill="#FFB900" d="M13 13h10v10H13z" />
  </svg>
);

const LoadingSpinner = () => <span className="mr-2 h-4 w-4 animate-spin">⌛</span>;

export function SocialAuthButtons({
  actionText = 'Continue with',
  callbackUrl = '/dashboard',
  disabled = false,
  className,
  providers,
}: SocialAuthButtonsProps) {
  const [isLoading, setIsLoading] = React.useState<string | null>(null);

  const handleSignIn = async (provider: string) => {
    setIsLoading(provider);
    try {
      await signIn(provider, { callbackUrl });
    } catch (error) {
      console.error('Sign in error:', error);
      setIsLoading(null);
    }
  };

  // Helper to check if a provider is available
  const hasProvider = (providerId: string) => {
    if (!providers) return true; // Show all if providers not passed
    return Object.keys(providers).includes(providerId);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Google */}
      {hasProvider('google') && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleSignIn('google')}
          disabled={disabled || isLoading !== null}
          data-testid="google-auth-btn"
        >
          {isLoading === 'google' ? <LoadingSpinner /> : <GoogleIcon />}
          {actionText} Google
        </Button>
      )}

      {/* Apple */}
      {hasProvider('apple') && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleSignIn('apple')}
          disabled={disabled || isLoading !== null}
          data-testid="apple-auth-btn"
        >
          {isLoading === 'apple' ? <LoadingSpinner /> : <AppleIcon />}
          {actionText} Apple
        </Button>
      )}

      {/* Microsoft */}
      {hasProvider('microsoft-entra-id') && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleSignIn('microsoft-entra-id')}
          disabled={disabled || isLoading !== null}
          data-testid="microsoft-auth-btn"
        >
          {isLoading === 'microsoft-entra-id' ? <LoadingSpinner /> : <MicrosoftIcon />}
          {actionText} Microsoft
        </Button>
      )}
    </div>
  );
}
