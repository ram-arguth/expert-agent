/**
 * UX Analyst Agent - Output Schema
 *
 * Defines the structured output from the UX Analyst agent.
 * This schema is used to validate AI responses and render the report.
 *
 * @see docs/DESIGN.md - Agent Schema Pattern
 */

import { z } from 'zod';

// Severity levels for issues
export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type Severity = z.infer<typeof SeveritySchema>;

// Priority levels for recommendations
export const PrioritySchema = z.enum(['immediate', 'short-term', 'long-term']);
export type Priority = z.infer<typeof PrioritySchema>;

// UX Category for grouping findings
export const UxCategorySchema = z.enum([
  'usability',
  'accessibility',
  'visual-design',
  'information-architecture',
  'interaction-design',
  'content',
  'performance',
  'mobile-responsiveness',
  'consistency',
  'error-handling',
]);
export type UxCategory = z.infer<typeof UxCategorySchema>;

// Individual finding schema
export const FindingSchema = z.object({
  id: z.string().describe('Unique identifier for the finding'),
  title: z.string().describe('Short, descriptive title'),
  category: UxCategorySchema.describe('UX category this finding belongs to'),
  severity: SeveritySchema.describe('Severity of the issue'),
  description: z.string().describe('Detailed description of the issue'),
  location: z.string().optional().describe('Where in the UI this issue occurs'),
  screenshotRef: z.string().optional().describe('Reference to the relevant screenshot'),
  wcagCriteria: z.string().optional().describe('Relevant WCAG criteria if accessibility-related'),
  userImpact: z.string().describe('How this affects the user experience'),
  evidence: z.string().optional().describe('Supporting evidence or observations'),
});

export type Finding = z.infer<typeof FindingSchema>;

// Recommendation schema
export const RecommendationSchema = z.object({
  id: z.string().describe('Unique identifier for the recommendation'),
  title: z.string().describe('Short, actionable title'),
  priority: PrioritySchema.describe('Implementation priority'),
  category: UxCategorySchema.describe('UX category this recommendation addresses'),
  description: z.string().describe('Detailed description of the recommendation'),
  rationale: z.string().describe('Why this recommendation matters'),
  implementationEffort: z
    .enum(['trivial', 'low', 'medium', 'high', 'very-high'])
    .describe('Estimated implementation effort'),
  businessImpact: z
    .enum(['low', 'medium', 'high', 'critical'])
    .describe('Expected business impact'),
  relatedFindings: z
    .array(z.string())
    .optional()
    .describe('IDs of related findings this addresses'),
  exampleImplementation: z.string().optional().describe('Example or suggested implementation'),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

// Competitive analysis insight (if competitors provided)
export const CompetitorInsightSchema = z.object({
  competitorUrl: z.string().url(),
  strengths: z.array(z.string()).describe('UX strengths of the competitor'),
  weaknesses: z.array(z.string()).describe('UX areas where competitor falls short'),
  opportunities: z.array(z.string()).describe('Opportunities to differentiate'),
});

export type CompetitorInsight = z.infer<typeof CompetitorInsightSchema>;

// Overall scores
export const ScoresSchema = z.object({
  overall: z.number().min(0).max(100).describe('Overall UX score'),
  usability: z.number().min(0).max(100).describe('Usability score'),
  accessibility: z.number().min(0).max(100).describe('Accessibility score'),
  visualDesign: z.number().min(0).max(100).describe('Visual design score'),
  informationArchitecture: z.number().min(0).max(100).describe('IA score'),
});

export type Scores = z.infer<typeof ScoresSchema>;

// Main output schema
export const UxAnalystOutputSchema = z.object({
  // Executive summary
  executiveSummary: z.string().describe('High-level summary for stakeholders'),

  // Scores
  scores: ScoresSchema.describe('Quantitative UX scores'),

  // Findings (issues found)
  findings: z
    .array(FindingSchema)
    .min(1)
    .describe('List of UX issues identified'),

  // Recommendations
  recommendations: z
    .array(RecommendationSchema)
    .min(1)
    .describe('List of actionable recommendations'),

  // Strengths
  strengths: z
    .array(z.string())
    .describe('What the product does well'),

  // Key insights
  keyInsights: z
    .array(z.string())
    .min(3)
    .max(7)
    .describe('Key takeaways from the analysis'),

  // Competitive analysis (optional)
  competitorAnalysis: z
    .array(CompetitorInsightSchema)
    .optional()
    .describe('Competitive analysis if URLs were provided'),

  // Accessibility compliance summary
  accessibilityCompliance: z
    .object({
      level: z.string().describe('Target compliance level'),
      status: z.enum(['compliant', 'partial', 'non-compliant']),
      criticalIssues: z.number().describe('Number of critical accessibility issues'),
      summary: z.string().describe('Accessibility compliance summary'),
    })
    .optional(),

  // Next steps summary
  nextSteps: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe('Prioritized next steps'),
});

export type UxAnalystOutput = z.infer<typeof UxAnalystOutputSchema>;
