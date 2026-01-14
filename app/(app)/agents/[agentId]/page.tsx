/**
 * Agent Landing Page
 *
 * SSG page for individual agent details with:
 * - Agent description and capabilities
 * - Example use cases
 * - Feature highlights
 * - "Try Now" CTA
 *
 * @see docs/IMPLEMENTATION.md - Phase 2.5 Agent Landing Pages
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  FileText,
  Shield,
  Zap,
  MessageSquare,
  Upload,
  Clock,
} from 'lucide-react';

// =============================================================================
// Agent Data
// =============================================================================

interface AgentInfo {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  isBeta: boolean;
  isPublic: boolean;
  features: string[];
  useCases: Array<{
    title: string;
    description: string;
    example?: string;
  }>;
  capabilities: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  tier: 'free' | 'pro' | 'enterprise';
  tokensPerQuery: number;
}

// Agent catalog for SSG
const AGENTS: Record<string, AgentInfo> = {
  'ux-analyst': {
    id: 'ux-analyst',
    name: 'UX Analyst',
    tagline: 'Expert UX analysis powered by AI',
    description:
      'Get comprehensive UX analysis of your digital product. Our AI expert evaluates usability, accessibility, visual design, and information architecture to provide actionable insights that improve user experience.',
    category: 'Design',
    icon: '🎨',
    color: '#6366F1',
    isBeta: false,
    isPublic: true,
    features: [
      'Usability heuristic evaluation',
      'WCAG 2.1 accessibility audit',
      'Visual design assessment',
      'Information architecture review',
      'Mobile responsiveness check',
      'Performance impact analysis',
    ],
    useCases: [
      {
        title: 'Product Launch Review',
        description: 'Before launching, get a comprehensive UX audit to identify critical issues.',
        example: 'Upload screenshots of your checkout flow to identify friction points.',
      },
      {
        title: 'Redesign Planning',
        description: 'Prioritize redesign efforts based on severity and impact.',
        example: 'Analyze your current dashboard to get prioritized improvement recommendations.',
      },
      {
        title: 'Accessibility Compliance',
        description: 'Ensure your product meets WCAG 2.1 AA accessibility standards.',
        example: 'Check if your forms and navigation are accessible to screen readers.',
      },
      {
        title: 'Competitive Analysis',
        description: 'Compare your UX against industry best practices.',
        example: 'Get insights on how your product stacks up against competitors.',
      },
    ],
    capabilities: [
      {
        icon: 'upload',
        title: 'Screenshot Analysis',
        description: 'Upload screenshots or screen recordings for detailed visual analysis.',
      },
      {
        icon: 'zap',
        title: 'Instant Insights',
        description: 'Get prioritized findings and recommendations in seconds.',
      },
      {
        icon: 'shield',
        title: 'Accessibility Focus',
        description: 'WCAG 2.1 compliance checking for inclusive design.',
      },
      {
        icon: 'sparkles',
        title: 'Actionable Advice',
        description: 'Specific, implementable recommendations with effort estimates.',
      },
    ],
    faqs: [
      {
        question: 'What types of products can you analyze?',
        answer:
          'We can analyze any digital product including websites, web apps, mobile apps, dashboards, and SaaS products. Just upload screenshots or provide URLs.',
      },
      {
        question: 'How accurate is the AI analysis?',
        answer:
          'Our AI is trained on extensive UX research and heuristics. While it provides expert-level insights, we recommend combining AI analysis with user testing for best results.',
      },
      {
        question: 'Can I analyze competitor products?',
        answer:
          'Yes! You can upload screenshots of any publicly available product for competitive analysis and benchmarking.',
      },
    ],
    tier: 'free',
    tokensPerQuery: 1000,
  },
  'legal-advisor': {
    id: 'legal-advisor',
    name: 'Legal Advisor',
    tagline: 'AI-powered contract analysis',
    description:
      'Get expert analysis of your legal documents. Our AI reviews contracts, identifies risks, and provides actionable recommendations to protect your interests.',
    category: 'Legal',
    icon: '⚖️',
    color: '#8B5CF6',
    isBeta: true,
    isPublic: false,
    features: [
      'Contract risk assessment',
      'Clause-by-clause analysis',
      'Compliance verification',
      'Negotiation strategy',
      'Key terms extraction',
      'Multi-jurisdiction support',
    ],
    useCases: [
      {
        title: 'Contract Review',
        description: 'Before signing, understand the risks and obligations in any contract.',
        example: 'Upload an NDA to identify one-sided clauses and suggest balanced alternatives.',
      },
      {
        title: 'Vendor Agreement Analysis',
        description: 'Evaluate service agreements to protect your business interests.',
        example: 'Review a SaaS agreement for liability caps and data protection terms.',
      },
      {
        title: 'Employment Contracts',
        description: 'Understand employment terms, non-competes, and compensation structures.',
        example: 'Analyze an offer letter to identify unusual or unfavorable terms.',
      },
      {
        title: 'Compliance Check',
        description: 'Verify contracts meet regulatory requirements for your industry.',
        example: 'Check if a data processing agreement meets GDPR requirements.',
      },
    ],
    capabilities: [
      {
        icon: 'file',
        title: 'Document Upload',
        description: 'Upload PDF, DOCX, or TXT files for comprehensive analysis.',
      },
      {
        icon: 'shield',
        title: 'Risk Identification',
        description: 'Automatic detection of high-risk clauses and missing protections.',
      },
      {
        icon: 'sparkles',
        title: 'Plain Language',
        description: 'Complex legal terms explained in easy-to-understand language.',
      },
      {
        icon: 'message',
        title: 'Negotiation Tips',
        description: 'Suggested language for improving unfavorable terms.',
      },
    ],
    faqs: [
      {
        question: 'Is this a substitute for legal advice?',
        answer:
          'No. Our AI provides informational analysis to help you understand contracts, but it is not a substitute for advice from a licensed attorney. Always consult a lawyer for important legal decisions.',
      },
      {
        question: 'What jurisdictions are supported?',
        answer:
          'We support US (all states), UK, EU, Canada, Australia, and Singapore contract law. The analysis considers jurisdiction-specific regulations.',
      },
      {
        question: 'Is my document kept confidential?',
        answer:
          'Yes. Documents are processed securely and not stored permanently. We use enterprise-grade encryption and do not train on user documents.',
      },
    ],
    tier: 'pro',
    tokensPerQuery: 2000,
  },
  'finance-planner': {
    id: 'finance-planner',
    name: 'Finance Planner',
    tagline: 'AI-powered financial planning',
    description:
      'Get comprehensive financial planning assistance. From budgeting to retirement planning, our AI helps you make informed decisions about your financial future.',
    category: 'Finance',
    icon: '📊',
    color: '#10B981',
    isBeta: true,
    isPublic: false,
    features: [
      'Budget analysis',
      'Investment recommendations',
      'Retirement projections',
      'Tax optimization strategies',
      'Debt management plans',
      'Financial health assessment',
    ],
    useCases: [
      {
        title: 'Budget Planning',
        description: 'Analyze your income and expenses to create an optimal budget.',
        example: 'Upload bank statements to identify spending patterns and savings opportunities.',
      },
      {
        title: 'Retirement Planning',
        description: 'Project your retirement savings and identify gaps.',
        example: 'Calculate if you are on track for retirement at 65 with $2M savings.',
      },
      {
        title: 'Investment Strategy',
        description: 'Get asset allocation recommendations based on your risk tolerance.',
        example: 'Receive a diversified portfolio recommendation for moderate risk tolerance.',
      },
      {
        title: 'Debt Payoff',
        description: 'Create a strategic plan to eliminate debt efficiently.',
        example: 'Compare snowball vs avalanche methods for your specific debts.',
      },
    ],
    capabilities: [
      {
        icon: 'upload',
        title: 'Document Analysis',
        description: 'Upload financial statements, tax returns, and investment reports.',
      },
      {
        icon: 'zap',
        title: 'Instant Projections',
        description: 'See multiple scenario projections for your financial future.',
      },
      {
        icon: 'shield',
        title: 'Risk Assessment',
        description: 'Understand and mitigate financial risks in your plan.',
      },
      {
        icon: 'sparkles',
        title: 'Action Plan',
        description: 'Get prioritized, actionable steps to achieve your goals.',
      },
    ],
    faqs: [
      {
        question: 'Is this financial advice?',
        answer:
          'No. Our AI provides informational analysis and educational content. It is not a substitute for advice from a licensed financial advisor. Always consult professionals for important financial decisions.',
      },
      {
        question: 'What currencies are supported?',
        answer:
          'We support USD, EUR, GBP, CAD, AUD, JPY, and CHF. All projections are calculated in your selected currency.',
      },
      {
        question: 'How accurate are the projections?',
        answer:
          'Projections are estimates based on historical data and provided assumptions. Actual results will vary based on market conditions and personal circumstances.',
      },
    ],
    tier: 'pro',
    tokensPerQuery: 2000,
  },
};

// =============================================================================
// SSG Configuration
// =============================================================================

/**
 * Generate static paths for all agents
 */
