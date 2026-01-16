/**
 * Manage Subscription Button Component
 *
 * Opens Stripe Customer Portal in a new tab.
 *
 * @see docs/IMPLEMENTATION.md - Phase 5.4
 */

"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Loader2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface ManageSubscriptionButtonProps extends Omit<
  ButtonProps,
  "onClick" | "onError"
> {
  /** Org ID for org billing */
  orgId: string;
  /** Custom button text */
  children?: React.ReactNode;
  /** Callback on successful portal open */
  onSuccess?: () => void;
  /** Callback on portal error */
  onError?: (error: Error) => void;
}

interface PortalResponse {
  url: string;
}

// =============================================================================
// Component
// =============================================================================

export function ManageSubscriptionButton({
  orgId,
  children,
  onSuccess,
  onError,
  className,
  disabled,
  ...props
}: ManageSubscriptionButtonProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleClick = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orgId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to open billing portal");
      }

      const data: PortalResponse = await response.json();

      if (!data.url) {
        throw new Error("No portal URL returned");
      }

      // Call success callback
      onSuccess?.();

      // Open portal in new tab
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error.message);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        onClick={handleClick}
        disabled={disabled || isLoading}
        variant="outline"
        className={cn("gap-2", className)}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Opening...</span>
          </>
        ) : (
          <>
            <Settings className="h-4 w-4" aria-hidden="true" />
            <span>{children || "Manage Subscription"}</span>
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
