/**
 * Finance Planner Agent - Output Schema
 *
 * Defines structured output for financial planning analysis.
 * Includes financial health assessment, recommendations, and projections.
 *
 * @see docs/DESIGN.md - Agent Architecture section
 */

import { z } from 'zod';

// =============================================================================
// Helper Schemas
// =============================================================================

/**
 * Priority levels for recommendations
 */
export const PrioritySchema = z.enum(['immediate', 'short-term', 'medium-term', 'long-term']);
export type Priority = z.infer<typeof PrioritySchema>;

/**
 * Impact levels
 */
export const ImpactSchema = z.enum(['high', 'medium', 'low']);
export type Impact = z.infer<typeof ImpactSchema>;

/**
 * Financial health status
 */
export const HealthStatusSchema = z.enum(['excellent', 'good', 'fair', 'needs-attention', 'critical']);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

/**
 * Risk level
 */
export const RiskLevelSchema = z.enum(['high', 'medium', 'low', 'minimal']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// =============================================================================
// Component Schemas
// =============================================================================

/**
 * Financial health assessment
 */
export const FinancialHealthSchema = z.object({
  overallStatus: HealthStatusSchema.describe('Overall financial health rating'),
  score: z.number().int().min(0).max(100).describe('Financial health score (0-100)'),
  summary: z.string().min(10).describe('Summary of financial health assessment'),
  keyMetrics: z.object({
    debtToIncomeRatio: z.number().optional().describe('Debt-to-income ratio'),
    savingsRate: z.number().optional().describe('Current savings rate percentage'),
    emergencyFundMonths: z.number().optional().describe('Months of expenses in emergency fund'),
    netWorth: z.number().optional().describe('Calculated net worth'),
    liquidityRatio: z.number().optional().describe('Liquid assets to monthly expenses ratio'),
  }),
  strengths: z.array(z.string()).describe('Financial strengths identified'),
  concerns: z.array(z.string()).describe('Financial concerns or areas for improvement'),
});
export type FinancialHealth = z.infer<typeof FinancialHealthSchema>;

/**
 * Budget analysis breakdown
 */
export const BudgetAnalysisSchema = z.object({
  monthlyIncome: z.number().describe('Estimated monthly income'),
  monthlyExpenses: z.number().describe('Estimated monthly expenses'),
  monthlySurplus: z.number().describe('Monthly surplus (income - expenses)'),
  expenseBreakdown: z.array(
    z.object({
      category: z.string().describe('Expense category'),
      amount: z.number().describe('Monthly amount'),
      percentOfIncome: z.number().describe('Percentage of income'),
      recommendation: z.string().optional().describe('Optimization recommendation'),
    })
  ),
  savingsAllocation: z.object({
    recommended: z.number().describe('Recommended monthly savings'),
    current: z.number().describe('Current monthly savings'),
    gap: z.number().describe('Gap between recommended and current'),
  }),
});
export type BudgetAnalysis = z.infer<typeof BudgetAnalysisSchema>;

/**
 * Investment recommendation
 */
export const InvestmentRecommendationSchema = z.object({
  id: z.string().describe('Unique recommendation ID'),
  category: z.string().describe('Investment category (e.g., stocks, bonds, real estate)'),
  recommendation: z.string().describe('Specific investment recommendation'),
  allocationPercentage: z.number().min(0).max(100).describe('Recommended portfolio allocation'),
  riskLevel: RiskLevelSchema.describe('Risk level of this investment'),
  expectedReturn: z.string().optional().describe('Expected annual return range'),
  rationale: z.string().describe('Why this investment is recommended'),
  considerations: z.array(z.string()).optional().describe('Important considerations'),
});
export type InvestmentRecommendation = z.infer<typeof InvestmentRecommendationSchema>;

/**
 * Action item for financial plan
 */
export const ActionItemSchema = z.object({
  id: z.string().describe('Unique action item ID'),
  action: z.string().describe('Specific action to take'),
  priority: PrioritySchema.describe('Priority level'),
  impact: ImpactSchema.describe('Expected financial impact'),
  effort: z.enum(['low', 'medium', 'high']).describe('Effort required'),
  timeline: z.string().describe('Recommended timeline'),
  potentialSavings: z.number().optional().describe('Potential annual savings in currency'),
  details: z.string().optional().describe('Additional details or steps'),
});
export type ActionItem = z.infer<typeof ActionItemSchema>;

/**
 * Financial projection data point
 */
export const ProjectionDataPointSchema = z.object({
  year: z.number().int().describe('Year of projection'),
  netWorth: z.number().describe('Projected net worth'),
  savings: z.number().describe('Projected cumulative savings'),
  investments: z.number().describe('Projected investment value'),
  milestone: z.string().optional().describe('Key milestone reached'),
});
export type ProjectionDataPoint = z.infer<typeof ProjectionDataPointSchema>;

/**
 * Financial projection scenarios
 */
export const ProjectionScenarioSchema = z.object({
  name: z.enum(['conservative', 'moderate', 'optimistic']).describe('Scenario name'),
  assumptions: z.array(z.string()).describe('Key assumptions'),
  dataPoints: z.array(ProjectionDataPointSchema).describe('Yearly projections'),
  goalAchievementYear: z.number().optional().describe('Year when primary goal is achieved'),
});
export type ProjectionScenario = z.infer<typeof ProjectionScenarioSchema>;

/**
 * Tax optimization suggestion
 */
export const TaxSuggestionSchema = z.object({
  id: z.string().describe('Unique suggestion ID'),
  strategy: z.string().describe('Tax optimization strategy'),
  potentialSavings: z.string().describe('Estimated tax savings'),
  applicability: z.string().describe('When/how this applies'),
  requirements: z.array(z.string()).optional().describe('Requirements to implement'),
  disclaimer: z.string().optional().describe('Tax-related disclaimer'),
});
export type TaxSuggestion = z.infer<typeof TaxSuggestionSchema>;

/**
 * Risk assessment
 */
export const RiskAssessmentSchema = z.object({
  overallRisk: RiskLevelSchema.describe('Overall financial risk level'),
  riskScore: z.number().int().min(0).max(100).describe('Risk score (0=low, 100=high)'),
  riskFactors: z.array(
    z.object({
      factor: z.string().describe('Risk factor'),
      level: RiskLevelSchema.describe('Risk level'),
      mitigation: z.string().describe('Suggested mitigation'),
    })
  ),
  recommendations: z.array(z.string()).describe('Risk mitigation recommendations'),
});
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

// =============================================================================
// Main Output Schema
// =============================================================================

export const FinancePlannerOutputSchema = z.object({
  // Executive Summary
  executiveSummary: z.string().min(50).describe('Executive summary of financial analysis'),

  // Financial Health Assessment
  financialHealth: FinancialHealthSchema.describe('Overall financial health assessment'),

  // Budget Analysis (if applicable)
  budgetAnalysis: BudgetAnalysisSchema.optional().describe('Detailed budget analysis'),

  // Investment Recommendations (if applicable)
  investmentRecommendations: z
    .array(InvestmentRecommendationSchema)
    .optional()
    .describe('Investment portfolio recommendations'),

  // Action Plan
  actionPlan: z.array(ActionItemSchema).describe('Prioritized action items'),

  // Financial Projections (if requested)
  projections: z
    .array(ProjectionScenarioSchema)
    .optional()
    .describe('Financial projections under different scenarios'),

  // Tax Optimization (if requested)
  taxSuggestions: z
    .array(TaxSuggestionSchema)
    .optional()
    .describe('Tax optimization suggestions'),

  // Risk Assessment (if requested)
  riskAssessment: RiskAssessmentSchema.optional().describe('Financial risk assessment'),

  // Goal-specific insights
  goalAnalysis: z.object({
    primaryGoal: z.string().describe('Restated primary goal'),
    feasibility: z.enum(['highly-achievable', 'achievable', 'challenging', 'needs-revision']).describe('Goal feasibility'),
    timeline: z.string().describe('Estimated timeline to achieve goal'),
    keyMilestones: z.array(
      z.object({
        milestone: z.string().describe('Milestone description'),
        targetDate: z.string().describe('Target date'),
        requirements: z.string().describe('What is needed'),
      })
    ),
  }),

  // Additional insights
  insights: z.array(z.string()).describe('Key financial insights'),

  // Confidence and disclaimers
  confidence: z.number().int().min(0).max(100).describe('Analysis confidence score'),
  disclaimers: z
    .array(z.string())
    .min(1)
    .describe('Important disclaimers about financial advice'),
});

export type FinancePlannerOutput = z.infer<typeof FinancePlannerOutputSchema>;
