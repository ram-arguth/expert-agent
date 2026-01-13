import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search, Book, MessageSquare, Mail, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Help & Support - Expert AI',
  description: 'Get help with Expert AI',
};

const faqs = [
  {
    question: 'What are Expert AI agents?',
    answer: 'Expert AI agents are specialized AI assistants preloaded with domain-specific knowledge. Each agent is designed to provide expert-level guidance in a specific field like law, finance, technology, or marketing.',
  },
  {
    question: 'How do I choose the right agent?',
    answer: 'Browse our agent catalog and select the agent that matches your needs. Each agent has a description of their expertise. If you\'re unsure, you can use our OmniAgent which will route your question to the most appropriate expert.',
  },
  {
    question: 'What file types can I upload?',
    answer: 'You can upload PDFs, images (PNG, JPG), and text documents. Our agents can analyze these files to provide context-aware responses.',
  },
  {
    question: 'How does billing work?',
    answer: 'We offer a token-based billing system. Each plan includes a monthly token quota. Tokens are consumed based on the complexity of your queries. You can purchase additional tokens or upgrade your plan anytime.',
  },
  {
    question: 'Can I share reports with my team?',
    answer: 'Yes! If you\'re on a Team or Enterprise plan, you can share reports with team members. You can also export reports as PDF or DOCX for external sharing.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Absolutely. We use enterprise-grade security with strict tenant isolation. Your data is encrypted at rest and in transit. Enterprise customers can also use their own SSO and custom security policies.',
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Help & Support</h1>
        <p className="text-muted-foreground mt-2">
          Find answers to common questions or contact our support team
        </p>
      </div>

      {/* Search */}
      <div className="mx-auto max-w-xl">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
          <Input placeholder="Search for help..." className="pl-10 py-6 text-lg" />
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:border-primary/50 cursor-pointer transition-colors">
          <CardHeader>
            <div className="bg-primary/10 mb-2 flex h-10 w-10 items-center justify-center rounded-lg">
              <Book className="text-primary h-5 w-5" />
            </div>
            <CardTitle className="text-lg">Documentation</CardTitle>
            <CardDescription>
              Comprehensive guides and API documentation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" className="p-0 h-auto" asChild>
              <Link href="/docs" className="flex items-center gap-1">
                Browse Docs
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 cursor-pointer transition-colors">
          <CardHeader>
            <div className="bg-primary/10 mb-2 flex h-10 w-10 items-center justify-center rounded-lg">
              <MessageSquare className="text-primary h-5 w-5" />
            </div>
            <CardTitle className="text-lg">Community</CardTitle>
            <CardDescription>
              Connect with other users and share tips
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" className="p-0 h-auto" asChild>
              <Link href="/community" className="flex items-center gap-1">
                Join Community
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 cursor-pointer transition-colors">
          <CardHeader>
            <div className="bg-primary/10 mb-2 flex h-10 w-10 items-center justify-center rounded-lg">
              <Mail className="text-primary h-5 w-5" />
            </div>
            <CardTitle className="text-lg">Contact Support</CardTitle>
            <CardDescription>
              Get help from our support team directly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" className="p-0 h-auto" asChild>
              <Link href="mailto:support@expertai.com" className="flex items-center gap-1">
                Email Us
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
          <CardDescription>
            Quick answers to common questions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Contact CTA */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="py-8 text-center">
          <h3 className="mb-2 text-xl font-semibold">Still need help?</h3>
          <p className="text-primary-foreground/80 mb-4">
            Our support team is available to assist you with any questions.
          </p>
          <Button variant="secondary" asChild>
            <Link href="mailto:support@expertai.com">Contact Support</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
