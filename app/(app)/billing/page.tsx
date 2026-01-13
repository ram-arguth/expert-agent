import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Check, Zap, CreditCard, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Billing - Expert AI',
  description: 'Manage your subscription and billing',
};

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For personal use and exploration',
    tokens: '10,000',
    features: ['10,000 tokens/month', 'All expert agents', 'Basic reports', 'Email support'],
    current: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: 'per month',
    description: 'For professionals and power users',
    tokens: '100,000',
    features: [
      '100,000 tokens/month',
      'All expert agents',
      'Advanced reports',
      'Priority support',
      'Export to PDF/DOCX',
      'API access',
    ],
    current: true,
    popular: true,
  },
  {
    name: 'Team',
    price: '$99',
    period: 'per month',
    description: 'For small teams',
    tokens: '500,000',
    features: [
      '500,000 tokens/month',
      'Up to 10 team members',
      'Shared context & reports',
      'Team analytics',
      'SSO support',
      'Dedicated support',
    ],
    current: false,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations',
    tokens: 'Unlimited',
    features: [
      'Unlimited tokens',
      'Unlimited team members',
      'Custom agents',
      'Private deployment',
      'SLA guarantee',
      'Custom integrations',
    ],
    current: false,
  },
];

export default function BillingPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing information
        </p>
      </div>

      {/* Current Usage */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan: Pro</CardTitle>
              <CardDescription>Your billing cycle resets on February 1, 2026</CardDescription>
            </div>
            <Badge variant="secondary">Active</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Token Usage</span>
              <span className="text-muted-foreground text-sm">45,231 / 100,000</span>
            </div>
            <Progress value={45} />
            <p className="text-muted-foreground mt-2 text-xs">
              Resets in 18 days
            </p>
          </div>
          <div className="flex gap-4">
            <Button variant="outline" className="flex-1">
              <CreditCard className="mr-2 h-4 w-4" />
              Update Payment
            </Button>
            <Button variant="outline" className="flex-1">
              View Invoices
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <div>
        <h2 className="mb-6 text-2xl font-bold">Available Plans</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative ${plan.current ? 'border-primary' : ''} ${plan.popular ? 'shadow-lg' : ''}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground text-sm"> {plan.period}</span>
                  )}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-primary/10 mb-4 flex items-center gap-2 rounded-lg p-3">
                  <Zap className="text-primary h-4 w-4" />
                  <span className="text-sm font-medium">{plan.tokens} tokens/month</span>
                </div>
                <ul className="mb-6 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="text-primary h-4 w-4" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.current ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : plan.name === 'Enterprise' ? (
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/contact">
                      Contact Sales
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button className="w-full">
                    Upgrade
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle>Billing FAQ</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-4 text-sm">
          <p>
            <strong className="text-foreground">What happens if I run out of tokens?</strong>
            <br />
            You can purchase additional token packs or wait for your monthly reset.
          </p>
          <p>
            <strong className="text-foreground">Can I change plans anytime?</strong>
            <br />
            Yes, you can upgrade or downgrade at any time. Changes take effect immediately.
          </p>
          <p>
            <strong className="text-foreground">Do unused tokens roll over?</strong>
            <br />
            Standard tokens reset monthly. Enterprise plans can negotiate rollover terms.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
