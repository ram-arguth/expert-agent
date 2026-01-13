import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, MessageSquare, Shield, Zap, Users, ArrowRight } from 'lucide-react';
import { HomeHeader } from '@/components/layouts/home-header';
import { AppFooter } from '@/components/layouts/app-footer';

// Force dynamic rendering to avoid SSR issues with client hooks in HomeHeader
export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      {/* Session-aware Header */}
      <HomeHeader />

      {/* Hero */}
      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 text-center">
          <Badge variant="secondary" className="mb-4">
            AI-Powered Domain Expertise
          </Badge>
          <h1 className="mb-6 text-5xl font-bold tracking-tight">
            Expert AI Agents
            <br />
            <span className="text-primary">For Every Domain</span>
          </h1>
          <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg">
            Access specialized AI experts in legal, finance, health, and more. Get high-quality,
            context-aware answers powered by domain-specific knowledge and guidance.
          </p>
          <div className="flex justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/agents" className="inline-flex items-center">
                <Bot className="mr-2 h-4 w-4" />
                <span>Explore Agents</span>
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/signup">Get Started Free</Link>
            </Button>
          </div>
        </section>

        {/* How it works */}
        <section className="container mx-auto px-4 py-16">
          <h2 className="mb-12 text-center text-3xl font-bold">How It Works</h2>
          <div className="grid gap-8 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="bg-primary/10 mb-2 flex h-12 w-12 items-center justify-center rounded-lg">
                  <Bot className="text-primary h-6 w-6" />
                </div>
                <CardTitle>1. Choose an Expert</CardTitle>
                <CardDescription>
                  Select from our catalog of specialized AI agents for your domain
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <div className="bg-primary/10 mb-2 flex h-12 w-12 items-center justify-center rounded-lg">
                  <MessageSquare className="text-primary h-6 w-6" />
                </div>
                <CardTitle>2. Provide Context</CardTitle>
                <CardDescription>
                  Upload documents, images, or describe your situation for tailored advice
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <div className="bg-primary/10 mb-2 flex h-12 w-12 items-center justify-center rounded-lg">
                  <Zap className="text-primary h-6 w-6" />
                </div>
                <CardTitle>3. Get Expert Insights</CardTitle>
                <CardDescription>
                  Receive detailed, structured reports with actionable recommendations
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* Features */}
        <section className="bg-muted/50 py-16">
          <div className="container mx-auto px-4">
            <h2 className="mb-12 text-center text-3xl font-bold">Why Expert AI?</h2>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="text-center">
                <div className="bg-primary/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <Bot className="text-primary h-6 w-6" />
                </div>
                <h3 className="mb-2 font-semibold">Domain Expertise</h3>
                <p className="text-muted-foreground text-sm">
                  Agents preloaded with specialized knowledge for your industry
                </p>
              </div>
              <div className="text-center">
                <div className="bg-primary/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <Shield className="text-primary h-6 w-6" />
                </div>
                <h3 className="mb-2 font-semibold">Secure & Private</h3>
                <p className="text-muted-foreground text-sm">
                  Enterprise-grade security with strict tenant isolation
                </p>
              </div>
              <div className="text-center">
                <div className="bg-primary/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <Users className="text-primary h-6 w-6" />
                </div>
                <h3 className="mb-2 font-semibold">Team & Enterprise</h3>
                <p className="text-muted-foreground text-sm">
                  Shared context, SSO, and centralized billing for organizations
                </p>
              </div>
              <div className="text-center">
                <div className="bg-primary/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <Zap className="text-primary h-6 w-6" />
                </div>
                <h3 className="mb-2 font-semibold">Multimodal Input</h3>
                <p className="text-muted-foreground text-sm">
                  Upload PDFs, images, and documents for comprehensive analysis
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Agent Categories Preview */}
        <section className="container mx-auto px-4 py-16">
          <h2 className="mb-8 text-center text-3xl font-bold">Expert Agents</h2>
          <p className="text-muted-foreground mx-auto mb-12 max-w-2xl text-center">
            Our growing catalog of specialized AI agents covers a wide range of domains
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                name: 'Legal Advisor',
                description: 'Contract review, compliance, and legal document analysis',
                badge: 'Popular',
              },
              {
                name: 'Financial Analyst',
                description: 'Investment analysis, budgeting, and financial planning',
                badge: null,
              },
              {
                name: 'Health Consultant',
                description: 'Medical information and wellness guidance',
                badge: null,
              },
              {
                name: 'Technical Writer',
                description: 'Documentation, tutorials, and technical content',
                badge: 'New',
              },
              {
                name: 'Marketing Strategist',
                description: 'Campaign planning, copywriting, and market analysis',
                badge: null,
              },
              {
                name: 'Code Reviewer',
                description: 'Code analysis, best practices, and security review',
                badge: null,
              },
            ].map((agent) => (
              <Card key={agent.name} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    {agent.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {agent.badge}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{agent.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button variant="outline" asChild>
              <Link href="/agents" className="inline-flex items-center">
                View All Agents
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-primary py-16 text-center">
          <div className="container mx-auto px-4">
            <h2 className="text-primary-foreground mb-4 text-3xl font-bold">
              Ready to Get Expert Advice?
            </h2>
            <p className="text-primary-foreground/80 mx-auto mb-8 max-w-xl">
              Start with our free tier and experience the power of domain-specific AI expertise.
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/signup">Get Started Free</Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <AppFooter />
    </div>
  );
}
