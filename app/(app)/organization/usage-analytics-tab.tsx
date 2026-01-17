/**
 * Usage Analytics Tab Component
 *
 * Displays per-user and per-agent token consumption.
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
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { BarChart3, Users, Bot, Download, Calendar } from "lucide-react";
import { useWorkspace } from "@/lib/context/workspace-context";

// =============================================================================
// Types
// =============================================================================

interface UserUsage {
  userId: string;
  userName: string | null;
  userEmail: string;
  tokensUsed: number;
  queryCount: number;
  percentage: number;
}

interface AgentUsage {
  agentId: string;
  agentName: string;
  tokensUsed: number;
  queryCount: number;
  percentage: number;
}

interface UsageAnalytics {
  period: {
    start: string;
    end: string;
    days: number;
  };
  totals: {
    tokensUsed: number;
    queryCount: number;
  };
  byUser: UserUsage[];
  byAgent: AgentUsage[];
}

// Date range options for select
const DATE_RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last year" },
];

// =============================================================================
// Component
// =============================================================================

export function UsageAnalyticsTab() {
  const { activeOrg, isLoading: workspaceLoading } = useWorkspace();
  const [analytics, setAnalytics] = React.useState<UsageAnalytics | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [days, setDays] = React.useState("30");

  // Fetch analytics
  React.useEffect(() => {
    async function fetchAnalytics() {
      if (!activeOrg?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/org/${activeOrg.id}/usage?days=${days}`,
        );
        if (!response.ok) {
          throw new Error("Failed to fetch usage analytics");
        }
        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [activeOrg?.id, days]);

  // Format tokens
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  // Loading state
  if (workspaceLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
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
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Select an organization to view usage analytics
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

  // No data
  if (!analytics) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select
              value={days}
              onValueChange={setDays}
              options={DATE_RANGE_OPTIONS}
              className="w-[180px]"
            />
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tokens Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTokens(analytics.totals.tokensUsed)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.totals.queryCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage by User */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usage by Team Member
          </CardTitle>
          <CardDescription>Token consumption per user</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.byUser.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No usage data for this period
            </p>
          ) : (
            <div className="space-y-4">
              {analytics.byUser.map((user) => (
                <div key={user.userId} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">
                        {user.userName || user.userEmail}
                      </span>
                      {user.userName && (
                        <span className="text-muted-foreground ml-2">
                          ({user.userEmail})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">
                        {user.queryCount} queries
                      </span>
                      <span className="font-medium">
                        {formatTokens(user.tokensUsed)}
                      </span>
                    </div>
                  </div>
                  <Progress value={user.percentage} className="h-2" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage by Agent */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Usage by Agent
          </CardTitle>
          <CardDescription>Token consumption per agent type</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.byAgent.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No usage data for this period
            </p>
          ) : (
            <div className="space-y-4">
              {analytics.byAgent.map((agent) => (
                <div key={agent.agentId} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{agent.agentName}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">
                        {agent.queryCount} queries
                      </span>
                      <span className="font-medium">
                        {formatTokens(agent.tokensUsed)}
                      </span>
                    </div>
                  </div>
                  <Progress value={agent.percentage} className="h-2" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
