/**
 * Agent Landing Page Tests
 *
 * Tests for the agent landing page component:
 * - SSG generation
 * - Metadata generation
 * - Content rendering
 * - Not found handling
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AgentLandingPage, {
  generateStaticParams,
  generateMetadata,
} from '../page';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe('Agent Landing Page', () => {
  describe('generateStaticParams', () => {
    it('returns params for all agents', () => {
      const params = generateStaticParams();

      expect(Array.isArray(params)).toBe(true);
      expect(params.length).toBeGreaterThan(0);

      // Each param should have agentId
      params.forEach((param) => {
        expect(param).toHaveProperty('agentId');
        expect(typeof param.agentId).toBe('string');
      });
    });

    it('includes UX Analyst', () => {
      const params = generateStaticParams();
      const uxAnalyst = params.find((p) => p.agentId === 'ux-analyst');
      expect(uxAnalyst).toBeDefined();
    });

    it('includes Legal Advisor', () => {
      const params = generateStaticParams();
      const legalAdvisor = params.find((p) => p.agentId === 'legal-advisor');
      expect(legalAdvisor).toBeDefined();
    });

    it('includes Finance Planner', () => {
      const params = generateStaticParams();
      const financePlanner = params.find((p) => p.agentId === 'finance-planner');
      expect(financePlanner).toBeDefined();
    });
  });

  describe('generateMetadata', () => {
    it('generates metadata for valid agent', async () => {
      const metadata = await generateMetadata({
        params: Promise.resolve({ agentId: 'ux-analyst' }),
      });

      expect(metadata.title).toContain('UX Analyst');
      expect(metadata.description).toBeDefined();
      expect(metadata.openGraph).toBeDefined();
    });

    it('generates not found metadata for invalid agent', async () => {
      const metadata = await generateMetadata({
        params: Promise.resolve({ agentId: 'non-existent-agent' }),
      });

      expect(metadata.title).toContain('Not Found');
    });

    it('includes OpenGraph data for SEO', async () => {
      const metadata = await generateMetadata({
        params: Promise.resolve({ agentId: 'legal-advisor' }),
      });

      expect(metadata.openGraph?.title).toContain('Legal Advisor');
      // Type is set in the page, verify openGraph is defined
      expect(metadata.openGraph).toBeDefined();
    });
  });

  describe('Page Rendering', () => {
    it('renders UX Analyst page with all sections', async () => {
      const Page = await AgentLandingPage({
        params: Promise.resolve({ agentId: 'ux-analyst' }),
      });

      render(Page);

      // Hero section
      expect(screen.getByText('UX Analyst')).toBeInTheDocument();
      expect(screen.getByText(/Expert UX analysis/i)).toBeInTheDocument();

      // Features section
      expect(screen.getByText('What You Get')).toBeInTheDocument();
      expect(screen.getByText(/Usability heuristic evaluation/i)).toBeInTheDocument();

      // Capabilities section
      expect(screen.getByText('Capabilities')).toBeInTheDocument();

      // Use Cases section
      expect(screen.getByText('Use Cases')).toBeInTheDocument();

      // FAQ section
      expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();

      // CTA section
      expect(screen.getByText('Ready to Get Started?')).toBeInTheDocument();
    });

    it('renders Legal Advisor page', async () => {
      const Page = await AgentLandingPage({
        params: Promise.resolve({ agentId: 'legal-advisor' }),
      });

      render(Page);

      expect(screen.getByText('Legal Advisor')).toBeInTheDocument();
      expect(screen.getByText(/AI-powered contract analysis/i)).toBeInTheDocument();
    });

    it('renders Finance Planner page', async () => {
      const Page = await AgentLandingPage({
        params: Promise.resolve({ agentId: 'finance-planner' }),
      });

      render(Page);

      expect(screen.getByText('Finance Planner')).toBeInTheDocument();
      expect(screen.getByText(/AI-powered financial planning/i)).toBeInTheDocument();
    });

    it('shows beta badge for beta agents', async () => {
      const Page = await AgentLandingPage({
        params: Promise.resolve({ agentId: 'legal-advisor' }),
      });

      render(Page);

      expect(screen.getByText('Beta')).toBeInTheDocument();
    });

    it('does not show beta badge for released agents', async () => {
      const Page = await AgentLandingPage({
        params: Promise.resolve({ agentId: 'ux-analyst' }),
      });

      render(Page);

      expect(screen.queryByText('Beta')).not.toBeInTheDocument();
    });

    it('includes try now CTA with correct link', async () => {
      const Page = await AgentLandingPage({
        params: Promise.resolve({ agentId: 'ux-analyst' }),
      });

      render(Page);

      const tryLinks = screen.getAllByRole('link', { name: /Try|Start Using/i });
      expect(tryLinks.length).toBeGreaterThan(0);

      // At least one link should point to chat with agent parameter
      const chatLink = tryLinks.find((link) =>
        link.getAttribute('href')?.includes('/chat?agent=ux-analyst')
      );
      expect(chatLink).toBeDefined();
    });

    it('includes pricing link', async () => {
      const Page = await AgentLandingPage({
        params: Promise.resolve({ agentId: 'ux-analyst' }),
      });

      render(Page);

      const pricingLink = screen.getByRole('link', { name: /View Pricing/i });
      expect(pricingLink).toHaveAttribute('href', '/pricing');
    });

    it('renders features list', async () => {
      const Page = await AgentLandingPage({
        params: Promise.resolve({ agentId: 'ux-analyst' }),
      });

      render(Page);

      expect(screen.getByText(/WCAG 2.1 accessibility audit/i)).toBeInTheDocument();
      expect(screen.getByText(/Visual design assessment/i)).toBeInTheDocument();
    });

    it('renders use cases with examples', async () => {
      const Page = await AgentLandingPage({
        params: Promise.resolve({ agentId: 'ux-analyst' }),
      });

      render(Page);

      expect(screen.getByText('Product Launch Review')).toBeInTheDocument();
      expect(screen.getByText(/Upload screenshots of your checkout flow/i)).toBeInTheDocument();
    });

    it('renders FAQ section', async () => {
      const Page = await AgentLandingPage({
        params: Promise.resolve({ agentId: 'ux-analyst' }),
      });

      render(Page);

      expect(screen.getByText(/What types of products can you analyze/i)).toBeInTheDocument();
    });

    it('calls notFound for invalid agent', async () => {
      await expect(
        AgentLandingPage({
          params: Promise.resolve({ agentId: 'non-existent-agent' }),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND');
    });
  });

  describe('Tier Display', () => {
    it('shows tier requirement for pro agents', async () => {
      const Page = await AgentLandingPage({
        params: Promise.resolve({ agentId: 'legal-advisor' }),
      });

      render(Page);

      expect(screen.getByText(/Requires Pro plan/i)).toBeInTheDocument();
    });

    it('does not show tier requirement for free agents', async () => {
      const Page = await AgentLandingPage({
        params: Promise.resolve({ agentId: 'ux-analyst' }),
      });

      render(Page);

      expect(screen.queryByText(/Requires.*plan/i)).not.toBeInTheDocument();
    });
  });

  describe('Category Display', () => {
    it('displays agent category badge', async () => {
      const Page = await AgentLandingPage({
        params: Promise.resolve({ agentId: 'ux-analyst' }),
      });

      render(Page);

      expect(screen.getByText('Design')).toBeInTheDocument();
    });

    it('displays correct category for legal agent', async () => {
      const Page = await AgentLandingPage({
        params: Promise.resolve({ agentId: 'legal-advisor' }),
      });

      render(Page);

      expect(screen.getByText('Legal')).toBeInTheDocument();
    });

    it('displays correct category for finance agent', async () => {
      const Page = await AgentLandingPage({
        params: Promise.resolve({ agentId: 'finance-planner' }),
      });

      render(Page);

      expect(screen.getByText('Finance')).toBeInTheDocument();
    });
  });
});
