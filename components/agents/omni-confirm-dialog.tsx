/**
 * OmniAgent Confirmation Dialog
 *
 * Shows a confirmation dialog when OmniAI classifies a query.
 * Displays the suggested agent, confidence level, and alternatives.
 * Especially useful for ambiguous queries.
 *
 * @see docs/IMPLEMENTATION.md - Phase 2.6 Confirmation UX
 */

"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  HelpCircle,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

export interface ClassificationResult {
  suggestedAgentId: string | null;
  agentName: string | null;
  confidence: number;
  reasoning: string;
  alternatives?: Array<{
    agentId: string;
    agentName: string;
    confidence: number;
  }>;
  noMatchSuggestion?: string;
}

export interface OmniConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed without selection */
  onClose: () => void;
  /** Callback when user confirms/selects an agent */
  onConfirm: (agentId: string) => void;
  /** The original query that was classified */
  query: string;
  /** The classification result from OmniAI */
  result: ClassificationResult | null;
  /** Loading state for when classification is in progress */
  isLoading?: boolean;
}

// =============================================================================
// Helper: Confidence Badge
// =============================================================================

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);

  if (percent >= 80) {
    return (
      <Badge
        variant="default"
        className="bg-green-500/10 text-green-600 border-green-500/20"
      >
        <CheckCircle className="h-3 w-3 mr-1" />
        {percent}% confident
      </Badge>
    );
  }

  if (percent >= 50) {
    return (
      <Badge
        variant="default"
        className="bg-amber-500/10 text-amber-600 border-amber-500/20"
      >
        <HelpCircle className="h-3 w-3 mr-1" />
        {percent}% confident
      </Badge>
    );
  }

  return (
    <Badge
      variant="default"
      className="bg-red-500/10 text-red-600 border-red-500/20"
    >
      <AlertCircle className="h-3 w-3 mr-1" />
      {percent}% confident
    </Badge>
  );
}

// =============================================================================
// OmniConfirmDialog Component
// =============================================================================

export function OmniConfirmDialog({
  open,
  onClose,
  onConfirm,
  query,
  result,
  isLoading = false,
}: OmniConfirmDialogProps) {
  // Handle ESC key to close dialog
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  // No match state
  const hasNoMatch = !result?.suggestedAgentId;

  // Low confidence state (< 50%)
  const isLowConfidence = (result?.confidence ?? 0) < 0.5;

  // Has alternatives
  const hasAlternatives = (result?.alternatives?.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="omni-confirm-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            OmniAI Suggestion
          </DialogTitle>
          <DialogDescription className="sr-only">
            Review OmniAI&apos;s agent suggestion for your query
          </DialogDescription>
        </DialogHeader>

        {/* Query Display */}
        <div className="rounded-lg bg-muted p-3 text-sm">
          <span className="text-muted-foreground">Your question:</span>
          <p className="mt-1 font-medium">&quot;{query}&quot;</p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div
            className="flex items-center justify-center py-8"
            data-testid="loading-state"
          >
            <div className="animate-pulse text-muted-foreground">
              Analyzing your question...
            </div>
          </div>
        )}

        {/* No Match State */}
        {!isLoading && hasNoMatch && (
          <div className="space-y-3 py-4" data-testid="no-match-state">
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  No suitable expert found
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {result?.noMatchSuggestion ||
                    "We don't have a specialized expert for this topic yet. Try rephrasing your question or select an agent manually."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Suggested Agent */}
        {!isLoading && result?.suggestedAgentId && (
          <div className="space-y-3" data-testid="suggestion-state">
            {/* Main Suggestion */}
            <div
              className={cn(
                "rounded-lg border p-4 cursor-pointer transition-colors hover:bg-accent",
                isLowConfidence
                  ? "border-amber-500/30"
                  : "border-primary/30 bg-primary/5",
              )}
              onClick={() => onConfirm(result.suggestedAgentId!)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === "Enter" && onConfirm(result.suggestedAgentId!)
              }
              data-testid="main-suggestion"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{result.agentName}</span>
                  <ConfidenceBadge confidence={result.confidence} />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {result.reasoning}
              </p>
            </div>

            {/* Low Confidence Warning */}
            {isLowConfidence && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Low confidence match. Consider alternatives below or select
                manually.
              </p>
            )}

            {/* Alternatives */}
            {hasAlternatives && (
              <div className="space-y-2" data-testid="alternatives-section">
                <p className="text-sm font-medium text-muted-foreground">
                  Other suggestions:
                </p>
                {result.alternatives!.map((alt) => (
                  <div
                    key={alt.agentId}
                    className="rounded-lg border p-3 cursor-pointer transition-colors hover:bg-accent"
                    onClick={() => onConfirm(alt.agentId)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) =>
                      e.key === "Enter" && onConfirm(alt.agentId)
                    }
                    data-testid={`alternative-${alt.agentId}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {alt.agentName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(alt.confidence * 100)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} data-testid="cancel-button">
            Select Manually
          </Button>
          {result?.suggestedAgentId && (
            <Button
              onClick={() => onConfirm(result.suggestedAgentId!)}
              data-testid="confirm-button"
            >
              Use {result.agentName}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default OmniConfirmDialog;
