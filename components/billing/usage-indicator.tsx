/**
 * Usage Indicator Component
 *
 * Displays token usage in the header with low-usage warnings.
 *
 * @see docs/IMPLEMENTATION.md - Phase 5.3
 */

"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface UsageSummary {
  tokensRemaining: number;
  tokensMonthly: number;
  usagePercent: number;
  quotaResetDate: string | null;
  plan: string;
  isOrgContext: boolean;
}

interface UsageIndicatorProps {
  /** Whether to show detailed view */
  detailed?: boolean;
  /** Custom class name */
  className?: string;
}

// =============================================================================
// API Functions
// =============================================================================

async function fetchUsageSummary(): Promise<UsageSummary> {
  const response = await fetch("/api/billing/usage");
  if (!response.ok) {
    throw new Error("Failed to fetch usage");
  }
  return response.json();
}

// =============================================================================
// Component
// =============================================================================

export function UsageIndicator({
  detailed = false,
  className,
}: UsageIndicatorProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["usage-summary"],
    queryFn: fetchUsageSummary,
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Consider fresh for 30 seconds
  });

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="h-2 w-16 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  // Error state - don't show anything
  if (error || !data) {
    return null;
  }

  const { tokensRemaining, tokensMonthly, usagePercent, plan } = data;

  const isLow = usagePercent >= 90;
  const isExhausted = tokensRemaining <= 0;

  // Format token count
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  // Compact view (for header)
  if (!detailed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1",
                isExhausted && "bg-destructive/10",
                isLow && !isExhausted && "bg-yellow-500/10",
                className,
              )}
              role="status"
              aria-label={`Token usage: ${usagePercent}% used`}
            >
              <Zap
                className={cn(
                  "h-4 w-4",
                  isExhausted && "text-destructive",
                  isLow && !isExhausted && "text-yellow-500",
                  !isLow && "text-primary",
                )}
              />
              <Progress
                value={usagePercent}
                className="h-2 w-12"
                aria-label="Token usage progress"
              />
              {isLow && (
                <AlertTriangle
                  className="h-3 w-3 text-yellow-500"
                  aria-hidden="true"
                />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[200px]">
            <div className="space-y-1 text-sm">
              <p className="font-medium">
                {formatTokens(tokensRemaining)} / {formatTokens(tokensMonthly)}{" "}
                tokens
              </p>
              <p className="text-muted-foreground">
                {usagePercent}% used ({plan} plan)
              </p>
              {isExhausted && (
                <p className="text-destructive">
                  Quota exhausted - upgrade to continue
                </p>
              )}
              {isLow && !isExhausted && (
                <p className="text-yellow-500">Running low on tokens</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detailed view (for account page)
  return (
    <div className={cn("space-y-3 rounded-lg border p-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h3 className="font-medium">Token Usage</h3>
        </div>
        <Badge variant={plan === "enterprise" ? "default" : "secondary"}>
          {plan.charAt(0).toUpperCase() + plan.slice(1)}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Used</span>
          <span>
            {formatTokens(tokensMonthly - tokensRemaining)} /{" "}
            {formatTokens(tokensMonthly)}
          </span>
        </div>
        <Progress
          value={usagePercent}
          className={cn(
            "h-3",
            isExhausted && "[&>div]:bg-destructive",
            isLow && !isExhausted && "[&>div]:bg-yellow-500",
          )}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{usagePercent}% used</span>
          <span>{formatTokens(tokensRemaining)} remaining</span>
        </div>
      </div>

      {isExhausted && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>Quota exhausted</span>
        </div>
      )}

      {isLow && !isExhausted && (
        <div className="flex items-center gap-2 rounded-md bg-yellow-500/10 p-2 text-sm text-yellow-600 dark:text-yellow-500">
          <AlertTriangle className="h-4 w-4" />
          <span>Running low on tokens</span>
        </div>
      )}

      {(isLow || isExhausted) && (
        <Button
          asChild
          className="w-full"
          variant={isExhausted ? "default" : "outline"}
        >
          <a href="/pricing">
            <TrendingUp className="mr-2 h-4 w-4" />
            Upgrade Plan
          </a>
        </Button>
      )}
    </div>
  );
}
