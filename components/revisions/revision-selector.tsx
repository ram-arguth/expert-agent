/**
 * Revision Selector Component
 *
 * Allows selecting between different versions of an agent's response
 * within a session. Shows a timeline of revisions with metadata.
 *
 * @see docs/IMPEMENTATION.md - Phase 4.5
 * @see docs/DESIGN.md - Revision History
 */

"use client";

import * as React from "react";
import { History, ChevronDown, Check, GitBranch, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Revision data structure
 */
export interface Revision {
  /** Revision ID */
  id: string;
  /** Version number (1-indexed) */
  version: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Parent revision ID (for branching) */
  parentId?: string;
  /** Brief summary of changes */
  summary?: string;
  /** Source: 'initial' | 'chat' | 'edit' */
  source?: "initial" | "chat" | "edit";
}

/**
 * Props for RevisionSelector
 */
export interface RevisionSelectorProps {
  /** List of available revisions */
  revisions: Revision[];
  /** Currently selected revision ID */
  currentRevisionId: string;
  /** Callback when revision is selected */
  onSelectRevision?: (revision: Revision) => void;
  /** Additional CSS class */
  className?: string;
  /** Compact mode (dropdown only, no timeline) */
  compact?: boolean;
}

/**
 * Format relative time for display
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

/**
 * Get source icon and label
 */
function getSourceInfo(source?: string): {
  icon: React.ReactNode;
  label: string;
} {
  switch (source) {
    case "chat":
      return { icon: <GitBranch className="h-3 w-3" />, label: "From chat" };
    case "edit":
      return { icon: <History className="h-3 w-3" />, label: "Edited" };
    default:
      return { icon: <Clock className="h-3 w-3" />, label: "Initial" };
  }
}

/**
 * RevisionSelector Component
 *
 * Dropdown menu for selecting between revisions with timeline visualization.
 */
export function RevisionSelector({
  revisions,
  currentRevisionId,
  onSelectRevision,
  className,
  compact = false,
}: RevisionSelectorProps) {
  // Find current revision
  const currentRevision = revisions.find((r) => r.id === currentRevisionId);
  const sortedRevisions = [...revisions].sort((a, b) => b.version - a.version);

  if (revisions.length === 0) {
    return null;
  }

  // Don't show if only one revision
  if (revisions.length === 1) {
    return (
      <div
        className={cn(
          "text-xs text-muted-foreground flex items-center gap-1",
          className,
        )}
      >
        <History className="h-3 w-3" />
        <span>Version 1</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", className)}
          data-testid="revision-selector"
        >
          <History className="h-4 w-4" />
          <span>
            Version {currentRevision?.version ?? 1}
            {" of "}
            {revisions.length}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Revision History
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {!compact && (
          <div className="relative px-2">
            {/* Timeline visualization */}
            {sortedRevisions.map((revision, index) => {
              const isActive = revision.id === currentRevisionId;
              const sourceInfo = getSourceInfo(revision.source);
              const hasBranch =
                revision.parentId &&
                sortedRevisions.find((r) => r.id === revision.parentId)
                  ?.version !==
                  revision.version - 1;

              return (
                <DropdownMenuItem
                  key={revision.id}
                  className={cn(
                    "flex items-start gap-3 py-2 cursor-pointer",
                    isActive && "bg-primary/5",
                  )}
                  onClick={() => onSelectRevision?.(revision)}
                  data-testid={`revision-item-${revision.version}`}
                >
                  {/* Timeline dot */}
                  <div className="relative flex flex-col items-center">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full border-2",
                        isActive
                          ? "bg-primary border-primary"
                          : "bg-background border-muted-foreground/50",
                      )}
                    />
                    {index < sortedRevisions.length - 1 && (
                      <div className="w-px h-6 bg-muted-foreground/30 absolute top-4" />
                    )}
                    {hasBranch && (
                      <GitBranch className="h-3 w-3 text-muted-foreground absolute -left-3" />
                    )}
                  </div>

                  {/* Revision info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-medium text-sm",
                          isActive && "text-primary",
                        )}
                      >
                        Version {revision.version}
                      </span>
                      {isActive && <Check className="h-3 w-3 text-primary" />}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {sourceInfo.icon}
                      <span>{sourceInfo.label}</span>
                      <span>•</span>
                      <span>{formatRelativeTime(revision.createdAt)}</span>
                    </div>
                    {revision.summary && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {revision.summary}
                      </p>
                    )}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}

        {compact && (
          <>
            {sortedRevisions.map((revision) => {
              const isActive = revision.id === currentRevisionId;
              return (
                <DropdownMenuItem
                  key={revision.id}
                  onClick={() => onSelectRevision?.(revision)}
                  className={cn(isActive && "bg-primary/5")}
                >
                  <span className="flex items-center gap-2">
                    Version {revision.version}
                    {isActive && <Check className="h-4 w-4" />}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Hook for revision state management
 */
export function useRevisionState(revisions: Revision[], initialId?: string) {
  const [currentId, setCurrentId] = React.useState(
    initialId ?? revisions[revisions.length - 1]?.id,
  );

  const current = React.useMemo(
    () => revisions.find((r) => r.id === currentId),
    [revisions, currentId],
  );

  const selectRevision = React.useCallback((revision: Revision) => {
    setCurrentId(revision.id);
  }, []);

  const isLatest =
    current?.version === Math.max(...revisions.map((r) => r.version));

  return {
    current,
    currentId,
    selectRevision,
    isLatest,
    totalRevisions: revisions.length,
  };
}
