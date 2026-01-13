/**
 * Agent Sidebar Component
 *
 * Displays a list of available agents from the API with:
 * - Category grouping
 * - Beta badges
 * - Active agent highlighting
 * - Loading and error states
 *
 * @see docs/IMPEMENTATION.md - Phase 4.1
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace, createOrgHeaders } from '@/lib/context/workspace-context';

/**
 * Agent type from API
 */
export interface Agent {
  id: string;
  name: string;
  description: string;
  category: string;
  isBeta?: boolean;
  isNew?: boolean;
  icon?: string;
}

/**
 * Group agents by category
 */
function groupByCategory(agents: Agent[]): Record<string, Agent[]> {
  return agents.reduce(
    (acc, agent) => {
      const category = agent.category || 'General';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(agent);
      return acc;
    },
    {} as Record<string, Agent[]>
  );
}

/**
 * Fetch agents from API
 */
async function fetchAgents(orgHeaders: Record<string, string>): Promise<Agent[]> {
  const response = await fetch('/api/agents', {
    headers: orgHeaders,
  });

  if (!response.ok) {
    throw new Error('Failed to load agents');
  }

  const data = await response.json();
  return data.agents || [];
}

/**
 * Hook to fetch and manage agents
 */
function useAgents() {
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { activeOrgId } = useWorkspace();

  React.useEffect(() => {
    const loadAgents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const headers = createOrgHeaders(activeOrgId);
        const data = await fetchAgents(headers);
        setAgents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      } finally {
        setIsLoading(false);
      }
    };

    loadAgents();
  }, [activeOrgId]);

  return { agents, isLoading, error };
}

export interface AgentSidebarProps {
  className?: string;
  onSelectAgent?: (agentId: string) => void;
}

/**
 * Agent Sidebar Component
 *
 * Lists all available agents grouped by category
 */
export function AgentSidebar({ className, onSelectAgent }: AgentSidebarProps) {
  const pathname = usePathname();
  const { agents, isLoading, error } = useAgents();

  // Get active agent from URL
  const activeAgentId = React.useMemo(() => {
    const match = pathname?.match(/\/agents\/([^/]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  // Group agents by category
  const groupedAgents = React.useMemo(() => groupByCategory(agents), [agents]);

  // Sort categories alphabetically, but put "Featured" first if exists
  const sortedCategories = React.useMemo(() => {
    const categories = Object.keys(groupedAgents);
    return categories.sort((a, b) => {
      if (a === 'Featured') return -1;
      if (b === 'Featured') return 1;
      return a.localeCompare(b);
    });
  }, [groupedAgents]);

  if (isLoading) {
    return (
      <aside className={cn('border-r bg-card w-64', className)}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-semibold">Expert Agents</span>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className={cn('border-r bg-card w-64', className)}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn('border-r bg-card w-64 flex flex-col', className)}
      data-testid="agent-sidebar"
    >
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-semibold">Expert Agents</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Select an agent to start
        </p>
      </div>

      {/* Agent List */}
      <ScrollArea className="flex-1">
        <nav className="p-2" aria-label="Agent navigation">
          {sortedCategories.map((category, categoryIndex) => (
            <div key={category}>
              {categoryIndex > 0 && <Separator className="my-2" />}
              <div className="px-2 py-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {category}
                </span>
              </div>
              <div className="space-y-1">
                {groupedAgents[category].map((agent) => {
                  const isActive = activeAgentId === agent.id;

                  return (
                    <Link
                      key={agent.id}
                      href={`/agents/${agent.id}`}
                      onClick={() => onSelectAgent?.(agent.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                        'hover:bg-accent hover:text-accent-foreground',
                        isActive && 'bg-primary text-primary-foreground hover:bg-primary/90'
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Bot className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{agent.name}</span>
                      {agent.isBeta && (
                        <Badge
                          variant="secondary"
                          className="text-xs py-0 px-1.5"
                        >
                          Beta
                        </Badge>
                      )}
                      {agent.isNew && (
                        <Badge
                          variant="outline"
                          className="text-xs py-0 px-1.5 border-green-500 text-green-600"
                        >
                          <Sparkles className="h-3 w-3 mr-0.5" />
                          New
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {agents.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No agents available
            </div>
          )}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t">
        <Link
          href="/agents"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Browse all agents →
        </Link>
      </div>
    </aside>
  );
}
