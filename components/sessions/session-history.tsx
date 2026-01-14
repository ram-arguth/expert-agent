/**
 * Session History Component
 *
 * Displays a list of past sessions and allows switching between them.
 * Includes search, filtering by agent, and session metadata.
 *
 * @see docs/IMPEMENTATION.md - Phase 4.5
 * @see docs/DESIGN.md - Session Management
 */

'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  MessageSquare, 
  Clock, 
  Search, 
  ChevronDown,
  RefreshCw,
  Archive,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * Session data structure from API
 */
export interface SessionData {
  id: string;
  agentId: string;
  agentName: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: {
    id: string;
    role: string;
    preview: string;
    createdAt: string;
  } | null;
  archived: boolean;
}

/**
 * Props for the SessionHistory component
 */
export interface SessionHistoryProps {
  /** Optional agent ID to filter sessions */
  agentId?: string;
  /** Currently active session ID */
  activeSessionId?: string;
  /** Callback when a session is selected */
  onSelectSession?: (session: SessionData) => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the search input */
  showSearch?: boolean;
  /** Maximum number of sessions to show initially */
  initialLimit?: number;
}

/**
 * Custom hook for fetching sessions
 */
function useSessions(agentId?: string, limit = 20) {
  const [sessions, setSessions] = React.useState<SessionData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [cursor, setCursor] = React.useState<string | null>(null);

  const fetchSessions = React.useCallback(async (isLoadMore = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (agentId) params.set('agentId', agentId);
      params.set('limit', limit.toString());
      if (isLoadMore && cursor) params.set('cursor', cursor);

      const response = await fetch(`/api/sessions?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.status}`);
      }

      const data = await response.json();
      
      if (isLoadMore) {
        setSessions(prev => [...prev, ...data.sessions]);
      } else {
        setSessions(data.sessions);
      }
      
      setHasMore(data.pagination.hasMore);
      setCursor(data.pagination.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [agentId, limit, cursor]);

  // Initial fetch
  React.useEffect(() => {
    fetchSessions(false);
  }, [agentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = React.useCallback(() => {
    if (!isLoading && hasMore) {
      fetchSessions(true);
    }
  }, [isLoading, hasMore, fetchSessions]);

  const refresh = React.useCallback(() => {
    setCursor(null);
    fetchSessions(false);
  }, [fetchSessions]);

  return { sessions, isLoading, error, hasMore, loadMore, refresh };
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Single session item component
 */
function SessionItem({
  session,
  isActive,
  onClick,
}: {
  session: SessionData;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg transition-colors',
        'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        isActive && 'bg-primary/10 border-l-2 border-primary',
        session.archived && 'opacity-60'
      )}
      data-testid={`session-item-${session.id}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isActive ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}>
          {session.archived ? (
            <Archive className="h-4 w-4" />
          ) : (
            <MessageSquare className="h-4 w-4" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm truncate">
              {session.agentName}
            </span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatRelativeTime(session.updatedAt)}
            </span>
          </div>
          
          {session.lastMessage ? (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {session.lastMessage.preview}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic mt-1">
              No messages yet
            </p>
          )}
          
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {session.messageCount}
            </span>
            {session.archived && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Archive className="h-3 w-3" />
                Archived
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

/**
 * SessionHistory Component
 *
 * Displays past sessions with search and filtering.
 */
export function SessionHistory({
  agentId,
  activeSessionId,
  onSelectSession,
  className,
  showSearch = true,
  initialLimit = 20,
}: SessionHistoryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = React.useState('');
  
  const { sessions, isLoading, error, hasMore, loadMore, refresh } = useSessions(
    agentId,
    initialLimit
  );

  // Filter sessions by search query
  const filteredSessions = React.useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    
    const query = searchQuery.toLowerCase();
    return sessions.filter(session => 
      session.agentName.toLowerCase().includes(query) ||
      session.lastMessage?.preview.toLowerCase().includes(query)
    );
  }, [sessions, searchQuery]);

  // Handle session selection
  const handleSelectSession = React.useCallback((session: SessionData) => {
    if (onSelectSession) {
      onSelectSession(session);
    } else {
      // Default: navigate to session
      router.push(`/conversations/${session.id}`);
    }
  }, [onSelectSession, router]);

  // Empty state
  if (!isLoading && sessions.length === 0 && !error) {
    return (
      <div 
        className={cn('flex flex-col items-center justify-center py-8 text-center', className)}
        data-testid="session-history-empty"
      >
        <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-1">No sessions yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Start a conversation with an agent to see your session history here.
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div 
        className={cn('flex flex-col items-center justify-center py-8 text-center', className)}
        data-testid="session-history-error"
      >
        <AlertCircle className="h-12 w-12 text-destructive/50 mb-4" />
        <h3 className="text-lg font-medium mb-1">Failed to load sessions</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {error.message}
        </p>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)} data-testid="session-history">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">Session History</h2>
        <Button variant="ghost" size="icon" onClick={refresh} disabled={isLoading}>
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="session-search"
            />
          </div>
        </div>
      )}

      {/* Session list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading && sessions.length === 0 ? (
            // Loading skeleton
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-3/4" />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <>
              {filteredSessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  onClick={() => handleSelectSession(session)}
                />
              ))}
              
              {/* Load more */}
              {hasMore && searchQuery === '' && (
                <div className="p-2 text-center">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={loadMore}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Load more
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {/* No results */}
              {filteredSessions.length === 0 && searchQuery !== '' && (
                <div className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No sessions match &quot;{searchQuery}&quot;
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
