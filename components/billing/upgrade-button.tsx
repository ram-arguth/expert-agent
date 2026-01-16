/**
 * Upgrade Button Component
 *
 * Initiates Stripe Checkout to upgrade the subscription.
 *
 * @see docs/IMPLEMENTATION.md - Phase 5.1
 */

"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface UpgradeButtonProps extends Omit<ButtonProps, "onClick" | "onError"> {
  /** Price ID for the plan to upgrade to */
  priceId: string;
  /** Optional org ID for org billing */
  orgId?: string;
  /** Custom button text */
  children?: React.ReactNode;
  /** Callback on successful checkout redirect */
  onSuccess?: () => void;
  /** Callback on checkout error */
  onError?: (error: Error) => void;
}

interface CheckoutResponse {
  sessionId: string;
  url: string;
}

// =============================================================================
// Component
// =============================================================================

export function UpgradeButton({
  priceId,
  orgId,
  children,
  onSuccess,
  onError,
  className,
  disabled,
  ...props
}: UpgradeButtonProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleClick = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priceId,
          ...(orgId && { orgId }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || "Failed to create checkout session",
        );
      }

      const data: CheckoutResponse = await response.json();

      if (!data.url) {
        throw new Error("No checkout URL returned");
      }

      // Call success callback before redirect
      onSuccess?.();

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error.message);
      onError?.(error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        onClick={handleClick}
        disabled={disabled || isLoading}
        className={cn("gap-2", className)}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Redirecting...</span>
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>{children || "Upgrade Plan"}</span>
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
