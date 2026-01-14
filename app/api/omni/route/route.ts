/**
 * OmniAgent Route API
 *
 * Classifies user queries and routes them to the most appropriate expert agent.
 * Uses Gemini 3 Flash for lightweight classification.
 *
 * @see docs/DESIGN.md - OmniAgent Orchestrator section
 * @see docs/IMPLEMENTATION.md - Phase 2.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { logger } from '@/lib/observability';

// =============================================================================
// Schemas
// =============================================================================

const RouteRequestSchema = z.object({
  query: z.string().min(5).max(2000).describe('User query to classify'),
  includeAlternatives: z.boolean().optional().default(true),
});

export type RouteRequest = z.infer<typeof RouteRequestSchema>;

const RouteResponseSchema = z.object({
  suggestedAgentId: z.string().nullable(),
  agentName: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  alternatives: z.array(
    z.object({
      agentId: z.string(),
      agentName: z.string(),
      confidence: z.number(),
      reason: z.string(),
    })
  ).optional(),
  noMatchSuggestion: z.string().optional(),
});

export type RouteResponse = z.infer<typeof RouteResponseSchema>;

// =============================================================================
// Agent Registry (for classification)
// =============================================================================

interface AgentClassification {
  id: string;
  name: string;
  keywords: string[];
  description: string;
  domains: string[];
}

const AGENT_REGISTRY: AgentClassification[] = [
  {
    id: 'ux-analyst',
    name: 'UX Analyst',
    keywords: ['ux', 'usability', 'accessibility', 'design', 'user experience', 'interface', 'ui', 'layout', 'navigation', 'wcag', 'screenshot', 'mockup', 'wireframe', 'prototype'],
    description: 'Analyzes user interfaces for usability, accessibility, and design quality',
    domains: ['design', 'product', 'web', 'mobile', 'accessibility'],
  },
  {
    id: 'legal-advisor',
    name: 'Legal Advisor',
    keywords: ['contract', 'legal', 'agreement', 'nda', 'terms', 'compliance', 'liability', 'clause', 'law', 'jurisdiction', 'employment contract', 'service agreement', 'license', 'intellectual property', 'trademark', 'copyright'],
    description: 'Reviews contracts and legal documents, identifies risks, and provides recommendations',
    domains: ['legal', 'contracts', 'compliance', 'business law'],
  },
  {
    id: 'finance-planner',
    name: 'Finance Planner',
    keywords: ['budget', 'investment', 'retirement', 'savings', 'tax', 'financial', 'money', 'debt', 'income', 'expense', '401k', 'ira', 'portfolio', 'stocks', 'bonds', 'mortgage', 'loan'],
    description: 'Provides financial planning, budgeting, and investment guidance',
    domains: ['finance', 'personal-finance', 'investing', 'tax', 'retirement'],
  },
];

// =============================================================================
// Classification Logic
// =============================================================================

interface ClassificationResult {
  agentId: string | null;
  agentName: string | null;
  confidence: number;
  reasoning: string;
  alternatives: Array<{
    agentId: string;
    agentName: string;
    confidence: number;
    reason: string;
  }>;
}

/**
 * Simple keyword-based classification with confidence scoring
 * In production, this would use Gemini 3 Flash for more sophisticated classification
 */
function classifyQuery(query: string): ClassificationResult {
  const normalizedQuery = query.toLowerCase();
  const scores: Array<{ agent: AgentClassification; score: number; matchedKeywords: string[] }> = [];

  for (const agent of AGENT_REGISTRY) {
    let score = 0;
    const matchedKeywords: string[] = [];

    // Keyword matching (weighted)
    for (const keyword of agent.keywords) {
      if (normalizedQuery.includes(keyword)) {
        // Longer keywords are more specific, worth more
        const keywordWeight = keyword.split(' ').length > 1 ? 3 : 1;
        score += keywordWeight;
        matchedKeywords.push(keyword);
      }
    }

    // Domain matching
    for (const domain of agent.domains) {
      if (normalizedQuery.includes(domain)) {
        score += 2;
        matchedKeywords.push(domain);
      }
    }

    if (score > 0) {
      scores.push({ agent, score, matchedKeywords });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  if (scores.length === 0) {
    return {
      agentId: null,
      agentName: null,
      confidence: 0,
      reasoning: 'No matching expert found for this query. The query does not contain keywords related to our available agents.',
      alternatives: [],
    };
  }

  // Calculate confidence based on score difference and absolute score
  const topScore = scores[0].score;
  const maxPossibleScore = scores[0].agent.keywords.length + scores[0].agent.domains.length * 2;
  const normalizedConfidence = Math.min(1, (topScore / Math.max(maxPossibleScore, 5)) * 1.5);

  // Generate alternatives
  const alternatives = scores.slice(1, 4).map((s) => ({
    agentId: s.agent.id,
    agentName: s.agent.name,
    confidence: Math.min(1, (s.score / Math.max(maxPossibleScore, 5)) * 1.5),
    reason: `Matched keywords: ${s.matchedKeywords.slice(0, 3).join(', ')}`,
  }));

  return {
    agentId: scores[0].agent.id,
    agentName: scores[0].agent.name,
    confidence: normalizedConfidence,
    reasoning: `Best match based on keywords: ${scores[0].matchedKeywords.slice(0, 5).join(', ')}. ${scores[0].agent.description}`,
    alternatives,
  };
}

// =============================================================================
// Route Handler
// =============================================================================

export async function POST(request: NextRequest) {
  const log = logger.child({ route: '/api/omni/route', method: 'POST' });

  try {
    // Authentication (optional - classification can work without auth)
    const session = await auth();
    const userId = session?.user?.id || 'anonymous';

    log.info({ userId }, 'OmniAgent route request received');

    // Parse and validate request body
    const body = await request.json();
    const parseResult = RouteRequestSchema.safeParse(body);

    if (!parseResult.success) {
      log.warn({ errors: parseResult.error.errors }, 'Invalid request body');
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: parseResult.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { query, includeAlternatives } = parseResult.data;

    // Classify the query
    const classification = classifyQuery(query);

    log.info(
      {
        userId,
        queryLength: query.length,
        suggestedAgentId: classification.agentId,
        confidence: classification.confidence,
      },
      'Query classified'
    );

    // Build response
    const response: RouteResponse = {
      suggestedAgentId: classification.agentId,
      agentName: classification.agentName,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
    };

    if (includeAlternatives && classification.alternatives.length > 0) {
      response.alternatives = classification.alternatives;
    }

    // Add suggestion if no match
    if (!classification.agentId) {
      response.noMatchSuggestion =
        "We don't have an expert for that topic yet. Would you like to suggest we add one?";
    }

    return NextResponse.json(response);
  } catch (error) {
    log.error({ error }, 'OmniAgent route error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET handler for available agents
// =============================================================================

export async function GET() {
  return NextResponse.json({
    agents: AGENT_REGISTRY.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      domains: a.domains,
    })),
  });
}
