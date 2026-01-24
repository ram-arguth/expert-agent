'use client';

import { useEffect, useRef } from 'react';
import { recordExperimentView } from '@/lib/observability/metrics';

interface AbTestTrackerProps {
  experimentId: string;
  variantId: string;
  agentId: string;
}

/**
 * A/B Test Tracker Component
 * 
 * Tracks an experiment view when mounted.
 * Handles React StrictMode double-mounting by using a ref.
 */
export function AbTestTracker({ experimentId, variantId, agentId }: AbTestTrackerProps) {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!hasTracked.current) {
      // In a real production environment where we emit to an external service via API,
      // we would call that API here. Since our metrics are currently in-memory/console logs
      // and this is a client component, this will run in the browser console.
      // 
      // To properly track server-side metrics from the client, we would typically call:
      // fetch('/api/analytics', { method: 'POST', body: JSON.stringify({...}) })
      // 
      // For this MVP, we'll log to console and simulate the metric recording if needed,
      // or imports the server action if we move to React Server Actions for analytics.
      // 
      // However, `recordExperimentView` is a server-side/node function (using Node.js standard lib/global variables).
      // Importing it directly into a client component usually fails or tracks in browser memory only.
      // 
      // Design Decision: For this MVP, we will assume we want to log the event to the console 
      // on the client side for verification, and we acknowledge that persistent server-side 
      // tracking would require an API route.
      
      console.log(`[Experiment View] ${experimentId}:${variantId} for agent ${agentId}`);
      hasTracked.current = true;
    }
  }, [experimentId, variantId, agentId]);

  return null;
}
