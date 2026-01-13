import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Bot, Search, Star, ArrowRight, Filter } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Expert Agents - Expert AI',
  description: 'Browse and interact with specialized AI expert agents',
};

// Agent catalog - in real app, fetch from API/database
const agents = [
  {
    id: 'legal-advisor',
    name: 'Legal Advisor',
    description: 'Contract review, compliance checking, and legal document analysis. Specializes in business law and corporate agreements.',
    category: 'Legal',
    badge: 'Popular',
    rating: 4.8,
    uses: 12500,
  },
  {
    id: 'financial-analyst',
    name: 'Financial Analyst',
    description: 'Investment analysis, budgeting, financial planning, and market research. Expertise in corporate finance and personal wealth management.',
    category: 'Finance',
    badge: null,
    rating: 4.7,
    uses: 8900,
  },
  {
    id: 'health-consultant',
    name: 'Health Consultant',
    description: 'Medical information, wellness guidance, and health-related research. General health advice and symptom information.',
    category: 'Health',
    badge: null,
    rating: 4.6,
    uses: 7200,
  },
  {
    id: 'technical-writer',
    name: 'Technical Writer',
    description: 'Documentation, tutorials, API guides, and technical content creation. Specializes in developer documentation.',
    category: 'Technology',
    badge: 'New',
    rating: 4.9,
    uses: 3400,
  },
  {
    id: 'marketing-strategist',
    name: 'Marketing Strategist',
    description: 'Campaign planning, copywriting, market analysis, and brand strategy. Digital marketing and content optimization.',
    category: 'Marketing',
    badge: null,
    rating: 4.5,
    uses: 5600,
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'Code analysis, best practices review, security auditing, and refactoring suggestions. Supports multiple programming languages.',
    category: 'Technology',
    badge: null,
    rating: 4.8,
    uses: 9100,
  },
  {
    id: 'hr-advisor',
    name: 'HR Advisor',
    description: 'Employee policies, hiring practices, performance management, and workplace compliance guidance.',
    category: 'Human Resources',
    badge: null,
    rating: 4.4,
    uses: 2800,
  },
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    description: 'Data interpretation, statistical analysis, visualization recommendations, and insights generation.',
    category: 'Analytics',
    badge: 'New',
    rating: 4.7,
    uses: 4100,
  },
];

const categories = ['All', 'Legal', 'Finance', 'Health', 'Technology', 'Marketing', 'Human Resources', 'Analytics'];

export default function AgentsPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Expert Agents</h1>
        <p className="text-muted-foreground">
          Choose a specialized AI expert to help with your specific needs
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input placeholder="Search agents..." className="pl-8" />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category}
            variant={category === 'All' ? 'default' : 'outline'}
            size="sm"
            className="rounded-full"
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Agent Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Card key={agent.id} className="hover:border-primary/50 group transition-all hover:shadow-md">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
                  <Bot className="text-primary h-6 w-6" />
                </div>
                {agent.badge && (
                  <Badge variant="secondary">{agent.badge}</Badge>
                )}
              </div>
              <CardTitle className="mt-4">{agent.name}</CardTitle>
              <CardDescription className="line-clamp-2">{agent.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{agent.rating}</span>
                </div>
                <Badge variant="outline">{agent.category}</Badge>
                <span className="text-muted-foreground">{agent.uses.toLocaleString()} uses</span>
              </div>
              <Button className="w-full group-hover:bg-primary/90" asChild>
                <Link href={`/agents/${agent.id}`}>
                  Start Conversation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
