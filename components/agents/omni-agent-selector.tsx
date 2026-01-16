/**
 * OmniAgent Selector Component
 *
 * A dropdown that allows users to:
 * - Select from available agents
 * - Type a query and let OmniAI classify it
 * - See "Ask OmniAI" as the first option
 * - Optionally show confirmation dialog for classifications
 *
 * Uses the existing simple Select component API
 *
 * @see docs/IMPLEMENTATION.md - Phase 2.6 UI Integration
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { OmniConfirmDialog } from "./omni-confirm-dialog";

// =============================================================================
// Types
// =============================================================================

export interface AgentOption {
  id: string;
  name: string;
  description: string;
  category: string;
  isBeta?: boolean;
}

export interface OmniClassificationResult {
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

export interface OmniAgentSelectorProps {
  agents: AgentOption[];
  onSelectAgent: (agentId: string) => void;
  onOmniQuery?: (query: string, result: OmniClassificationResult) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  showSearch?: boolean;
  /** Show confirmation dialog when OmniAI classifies a query */
  showConfirmDialog?: boolean;
}

// =============================================================================
// Classification Hook
// =============================================================================

function useOmniClassification() {
  const [isClassifying, setIsClassifying] = React.useState(false);
  const [result, setResult] = React.useState<OmniClassificationResult | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  const classify = React.useCallback(
    async (query: string): Promise<OmniClassificationResult | null> => {
      if (query.length < 5) {
        setResult(null);
        return null;
      }

      setIsClassifying(true);
      setError(null);

      try {
        const response = await fetch("/api/omni/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        if (!response.ok) {
          throw new Error("Classification failed");
        }

        const data = await response.json();
        setResult(data);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Classification failed");
        return null;
      } finally {
        setIsClassifying(false);
      }
    },
    [],
  );

  const reset = React.useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { classify, result, isClassifying, error, reset };
}

// =============================================================================
// OmniAgent Selector Component
// =============================================================================

export function OmniAgentSelector({
  agents,
  onSelectAgent,
  onOmniQuery,
  className,
  placeholder = "Select an agent...",
  disabled = false,
  showSearch = false,
  showConfirmDialog = false,
}: OmniAgentSelectorProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedAgent, setSelectedAgent] = React.useState<
    string | undefined
  >();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pendingQuery, setPendingQuery] = React.useState("");
  const { classify, result, isClassifying, reset } = useOmniClassification();

  // Build options array for Select component
  // Add OmniAI as first option, then agents grouped by category
  const selectOptions = React.useMemo(() => {
    const options: { value: string; label: string }[] = [
      { value: "omni", label: "✨ Ask OmniAI" },
    ];

    // Sort agents by category, then by name
    const sortedAgents = [...agents].sort((a, b) => {
      const catCompare = (a.category || "General").localeCompare(
        b.category || "General",
      );
      if (catCompare !== 0) return catCompare;
      return a.name.localeCompare(b.name);
    });

    // Group by category with category prefix
    let currentCategory = "";
    sortedAgents.forEach((agent) => {
      const category = agent.category || "General";
      if (category !== currentCategory) {
        // Add category separator (using — in label)
        options.push({ value: `__cat_${category}`, label: `— ${category} —` });
        currentCategory = category;
      }
      options.push({
        value: agent.id,
        label: agent.isBeta ? `${agent.name} (Beta)` : agent.name,
      });
    });

    return options;
  }, [agents]);

  // Handle confirmation from dialog
  const handleConfirmAgent = React.useCallback(
    (agentId: string) => {
      onSelectAgent(agentId);
      if (onOmniQuery && pendingQuery && result) {
        onOmniQuery(pendingQuery, result);
      }
      setDialogOpen(false);
      reset();
      router.push(`/chat?agent=${agentId}`);
    },
    [onSelectAgent, onOmniQuery, pendingQuery, result, reset, router],
  );

  // Handle dialog close
  const handleDialogClose = React.useCallback(() => {
    setDialogOpen(false);
    reset();
  }, [reset]);

  // Handle agent selection
  const handleSelectAgent = (value: string) => {
    // Ignore category separators
    if (value.startsWith("__cat_")) return;

    setSelectedAgent(value);

    if (value === "omni") {
      // Handle OmniAI selection
      if (searchQuery.length >= 5) {
        setPendingQuery(searchQuery);

        if (showConfirmDialog) {
          // Open confirmation dialog and start classification
          setDialogOpen(true);
          classify(searchQuery);
        } else {
          // Legacy behavior: go directly to suggested agent
          classify(searchQuery).then((classResult) => {
            if (classResult?.suggestedAgentId) {
              onSelectAgent(classResult.suggestedAgentId);
              if (onOmniQuery) {
                onOmniQuery(searchQuery, classResult);
              }
              router.push(`/chat?agent=${classResult.suggestedAgentId}`);
            }
          });
        }
      }
    } else {
      onSelectAgent(value);
      router.push(`/chat?agent=${value}`);
    }
  };

  // Handle clicking the OmniAI suggestion
  const handleSuggestionClick = () => {
    if (result?.suggestedAgentId) {
      if (showConfirmDialog) {
        setPendingQuery(searchQuery);
        setDialogOpen(true);
      } else {
        onSelectAgent(result.suggestedAgentId);
        if (onOmniQuery && searchQuery) {
          onOmniQuery(searchQuery, result);
        }
        router.push(`/chat?agent=${result.suggestedAgentId}`);
      }
    }
  };

  return (
    <div
      className={cn("space-y-2", className)}
      data-testid="omni-agent-selector"
    >
      {/* Optional Search Input for OmniAI */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Describe your task for OmniAI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="omni-search-input"
          />
          {isClassifying && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {/* OmniAI Suggestion Banner */}
      {result?.suggestedAgentId && (
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-primary/50 bg-primary/5"
          onClick={handleSuggestionClick}
          data-testid="omni-suggestion"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="flex-1 text-left">
            <span className="font-medium">{result.agentName}</span>
            <Badge variant="secondary" className="ml-2 text-xs">
              {Math.round(result.confidence * 100)}% match
            </Badge>
          </span>
        </Button>
      )}

      {/* Agent Select Dropdown */}
      <Select
        value={selectedAgent}
        onValueChange={handleSelectAgent}
        placeholder={placeholder}
        options={selectOptions}
        disabled={disabled}
        data-testid="agent-select"
      />

      {/* Confirmation Dialog */}
      <OmniConfirmDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onConfirm={handleConfirmAgent}
        query={pendingQuery}
        result={result}
        isLoading={isClassifying}
      />
    </div>
  );
}

export default OmniAgentSelector;
