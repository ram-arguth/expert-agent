/**
 * Audit Logs Tab Component
 *
 * Displays audit log events in a searchable table.
 *
 * @see docs/IMPLEMENTATION.md - Phase 6.2
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
} from "lucide-react";
import { useWorkspace } from "@/lib/context/workspace-context";
import { Input } from "@/components/ui/input";

// =============================================================================
// Types
// =============================================================================

interface AuditLog {
  id: string;
  userId: string | null;
  orgId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

interface PaginatedLogs {
  logs: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "LOGIN", label: "Login" },
  { value: "LOGOUT", label: "Logout" },
  { value: "FILE_UPLOAD", label: "File Upload" },
  { value: "QUERY_SUBMITTED", label: "Query Submitted" },
  { value: "MEMBER_INVITED", label: "Member Invited" },
  { value: "SETTINGS_CHANGED", label: "Settings Changed" },
];

// =============================================================================
// Component
// =============================================================================

export function AuditLogsTab() {
  const { activeOrg, isLoading: workspaceLoading } = useWorkspace();
  const [logs, setLogs] = React.useState<PaginatedLogs | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [actionFilter, setActionFilter] = React.useState("");

  // Fetch logs
  const fetchLogs = React.useCallback(async () => {
    if (!activeOrg?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "25",
      });
      if (actionFilter) params.set("action", actionFilter);

      const response = await fetch(
        `/api/org/${activeOrg.id}/audit-logs?${params}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch audit logs");
      }
      const data = await response.json();
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg?.id, page, actionFilter]);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Format action for display
  const formatAction = (action: string): string => {
    return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Format timestamp
  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  // Loading state
  if (workspaceLoading || (isLoading && !logs)) {
    return (
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
    );
  }

  // No org context
  if (!activeOrg) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Select an organization to view audit logs
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

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Audit Logs
              </CardTitle>
              <CardDescription>
                Track user activity and security events
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLogs}
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Select
              value={actionFilter}
              onValueChange={(value) => {
                setActionFilter(value);
                setPage(1);
              }}
              options={ACTION_OPTIONS}
              className="w-[200px]"
              placeholder="Filter by action"
            />
            <p className="text-sm text-muted-foreground ml-auto">
              {logs?.total || 0} events total
            </p>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs?.logs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No audit events found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs?.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {formatTime(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {formatAction(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.resourceType}
                        {log.resourceId && (
                          <span className="text-muted-foreground ml-1">
                            ({log.resourceId.slice(0, 8)}...)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={log.success ? "default" : "destructive"}
                        >
                          {log.success ? "Success" : "Failed"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.ipAddress || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {logs && logs.total > logs.pageSize && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {logs.page} of {Math.ceil(logs.total / logs.pageSize)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!logs.hasMore}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
