'use client';

/**
 * useEscapeKey Hook
 *
 * A standardized hook for handling ESC key dismissal across all components.
 */

import { useEffect, useCallback } from 'react';

/**
 * Hook to handle ESC key press for dismissing UI elements
 *
 * @param onEscape - Callback to run when ESC is pressed
 * @param enabled - Whether the handler is active (default: true)
 * @param deps - Additional dependencies for the callback
 */
export function useEscapeKey(
  onEscape: () => void,
  enabled: boolean = true,
  deps: React.DependencyList = []
): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleEscape = useCallback(onEscape, deps);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        handleEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [enabled, handleEscape]);
}

/**
 * Wrapper component for ESC key dismissal
 */
interface EscapeDismissibleProps {
  /** Callback when ESC is pressed */
  onClose: () => void;
  /** Whether the handler is active */
  enabled?: boolean;
  /** Children to render */
  children: React.ReactNode;
}

export function EscapeDismissible({
  onClose,
  enabled = true,
  children,
}: EscapeDismissibleProps): React.ReactNode {
  useEscapeKey(onClose, enabled);
  return children;
}
