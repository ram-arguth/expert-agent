import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FileText, Search, Download, Eye, Clock, Filter, MoreVertical } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Reports - Expert AI',
  description: 'View and download your generated reports',
};

// Mock reports - in real app, fetch from API/database
const reports = [
  {
    id: 'report-1',
    title: 'Contract Analysis Report - NDA Agreement',
    agent: 'Legal Advisor',
    createdAt: '2 hours ago',
    type: 'Legal Analysis',
    status: 'completed',
  },
  {
    id: 'report-2',
    title: 'Q4 Financial Overview',
    agent: 'Financial Analyst',
    createdAt: 'Yesterday',
    type: 'Financial Report',
    status: 'completed',
  },
  {
    id: 'report-3',
    title: 'API Documentation - v2.0',
    agent: 'Technical Writer',
    createdAt: '2 days ago',
    type: 'Technical Documentation',
    status: 'completed',
  },
  {
    id: 'report-4',
    title: 'Security Audit Results',
    agent: 'Code Reviewer',
    createdAt: '3 days ago',
    type: 'Security Analysis',
    status: 'completed',
  },
  {
    id: 'report-5',
    title: 'Marketing Campaign Strategy',
    agent: 'Marketing Strategist',
    createdAt: '1 week ago',
    type: 'Marketing Plan',
    status: 'completed',
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Generated reports and analysis from your expert agent conversations
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input placeholder="Search reports..." className="pl-8" />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Reports Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.id} className="hover:border-primary/30 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                  <FileText className="text-primary h-5 w-5" />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="mt-3 text-base">
                <Link href={`/reports/${report.id}`} className="hover:text-primary">
                  {report.title}
                </Link>
              </CardTitle>
              <CardDescription>{report.agent}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-2">
                <Badge variant="outline">{report.type}</Badge>
              </div>
              <div className="text-muted-foreground mb-4 flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3" />
                {report.createdAt}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link href={`/reports/${report.id}`}>
                    <Eye className="mr-1 h-3 w-3" />
                    View
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Download className="mr-1 h-3 w-3" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State (hidden when there are reports) */}
      {reports.length === 0 && (
        <Card className="py-12 text-center">
          <CardContent>
            <FileText className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold">No reports yet</h3>
            <p className="text-muted-foreground mb-4">
              Reports will appear here after completing conversations with expert agents.
            </p>
            <Button asChild>
              <Link href="/agents">Start a Conversation</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
