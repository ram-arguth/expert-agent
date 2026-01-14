/**
 * Legal Advisor Agent - Output Schema
 *
 * Defines the structured output for the Legal Advisor agent.
 * AI responses are validated against this schema.
 *
 * @see docs/DESIGN.md - Agent Schema Pattern
 */

import { z } from 'zod';

// =============================================================================
// Severity and Priority Enums
// =============================================================================

export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type Severity = z.infer<typeof SeveritySchema>;

export const PrioritySchema = z.enum(['immediate', 'short-term', 'long-term']);
export type Priority = z.infer<typeof PrioritySchema>;

export const RiskLevelSchema = z.enum(['high', 'medium', 'low', 'minimal']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// =============================================================================
// Finding Schema
// =============================================================================

export const FindingSchema = z.object({
  id: z.string().describe('Unique identifier for the finding'),
  title: z.string().describe('Brief title of the finding'),
  severity: SeveritySchema.describe('Severity level of the issue'),
  category: z
    .enum([
      'liability',
      'ip-rights',
      'termination',
      'payment',
      'confidentiality',
      'non-compete',
      'indemnification',
      'warranty',
      'compliance',
      'governing-law',
      'dispute-resolution',
      'assignment',
      'force-majeure',
      'other',
    ])
    .describe('Category of the finding'),
  description: z.string().describe('Detailed description of the issue'),
  clauseReference: z
    .string()
    .optional()
    .describe('Reference to the clause/section in the contract'),
  originalText: z.string().optional().describe('Excerpt of the problematic text'),
  riskExplanation: z.string().describe('Explanation of the risk this poses'),
  affectedParty: z
    .enum(['party-a', 'party-b', 'both', 'unclear'])
    .describe('Which party is affected'),
});

export type Finding = z.infer<typeof FindingSchema>;

// =============================================================================
// Recommendation Schema
// =============================================================================

export const RecommendationSchema = z.object({
  id: z.string().describe('Unique identifier for the recommendation'),
  findingId: z.string().optional().describe('Related finding ID'),
  action: z.string().describe('Recommended action to take'),
  priority: PrioritySchema.describe('Priority of implementing this recommendation'),
  rationale: z.string().describe('Why this recommendation is important'),
  suggestedLanguage: z
    .string()
    .optional()
    .describe('Suggested replacement or additional language'),
  negotiationTip: z
    .string()
    .optional()
    .describe('Tip for negotiating this point'),
  effort: z.enum(['low', 'medium', 'high']).optional().describe('Effort to implement'),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

// =============================================================================
// Risk Assessment Schema
// =============================================================================

export const RiskAssessmentSchema = z.object({
  overallRisk: RiskLevelSchema.describe('Overall risk level of the contract'),
  riskScore: z.number().min(0).max(100).describe('Numerical risk score'),
  keyRisks: z.array(z.string()).describe('List of key risk factors'),
  mitigatingFactors: z.array(z.string()).describe('Factors reducing risk'),
  riskByCategory: z
    .record(z.string(), RiskLevelSchema)
    .optional()
    .describe('Risk breakdown by category'),
});

export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

// =============================================================================
// Clause Summary Schema
// =============================================================================

export const ClauseSummarySchema = z.object({
  clauseName: z.string().describe('Name of the clause'),
  clauseReference: z.string().describe('Section/Article reference'),
  summary: z.string().describe('Plain English summary'),
  isStandard: z.boolean().describe('Whether this is a standard/market clause'),
  marketComparison: z
    .string()
    .optional()
    .describe('How this compares to market standard'),
  favorability: z
    .enum(['favorable', 'neutral', 'unfavorable', 'heavily-unfavorable'])
    .describe('Favorability from your position'),
});

export type ClauseSummary = z.infer<typeof ClauseSummarySchema>;

// =============================================================================
// Compliance Check Schema
// =============================================================================

export const ComplianceCheckSchema = z.object({
  area: z.string().describe('Compliance area'),
  status: z.enum(['compliant', 'partially-compliant', 'non-compliant', 'not-applicable']),
  details: z.string().describe('Details of compliance status'),
  requiredActions: z.array(z.string()).optional().describe('Actions needed for compliance'),
});

export type ComplianceCheck = z.infer<typeof ComplianceCheckSchema>;

// =============================================================================
// Main Output Schema
// =============================================================================

export const LegalAdvisorOutputSchema = z.object({
  // Executive summary
  executiveSummary: z.string().describe('High-level overview of the contract analysis'),

  // Contract metadata
  contractMetadata: z.object({
    title: z.string().describe('Identified contract title'),
    parties: z.array(z.string()).describe('Parties to the contract'),
    effectiveDate: z.string().optional().describe('Effective date if identified'),
    expirationDate: z.string().optional().describe('Expiration/termination date'),
    governingLaw: z.string().optional().describe('Governing law clause'),
    contractValue: z.string().optional().describe('Identified contract value'),
  }),

  // Risk assessment
  riskAssessment: RiskAssessmentSchema,

  // Key findings
  findings: z.array(FindingSchema).describe('Issues and concerns identified'),

  // Recommendations
  recommendations: z.array(RecommendationSchema).describe('Recommended actions'),

  // Clause summaries
  clauseSummaries: z
    .array(ClauseSummarySchema)
    .optional()
    .describe('Summaries of key clauses'),

  // Compliance analysis (if applicable)
  complianceChecks: z
    .array(ComplianceCheckSchema)
    .optional()
    .describe('Compliance analysis'),

  // Negotiation strategy
  negotiationStrategy: z
    .object({
      overallApproach: z.string().describe('Suggested overall negotiation approach'),
      priorityPoints: z.array(z.string()).describe('Top priority negotiation points'),
      dealBreakers: z.array(z.string()).describe('Potential deal breakers'),
      concessionPoints: z.array(z.string()).describe('Points where concession is possible'),
    })
    .optional(),

  // Key dates and deadlines
  keyDates: z
    .array(
      z.object({
        date: z.string(),
        description: z.string(),
        actionRequired: z.string().optional(),
      })
    )
    .optional(),

  // Appendix
  appendix: z.string().optional().describe('Additional notes, definitions, etc.'),

  // Confidence score
  confidence: z
    .number()
    .min(0)
    .max(100)
    .describe('Confidence level in the analysis'),

  // Disclaimers
  disclaimers: z.array(z.string()).describe('Legal disclaimers'),
});

export type LegalAdvisorOutput = z.infer<typeof LegalAdvisorOutputSchema>;
