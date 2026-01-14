/**
 * Finance Planner Agent - Index
 *
 * Main entry point for the Finance Planner agent.
 * Exports all components and configuration.
 *
 * @see docs/DESIGN.md - Agent Architecture section
 */

// Export schemas
export {
  FinancePlannerInputSchema,
  ServiceTypeSchema,
  ClientTypeSchema,
  TimeHorizonSchema,
  RiskToleranceSchema,
  CurrencySchema,
  FileInputSchema,
  FinancePlannerFormConfig,
  type FinancePlannerInput,
  type ServiceType,
  type ClientType,
  type TimeHorizon,
  type RiskTolerance,
  type Currency,
  type FileInput,
} from './input-schema';

export {
  FinancePlannerOutputSchema,
  PrioritySchema,
  ImpactSchema,
  HealthStatusSchema,
  RiskLevelSchema,
  FinancialHealthSchema,
  BudgetAnalysisSchema,
  InvestmentRecommendationSchema,
  ActionItemSchema,
  ProjectionDataPointSchema,
  ProjectionScenarioSchema,
  TaxSuggestionSchema,
  RiskAssessmentSchema,
  type FinancePlannerOutput,
  type Priority,
  type Impact,
  type HealthStatus,
  type RiskLevel,
  type FinancialHealth,
  type BudgetAnalysis,
  type InvestmentRecommendation,
  type ActionItem,
  type ProjectionDataPoint,
  type ProjectionScenario,
  type TaxSuggestion,
  type RiskAssessment,
} from './output-schema';

// Export prompt utilities
export {
  FINANCE_PLANNER_PROMPT_TEMPLATE,
  compilePrompt,
  validateOutput,
  type PromptContext,
} from './prompt-template';

// Export renderer
export { renderToMarkdown } from './renderer';

// =============================================================================
// Agent Configuration
// =============================================================================

/**
 * Finance Planner agent configuration
 */
export const FINANCE_PLANNER_CONFIG = {
  id: 'finance-planner',
  name: 'Finance Planner',
  displayName: 'Finance Planner',
  description:
    'AI-powered financial planning assistant for budgeting, investments, retirement planning, and financial goal achievement.',
  category: 'finance',
  version: '1.0.0',

  // Agent status
  isPublic: false,
  isBeta: true,

  // Feature flags
  supportsGuidedInterview: true,
  supportsFileUpload: true,
  supportsStreaming: false,

  // File handling
  supportedMimeTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ],
  maxFileSize: 20_000_000, // 20MB
  maxFiles: 10,

  // Token limits
  maxInputTokens: 80_000,
  maxOutputTokens: 16_000,

  // Pricing tier
  tier: 'pro' as const,
  tokensPerQuery: 2000,

  // Supported planning types
  supportedServiceTypes: [
    'budget-analysis',
    'investment-planning',
    'retirement-planning',
    'debt-management',
    'tax-optimization',
    'cash-flow-analysis',
    'business-valuation',
    'financial-projection',
    'expense-optimization',
    'savings-strategy',
  ],

  // Supported client types
  supportedClientTypes: ['individual', 'family', 'small-business', 'startup', 'enterprise', 'nonprofit'],

  // Tags for discovery
  tags: [
    'finance',
    'budget',
    'investment',
    'retirement',
    'tax',
    'savings',
    'planning',
    'personal-finance',
    'business-finance',
  ],

  // Icon and branding
  icon: '📊',
  color: '#10B981', // Emerald green

  // Legal
  disclaimerRequired: true,
} as const;

export type FinancePlannerConfig = typeof FINANCE_PLANNER_CONFIG;
