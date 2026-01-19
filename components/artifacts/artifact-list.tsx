/**
 * Artifact List Component
 *
 * Displays a list of user's artifacts with favorites/pinning support.
 * Supports filtering by: favorites, recent, shared-with-me.
 *
 * @see docs/IMPEMENTATION.md - Phase 4.7
 */

"use client";

import { useState, useMemo } from "react";
import { Star, Clock, Share2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * Artifact data structure
 */
export interface Artifact {
  id: string;
  title: string;
  agentName: string;
  agentId: string;
  createdAt: Date;
  updatedAt: Date;
  isFavorite: boolean;
  isShared: boolean;
  sharedBy?: string;
  preview?: string;
}

/**
 * Filter type for artifact list
 */
export type ArtifactFilter = "all" | "favorites" | "recent" | "shared";

/**
 * Props for ArtifactList component
 */
export interface ArtifactListProps {
  artifacts: Artifact[];
  isLoading?: boolean;
  error?: string;
  onArtifactClick?: (artifact: Artifact) => void;
  onToggleFavorite?: (id: string, isFavorite: boolean) => Promise<void>;
  className?: string;
  defaultFilter?: ArtifactFilter;
}

/**
 * Format relative time for display
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Single artifact card
 */
function ArtifactCard({
  artifact,
  onToggleFavorite,
  onClick,
}: {
  artifact: Artifact;
  onToggleFavorite?: (id: string, isFavorite: boolean) => Promise<void>;
  onClick?: (artifact: Artifact) => void;
}) {
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggleFavorite) return;

    setIsTogglingFavorite(true);
    try {
      await onToggleFavorite(artifact.id, !artifact.isFavorite);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
        onClick && "hover:bg-accent/50",
      )}
      onClick={() => onClick?.(artifact)}
      data-testid={`artifact-card-${artifact.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base line-clamp-1">
              {artifact.title}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleFavoriteClick}
            disabled={isTogglingFavorite}
            aria-label={
              artifact.isFavorite ? "Remove from favorites" : "Add to favorites"
            }
            data-testid={`favorite-toggle-${artifact.id}`}
          >
            {isTogglingFavorite ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Star
                className={cn(
                  "h-4 w-4",
                  artifact.isFavorite
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground",
                )}
              />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {artifact.agentName}
          </Badge>
          <span className="text-xs">
            {formatRelativeTime(artifact.updatedAt)}
          </span>
          {artifact.isShared && (
            <div className="flex items-center gap-1">
              <Share2 className="h-3 w-3" />
              {artifact.sharedBy && (
                <span className="text-xs">by {artifact.sharedBy}</span>
              )}
            </div>
          )}
        </div>
        {artifact.preview && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {artifact.preview}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * ArtifactList Component
 *
 * Displays artifacts with filtering and favorite management.
 */
export function ArtifactList({
  artifacts,
  isLoading = false,
  error,
  onArtifactClick,
  onToggleFavorite,
  className,
  defaultFilter = "all",
}: ArtifactListProps) {
  const [filter, setFilter] = useState<ArtifactFilter>(defaultFilter);

  const filteredArtifacts = useMemo(() => {
    switch (filter) {
      case "favorites":
        return artifacts.filter((a) => a.isFavorite);
      case "recent":
        return [...artifacts]
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .slice(0, 10);
      case "shared":
        return artifacts.filter((a) => a.isShared);
      default:
        return artifacts;
    }
  }, [artifacts, filter]);

  if (isLoading) {
    return (
      <div
        className={cn("flex items-center justify-center py-12", className)}
        data-testid="artifact-list-loading"
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn("text-center py-12", className)}
        data-testid="artifact-list-error"
      >
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)} data-testid="artifact-list">
      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as ArtifactFilter)}
      >
        <TabsList>
          <TabsTrigger value="all" data-testid="filter-all">
            All
          </TabsTrigger>
          <TabsTrigger value="favorites" data-testid="filter-favorites">
            <Star className="h-4 w-4 mr-1" />
            Favorites
          </TabsTrigger>
          <TabsTrigger value="recent" data-testid="filter-recent">
            <Clock className="h-4 w-4 mr-1" />
            Recent
          </TabsTrigger>
          <TabsTrigger value="shared" data-testid="filter-shared">
            <Share2 className="h-4 w-4 mr-1" />
            Shared
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredArtifacts.length === 0 ? (
        <div
          className="text-center py-12 text-muted-foreground"
          data-testid="artifact-list-empty"
        >
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No artifacts found</p>
          {filter !== "all" && (
            <Button
              variant="link"
              onClick={() => setFilter("all")}
              className="mt-2"
            >
              View all artifacts
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredArtifacts.map((artifact) => (
            <ArtifactCard
              key={artifact.id}
              artifact={artifact}
              onToggleFavorite={onToggleFavorite}
              onClick={onArtifactClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ArtifactList;
