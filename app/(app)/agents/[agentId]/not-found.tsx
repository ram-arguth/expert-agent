/**
 * Agent Not Found Page
 *
 * Displayed when accessing a non-existent agent
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, Bot } from 'lucide-react';

export default function AgentNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
        <Bot className="h-12 w-12 text-muted-foreground" />
      </div>
      <div className="mb-2 flex items-center gap-2 text-destructive">
        <AlertCircle className="h-5 w-5" />
        <span className="font-medium">Agent Not Found</span>
      </div>
      <h1 className="mb-4 text-2xl font-bold">
        This agent doesn&apos;t exist
      </h1>
      <p className="mb-8 max-w-md text-muted-foreground">
        The agent you&apos;re looking for may have been removed or the URL might be incorrect.
        Check out our available agents below.
      </p>
      <div className="flex gap-4">
        <Button variant="outline" asChild>
          <Link href="/agents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Browse Agents
          </Link>
        </Button>
        <Button asChild>
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </div>
  );
}
