import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Bot, MessageSquare, FileText, TrendingUp, Clock, Zap } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Dashboard - Expert AI',
  description: 'Your Expert AI dashboard',
};

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here&apos;s an overview of your activity.</p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversations</CardTitle>
            <MessageSquare className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-muted-foreground text-xs">+3 from last week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reports Generated</CardTitle>
            <FileText className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-muted-foreground text-xs">+2 from last week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens Used</CardTitle>
            <Zap className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45,231</div>
            <p className="text-muted-foreground text-xs">of 100,000 quota</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agents Used</CardTitle>
            <Bot className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-muted-foreground text-xs">Different expert agents</p>
          </CardContent>
        </Card>
      </div>

      {/* Token Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Token Usage This Month</CardTitle>
          <CardDescription>Your current token consumption and remaining quota</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">45,231 / 100,000 tokens</span>
            <span className="text-muted-foreground text-sm">45% used</span>
          </div>
          <Progress value={45} />
          <p className="text-muted-foreground text-sm">
            Resets in 18 days. <Link href="/billing" className="text-primary hover:underline">Upgrade plan</Link> for more tokens.
          </p>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Conversations</CardTitle>
            <CardDescription>Your latest interactions with expert agents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { agent: 'Legal Advisor', topic: 'Contract Review - NDA', time: '2 hours ago' },
                { agent: 'Financial Analyst', topic: 'Q4 Budget Analysis', time: '5 hours ago' },
                { agent: 'Technical Writer', topic: 'API Documentation', time: 'Yesterday' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-full">
                      <Bot className="text-primary h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.topic}</p>
                      <p className="text-muted-foreground text-xs">{item.agent}</p>
                    </div>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    {item.time}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="mt-4 w-full" asChild>
              <Link href="/conversations">View All Conversations</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Start a new conversation with an expert</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: 'Legal Advisor', description: 'Contract review & legal advice' },
              { name: 'Financial Analyst', description: 'Financial planning & analysis' },
              { name: 'Code Reviewer', description: 'Code analysis & best practices' },
            ].map((agent) => (
              <Button
                key={agent.name}
                variant="outline"
                className="h-auto w-full justify-start py-3"
                asChild
              >
                <Link href={`/agents/${agent.name.toLowerCase().replace(' ', '-')}`}>
                  <div className="flex items-center gap-3">
                    <Bot className="text-primary h-5 w-5" />
                    <div className="text-left">
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-muted-foreground text-xs">{agent.description}</div>
                    </div>
                  </div>
                </Link>
              </Button>
            ))}
            <Button className="w-full" asChild>
              <Link href="/agents">Browse All Agents</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
