'use client';

/**
 * useConnectionStatus Hook
 *
 * Monitors connection status for real-time features.
 */

import * as React from 'react';

export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'offline';

export interface UseConnectionStatusReturn {
  /** Whether the browser is online */
  isOnline: boolean;
  /** Estimated connection quality */
  connectionQuality: ConnectionQuality;
  /** Timestamp of last successful connection */
  lastConnected: Date | null;
  /** Whether connection was just restored */
  wasReconnected: boolean;
}

export function useConnectionStatus(): UseConnectionStatusReturn {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lastConnected, setLastConnected] = React.useState<Date | null>(
    isOnline ? new Date() : null
  );
  const [wasReconnected, setWasReconnected] = React.useState(false);

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastConnected(new Date());
      setWasReconnected(true);
      setTimeout(() => setWasReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const connectionQuality = React.useMemo((): ConnectionQuality => {
    if (!isOnline) return 'offline';

    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (
        navigator as Navigator & {
          connection?: {
            effectiveType?: string;
            downlink?: number;
          };
        }
      ).connection;

      if (connection?.effectiveType) {
        switch (connection.effectiveType) {
          case '4g':
            return 'excellent';
          case '3g':
            return 'good';
          case '2g':
          case 'slow-2g':
            return 'poor';
          default:
            return 'good';
        }
      }

      if (connection?.downlink) {
        if (connection.downlink >= 10) return 'excellent';
        if (connection.downlink >= 2) return 'good';
        return 'poor';
      }
    }

    return 'good';
  }, [isOnline]);

  return {
    isOnline,
    connectionQuality,
    lastConnected,
    wasReconnected,
  };
}