export function generateStaticParams() {
  return Object.keys(AGENTS).map((agentId) => ({
    agentId,
  }));
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ agentId: string }>;
}): Promise<Metadata> {
  const { agentId } = await params;
  const agent = AGENTS[agentId];

  if (!agent) {
    return {
      title: 'Agent Not Found - Expert AI',
    };
  }

  return {
    title: `${agent.name} - Expert AI`,
    description: agent.description,
    openGraph: {
      title: `${agent.name} - Expert AI`,
      description: agent.tagline,
      type: 'website',
    },
  };
}

// =============================================================================
// Icon Component
// =============================================================================

function CapabilityIcon({ icon }: { icon: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    upload: <Upload className="h-6 w-6" />,
    zap: <Zap className="h-6 w-6" />,
    shield: <Shield className="h-6 w-6" />,
    sparkles: <Sparkles className="h-6 w-6" />,
    file: <FileText className="h-6 w-6" />,
    message: <MessageSquare className="h-6 w-6" />,
    clock: <Clock className="h-6 w-6" />,
  };
  return iconMap[icon] || <Bot className="h-6 w-6" />;
}

// =============================================================================
// Page Component
// =============================================================================

export default async function AgentLandingPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const agent = AGENTS[agentId];

  if (!agent) {
    notFound();
  }

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white md:p-12">
        <div className="relative z-10 max-w-3xl">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-5xl">{agent.icon}</span>
            {agent.isBeta && (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300">
                Beta
              </Badge>
            )}
            <Badge variant="secondary" className="bg-white/10">
              {agent.category}
            </Badge>
          </div>
          <h1 className="mb-4 text-4xl font-bold md:text-5xl">{agent.name}</h1>
          <p className="mb-6 text-xl text-slate-300">{agent.tagline}</p>
          <p className="mb-8 text-slate-400">{agent.description}</p>
          <div className="flex flex-wrap gap-4">
            <Button size="lg" className="gap-2" asChild>
              <Link href={`/chat?agent=${agent.id}`}>
                Try {agent.name}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/20 bg-white/5" asChild>
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>
        </div>
        {/* Background decoration */}
        <div
          className="absolute right-0 top-0 h-full w-1/2 opacity-10"
          style={{
            background: `radial-gradient(circle at 70% 50%, ${agent.color}, transparent 60%)`,
          }}
        />
      </section>

      {/* Features Grid */}
      <section>
        <h2 className="mb-8 text-center text-2xl font-bold">What You Get</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agent.features.map((feature, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities Section */}
      <section className="rounded-2xl bg-muted/50 p-8 md:p-12">
        <h2 className="mb-8 text-center text-2xl font-bold">Capabilities</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {agent.capabilities.map((capability, index) => (
            <div key={index} className="text-center">
              <div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${agent.color}20` }}
              >
                <span style={{ color: agent.color }}>
                  <CapabilityIcon icon={capability.icon} />
                </span>
              </div>
              <h3 className="mb-2 font-semibold">{capability.title}</h3>
              <p className="text-sm text-muted-foreground">{capability.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use Cases Section */}
      <section>
        <h2 className="mb-8 text-center text-2xl font-bold">Use Cases</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {agent.useCases.map((useCase, index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {index + 1}
                  </span>
                  {useCase.title}
                </CardTitle>
                <CardDescription>{useCase.description}</CardDescription>
              </CardHeader>
              {useCase.example && (
                <CardContent className="pt-4">
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <strong className="text-muted-foreground">Example:</strong> {useCase.example}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section>
        <h2 className="mb-8 text-center text-2xl font-bold">Frequently Asked Questions</h2>
        <div className="mx-auto max-w-3xl space-y-4">
          {agent.faqs.map((faq, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{faq.question}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{faq.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-8 text-center md:p-12">
        <h2 className="mb-4 text-2xl font-bold">Ready to Get Started?</h2>
        <p className="mb-8 text-muted-foreground">
          Try {agent.name} now and get expert-level insights in seconds.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" className="gap-2" asChild>
            <Link href={`/chat?agent=${agent.id}`}>
              Start Using {agent.name}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
          {agent.tier !== 'free' && (
            <p className="w-full text-sm text-muted-foreground">
              Requires {agent.tier === 'pro' ? 'Pro' : 'Enterprise'} plan
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
