import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Bot, Search, Clock, Filter, MoreVertical } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Conversations - Expert AI',
  description: 'View your conversation history with expert agents',
};

// Mock conversations - in real app, fetch from API/database
const conversations = [
  {
    id: 'conv-1',
    agent: 'Legal Advisor',
    title: 'Contract Review - NDA Agreement',
    lastMessage: 'Based on my analysis, there are 3 critical clauses that need revision...',
    updatedAt: '2 hours ago',
    status: 'active',
    messageCount: 12,
  },
  {
    id: 'conv-2',
    agent: 'Financial Analyst',
    title: 'Q4 Budget Planning',
    lastMessage: 'I recommend allocating 15% more to marketing based on the ROI projections...',
    updatedAt: '5 hours ago',
    status: 'active',
    messageCount: 8,
  },
  {
    id: 'conv-3',
    agent: 'Technical Writer',
    title: 'API Documentation Review',
    lastMessage: 'The authentication section could use more examples. Here are my suggestions...',
    updatedAt: 'Yesterday',
    status: 'completed',
    messageCount: 15,
  },
  {
    id: 'conv-4',
    agent: 'Code Reviewer',
    title: 'Security Audit - Auth Module',
    lastMessage: 'I found 2 potential security vulnerabilities in the token handling...',
    updatedAt: '2 days ago',
    status: 'completed',
    messageCount: 20,
  },
  {
    id: 'conv-5',
    agent: 'Marketing Strategist',
    title: 'Product Launch Campaign',
    lastMessage: 'Here\'s the complete campaign timeline with content recommendations...',
    updatedAt: '3 days ago',
    status: 'completed',
    messageCount: 25,
  },
];

export default function ConversationsPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conversations</h1>
          <p className="text-muted-foreground">
            Your conversation history with expert agents
          </p>
        </div>
        <Button asChild>
          <Link href="/agents">
            <Bot className="mr-2 h-4 w-4" />
            New Conversation
          </Link>
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input placeholder="Search conversations..." className="pl-8" />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Conversation List */}
      <div className="space-y-4">
        {conversations.map((conv) => (
          <Card key={conv.id} className="hover:border-primary/30 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
                    <Bot className="text-primary h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      <Link href={`/conversations/${conv.id}`} className="hover:text-primary">
                        {conv.title}
                      </Link>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <span>{conv.agent}</span>
                      <span>•</span>
                      <span>{conv.messageCount} messages</span>
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={conv.status === 'active' ? 'default' : 'secondary'}>
                    {conv.status === 'active' ? 'Active' : 'Completed'}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-3 line-clamp-2 text-sm">
                {conv.lastMessage}
              </p>
              <div className="text-muted-foreground flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3" />
                {conv.updatedAt}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State (hidden when there are conversations) */}
      {conversations.length === 0 && (
        <Card className="py-12 text-center">
          <CardContent>
            <Bot className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold">No conversations yet</h3>
            <p className="text-muted-foreground mb-4">
              Start a conversation with an expert agent to get help with your questions.
            </p>
            <Button asChild>
              <Link href="/agents">Browse Expert Agents</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
