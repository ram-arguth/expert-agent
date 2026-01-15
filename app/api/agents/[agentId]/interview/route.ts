/**
 * Guided Interview API
 *
 * Manages multi-turn context gathering for agents with `supportsGuidedInterview: true`.
 * Returns interview questions one at a time with progress tracking.
 *
 * @see docs/DESIGN.md - Guided Interview Mode section
 * @see docs/IMPLEMENTATION.md - Phase 2.8
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { logger } from '@/lib/observability';

// =============================================================================
// Types and Schemas
// =============================================================================

const InterviewRequestSchema = z.object({
  sessionId: z.string().optional().describe('Existing session ID to continue, or omit to start new'),
  answer: z.string().optional().describe('Answer to the current question (required if continuing)'),
  skipQuestion: z.boolean().optional().default(false).describe('Skip current optional question'),
});

export type InterviewRequest = z.infer<typeof InterviewRequestSchema>;

const InterviewStepSchema = z.object({
  id: z.string(),
  question: z.string(),
  description: z.string().optional(),
  type: z.enum(['text', 'textarea', 'select', 'multiselect', 'file', 'boolean']),
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
  })).optional(),
  required: z.boolean(),
  placeholder: z.string().optional(),
  validation: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
  }).optional(),
});

export type InterviewStep = z.infer<typeof InterviewStepSchema>;

const InterviewResponseSchema = z.object({
  sessionId: z.string(),
  currentStep: z.number(),
  totalSteps: z.number(),
  progress: z.number().min(0).max(100),
  isComplete: z.boolean(),
  currentQuestion: InterviewStepSchema.nullable(),
  answers: z.record(z.string()).optional(),
  canStartAnalysis: z.boolean(),
  nextAction: z.enum(['answer', 'start_analysis', 'complete']),
});

export type InterviewResponse = z.infer<typeof InterviewResponseSchema>;

// =============================================================================
// Interview Configurations per Agent
// =============================================================================

interface InterviewConfig {
  agentId: string;
  steps: InterviewStep[];
  requiredStepIds: string[];
}

const INTERVIEW_CONFIGS: Record<string, InterviewConfig> = {
  'ux-analyst': {
    agentId: 'ux-analyst',
    steps: [
      {
        id: 'product-type',
        question: 'What type of product are you analyzing?',
        description: 'This helps us tailor the analysis to your specific context.',
        type: 'select',
        options: [
          { value: 'web-app', label: 'Web Application' },
          { value: 'mobile-app', label: 'Mobile App' },
          { value: 'website', label: 'Marketing Website' },
          { value: 'dashboard', label: 'Dashboard / Admin Panel' },
          { value: 'e-commerce', label: 'E-commerce Site' },
          { value: 'saas', label: 'SaaS Product' },
          { value: 'other', label: 'Other' },
        ],
        required: true,
      },
      {
        id: 'target-audience',
        question: 'Who is your target audience?',
        description: 'Understanding your users helps us evaluate the UX appropriately.',
        type: 'textarea',
        placeholder: 'e.g., Small business owners aged 30-50, tech-savvy consumers...',
        required: true,
        validation: { minLength: 10, maxLength: 500 },
      },
      {
        id: 'primary-task',
        question: 'What is the primary task users need to accomplish?',
        description: 'This focuses our analysis on the most important user flow.',
        type: 'textarea',
        placeholder: 'e.g., Complete a purchase, find contact information, sign up for a service...',
        required: true,
        validation: { minLength: 10, maxLength: 500 },
      },
      {
        id: 'known-issues',
        question: 'Are there any known issues you want us to focus on?',
        description: 'Optional - let us know specific areas of concern.',
        type: 'textarea',
        placeholder: 'e.g., High cart abandonment, low signup conversions, confusing navigation...',
        required: false,
        validation: { maxLength: 1000 },
      },
      {
        id: 'accessibility-priority',
        question: 'Is WCAG accessibility compliance a priority?',
        description: 'We can include detailed accessibility auditing.',
        type: 'boolean',
        required: false,
      },
    ],
    requiredStepIds: ['product-type', 'target-audience', 'primary-task'],
  },
  'legal-advisor': {
    agentId: 'legal-advisor',
    steps: [
      {
        id: 'jurisdiction',
        question: 'What jurisdiction governs this contract?',
        type: 'select',
        options: [
          { value: 'us-federal', label: 'United States (Federal)' },
          { value: 'us-ca', label: 'United States - California' },
          { value: 'us-ny', label: 'United States - New York' },
          { value: 'us-de', label: 'United States - Delaware' },
          { value: 'uk', label: 'United Kingdom' },
          { value: 'eu', label: 'European Union' },
          { value: 'ca', label: 'Canada' },
          { value: 'au', label: 'Australia' },
          { value: 'sg', label: 'Singapore' },
          { value: 'other', label: 'Other' },
        ],
        required: true,
      },
      {
        id: 'contract-type',
        question: 'What type of contract is this?',
        type: 'select',
        options: [
          { value: 'employment', label: 'Employment Agreement' },
          { value: 'nda', label: 'Non-Disclosure Agreement' },
          { value: 'service', label: 'Service Agreement' },
          { value: 'saas', label: 'SaaS / Software License' },
          { value: 'vendor', label: 'Vendor Agreement' },
          { value: 'partnership', label: 'Partnership Agreement' },
          { value: 'lease', label: 'Commercial Lease' },
          { value: 'other', label: 'Other' },
        ],
        required: true,
      },
      {
        id: 'your-role',
        question: 'What is your role in this contract?',
        type: 'select',
        options: [
          { value: 'party-a', label: 'The party drafting/proposing the contract' },
          { value: 'party-b', label: 'The party receiving/reviewing the contract' },
          { value: 'neutral', label: 'Neutral reviewer (e.g., for a client)' },
        ],
        required: true,
      },
      {
        id: 'deal-value',
        question: 'What is the approximate value or significance of this deal?',
        description: 'This helps prioritize our risk assessment.',
        type: 'select',
        options: [
          { value: 'low', label: 'Low (under $10K or minimal impact)' },
          { value: 'medium', label: 'Medium ($10K - $100K)' },
          { value: 'high', label: 'High ($100K - $1M)' },
          { value: 'critical', label: 'Critical (over $1M or strategic importance)' },
        ],
        required: false,
      },
      {
        id: 'specific-concerns',
        question: 'Are there specific clauses or concerns you want us to focus on?',
        type: 'textarea',
        placeholder: 'e.g., Liability limitations, IP ownership, termination rights...',
        required: false,
        validation: { maxLength: 1000 },
      },
    ],
    requiredStepIds: ['jurisdiction', 'contract-type', 'your-role'],
  },
  'finance-planner': {
    agentId: 'finance-planner',
    steps: [
      {
        id: 'service-type',
        question: 'What type of financial planning assistance do you need?',
        type: 'select',
        options: [
          { value: 'budget-analysis', label: 'Budget Analysis' },
          { value: 'investment-planning', label: 'Investment Planning' },
          { value: 'retirement-planning', label: 'Retirement Planning' },
          { value: 'debt-management', label: 'Debt Management' },
          { value: 'tax-optimization', label: 'Tax Optimization' },
          { value: 'comprehensive', label: 'Comprehensive Financial Review' },
        ],
        required: true,
      },
      {
        id: 'client-type',
        question: 'What best describes your situation?',
        type: 'select',
        options: [
          { value: 'individual', label: 'Individual' },
          { value: 'family', label: 'Family / Household' },
          { value: 'small-business', label: 'Small Business Owner' },
          { value: 'pre-retirement', label: 'Pre-Retirement (50+)' },
          { value: 'early-career', label: 'Early Career (under 30)' },
        ],
        required: true,
      },
      {
        id: 'primary-goal',
        question: 'What is your primary financial goal?',
        type: 'textarea',
        placeholder: 'e.g., Save for a house down payment, retire by 55, pay off student loans...',
        required: true,
        validation: { minLength: 10, maxLength: 500 },
      },
      {
        id: 'time-horizon',
        question: 'What is your time horizon for this goal?',
        type: 'select',
        options: [
          { value: 'short', label: 'Short-term (1-3 years)' },
          { value: 'medium', label: 'Medium-term (3-10 years)' },
          { value: 'long', label: 'Long-term (10+ years)' },
        ],
        required: true,
      },
      {
        id: 'risk-tolerance',
        question: 'What is your risk tolerance?',
        type: 'select',
        options: [
          { value: 'conservative', label: 'Conservative - Prefer stability' },
          { value: 'moderate', label: 'Moderate - Balanced approach' },
          { value: 'aggressive', label: 'Aggressive - Accept higher risk for potential returns' },
        ],
        required: false,
      },
    ],
    requiredStepIds: ['service-type', 'client-type', 'primary-goal', 'time-horizon'],
  },
};

// =============================================================================
// Session State (In-memory for now, would use Redis/DB in production)
// =============================================================================

interface InterviewSession {
  id: string;
  agentId: string;
  userId: string;
  currentStepIndex: number;
  answers: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const sessions = new Map<string, InterviewSession>();

function generateSessionId(): string {
  return `interview-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getSession(sessionId: string): InterviewSession | undefined {
  return sessions.get(sessionId);
}

function createSession(agentId: string, userId: string): InterviewSession {
  const session: InterviewSession = {
    id: generateSessionId(),
    agentId,
    userId,
    currentStepIndex: 0,
    answers: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  sessions.set(session.id, session);
  return session;
}

function updateSession(sessionId: string, updates: Partial<InterviewSession>): void {
  const session = sessions.get(sessionId);
  if (session) {
    Object.assign(session, updates, { updatedAt: new Date() });
    sessions.set(sessionId, session);
  }
}

// =============================================================================
// Route Handler
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const log = logger.child({ route: '/api/agents/[agentId]/interview', method: 'POST' });
  const { agentId } = await params;

  try {
    // Authentication required for interview
    const authSession = await auth();
    if (!authSession?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = authSession.user.id;

    log.info({ userId, agentId }, 'Interview request received');

    // Check if agent supports guided interview
    const config = INTERVIEW_CONFIGS[agentId];
    if (!config) {
      return NextResponse.json(
        { error: 'Agent does not support guided interview mode' },
        { status: 400 }
      );
    }

    // Parse request
    const body = await request.json();
    const parseResult = InterviewRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: parseResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { sessionId, answer, skipQuestion } = parseResult.data;

    // Get or create session
    let session: InterviewSession;
    if (sessionId) {
      const existingSession = getSession(sessionId);
      if (!existingSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      if (existingSession.userId !== userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      session = existingSession;
    } else {
      session = createSession(agentId, userId);
    }

    // Process answer if provided
    if (sessionId && (answer !== undefined || skipQuestion)) {
      const currentStep = config.steps[session.currentStepIndex];
      
      if (currentStep) {
        if (skipQuestion) {
          if (currentStep.required) {
            return NextResponse.json(
              { error: 'Cannot skip required question' },
              { status: 400 }
            );
          }
          // Skip to next question
          session.currentStepIndex++;
        } else if (answer !== undefined) {
          // Validate answer
          if (currentStep.required && !answer.trim()) {
            return NextResponse.json(
              { error: 'Answer is required' },
              { status: 400 }
            );
          }
          
          if (currentStep.validation) {
            if (currentStep.validation.minLength && answer.length < currentStep.validation.minLength) {
              return NextResponse.json(
                { error: `Answer must be at least ${currentStep.validation.minLength} characters` },
                { status: 400 }
              );
            }
            if (currentStep.validation.maxLength && answer.length > currentStep.validation.maxLength) {
              return NextResponse.json(
                { error: `Answer must be at most ${currentStep.validation.maxLength} characters` },
                { status: 400 }
              );
            }
          }

          // Store answer and advance
          session.answers[currentStep.id] = answer;
          session.currentStepIndex++;
        }

        updateSession(session.id, {
          currentStepIndex: session.currentStepIndex,
          answers: session.answers,
        });
      }
    }

    // Calculate state
    const totalSteps = config.steps.length;
    const isComplete = session.currentStepIndex >= totalSteps;
    const currentQuestion = isComplete ? null : config.steps[session.currentStepIndex];
    const progress = Math.round((session.currentStepIndex / totalSteps) * 100);

    // Check if all required questions answered
    const requiredAnswered = config.requiredStepIds.every(
      (stepId) => session.answers[stepId] !== undefined
    );
    const canStartAnalysis = requiredAnswered;

    const response: InterviewResponse = {
      sessionId: session.id,
      currentStep: session.currentStepIndex + 1,
      totalSteps,
      progress,
      isComplete,
      currentQuestion,
      answers: Object.keys(session.answers).length > 0 ? session.answers : undefined,
      canStartAnalysis,
      nextAction: isComplete ? 'complete' : canStartAnalysis ? 'start_analysis' : 'answer',
    };

    log.info(
      {
        userId,
        agentId,
        sessionId: session.id,
        currentStep: session.currentStepIndex,
        isComplete,
      },
      'Interview step processed'
    );

    return NextResponse.json(response);
  } catch (error) {
    log.error({ error }, 'Interview API error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// GET handler - Get interview configuration
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const config = INTERVIEW_CONFIGS[agentId];

  if (!config) {
    return NextResponse.json(
      { 
        supported: false,
        message: 'Agent does not support guided interview mode' 
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    supported: true,
    agentId,
    totalSteps: config.steps.length,
    requiredSteps: config.requiredStepIds.length,
    steps: config.steps.map((s) => ({
      id: s.id,
      question: s.question,
      type: s.type,
      required: s.required,
    })),
  });
}
