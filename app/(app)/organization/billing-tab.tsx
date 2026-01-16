/**
 * Billing Tab Component
 *
 * Displays billing dashboard in organization settings.
 *
 * @see docs/IMPLEMENTATION.md - Phase 6.1
 */

"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Calendar, CheckCircle, Sparkles } from "lucide-react";
import { useWorkspace } from "@/lib/context/workspace-context";
import { UsageIndicator } from "@/components/billing/usage-indicator";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { ManageSubscriptionButton } from "@/components/billing/manage-subscription-button";

// =============================================================================
// Types
// =============================================================================

interface PlanInfo {
  name: string;
  tier: "FREE" | "PRO" | "TEAM" | "ENTERPRISE";
  status: "active" | "trialing" | "canceled" | "past_due";
  tokensMonthly: number;
  priceId?: string;
  nextBillingDate?: string;
}

interface BillingData {
  plan: PlanInfo;
  hasStripeCustomer: boolean;
}

// Plan tier display info
const PLAN_INFO: Record<string, { features: string[]; price: string }> = {
  FREE: {
    price: "$0/month",
    features: ["1,000 tokens/month", "Basic agents", "Community support"],
  },
  PRO: {
    price: "$29/month",
    features: [
      "50,000 tokens/month",
      "All agents",
      "Priority support",
      "File uploads",
    ],
  },
  TEAM: {
    price: "$99/month",
    features: [
      "200,000 tokens/month",
      "All agents",
      "Org context files",
      "Team collaboration",
      "Priority support",
    ],
  },
  ENTERPRISE: {
    price: "Custom",
    features: [
      "Unlimited tokens",
      "Custom agents",
      "SSO/SAML",
      "Dedicated support",
      "SLA",
    ],
  },
};

// =============================================================================
// Component
// =============================================================================

export function BillingTab() {
  const { activeOrg, isLoading: workspaceLoading } = useWorkspace();
  const [billingData, setBillingData] = React.useState<BillingData | null>(
    null,
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch billing data
  React.useEffect(() => {
    async function fetchBillingData() {
      if (!activeOrg?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/org/${activeOrg.id}/billing`);
        if (!response.ok) {
          throw new Error("Failed to fetch billing info");
        }
        const data = await response.json();
        setBillingData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }

    fetchBillingData();
  }, [activeOrg?.id]);

  // Loading state
  if (workspaceLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // No org context
  if (!activeOrg) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Select an organization to view billing settings
          </p>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Use defaults if no billing data
  const plan: PlanInfo = billingData?.plan || {
    name: "Free",
    tier: "FREE",
    status: "active",
    tokensMonthly: 1000,
  };

  const planDetails = PLAN_INFO[plan.tier] || PLAN_INFO.FREE;
  const isPaid = plan.tier !== "FREE";
  const hasSubscription = billingData?.hasStripeCustomer && isPaid;

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Plan
              </CardTitle>
              <CardDescription>Your subscription and usage</CardDescription>
            </div>
            <Badge
              variant={plan.status === "active" ? "default" : "secondary"}
              className="capitalize"
            >
              {plan.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plan info */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold">{plan.name}</h3>
              <p className="text-muted-foreground">{planDetails.price}</p>
            </div>
            {isPaid && plan.nextBillingDate && (
              <div className="text-right text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Next billing
                </div>
                <div>{new Date(plan.nextBillingDate).toLocaleDateString()}</div>
              </div>
            )}
          </div>

          <Separator />

          {/* Usage indicator */}
          <UsageIndicator detailed />

          <Separator />

          {/* Plan features */}
          <div>
            <h4 className="font-medium mb-3">Plan Features</h4>
            <ul className="space-y-2">
              {planDetails.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {!isPaid && (
              <UpgradeButton priceId="price_pro_monthly" orgId={activeOrg.id}>
                <Sparkles className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </UpgradeButton>
            )}
            {hasSubscription && (
              <ManageSubscriptionButton orgId={activeOrg.id}>
                Manage Subscription
              </ManageSubscriptionButton>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
