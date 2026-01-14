/**
 * Finance Planner Agent - Input Schema
 *
 * Defines structured input for financial planning and analysis.
 * Supports budget analysis, investment planning, and financial modeling.
 *
 * @see docs/DESIGN.md - Agent Architecture section
 */

import { z } from 'zod';

// =============================================================================
// Enums and Constants
// =============================================================================

/**
 * Financial planning service types
 */
export const ServiceTypeSchema = z.enum([
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
  'other',
]);
export type ServiceType = z.infer<typeof ServiceTypeSchema>;

/**
 * Client type categories
 */
export const ClientTypeSchema = z.enum([
  'individual',
  'family',
  'small-business',
  'startup',
  'enterprise',
  'nonprofit',
]);
export type ClientType = z.infer<typeof ClientTypeSchema>;

/**
 * Time horizon for planning
 */
export const TimeHorizonSchema = z.enum([
  'short-term', // < 1 year
  'medium-term', // 1-5 years
  'long-term', // 5-10 years
  'retirement', // 10+ years
]);
export type TimeHorizon = z.infer<typeof TimeHorizonSchema>;

/**
 * Risk tolerance levels
 */
export const RiskToleranceSchema = z.enum([
  'conservative',
  'moderate',
  'aggressive',
  'speculative',
]);
export type RiskTolerance = z.infer<typeof RiskToleranceSchema>;

/**
 * Currency for financial data
 */
export const CurrencySchema = z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'other']);
export type Currency = z.infer<typeof CurrencySchema>;

// =============================================================================
// File Schema
// =============================================================================

export const FileInputSchema = z.object({
  name: z.string().min(1).max(255).describe('File name'),
  url: z.string().url().describe('Signed GCS URL for file access'),
  mimeType: z
    .string()
    .regex(/^(application\/(pdf|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.ms-excel)|text\/csv)$/)
    .describe('MIME type of uploaded file'),
  sizeBytes: z.number().int().positive().max(20_000_000).describe('File size in bytes'),
});
export type FileInput = z.infer<typeof FileInputSchema>;

// =============================================================================
// Main Input Schema
// =============================================================================

export const FinancePlannerInputSchema = z.object({
  // Required fields
  serviceType: ServiceTypeSchema.describe('Type of financial planning service requested'),
  clientType: ClientTypeSchema.describe('Category of client'),
  timeHorizon: TimeHorizonSchema.describe('Planning time horizon'),

  // Optional financial context
  currency: CurrencySchema.default('USD').describe('Currency for financial figures'),
  riskTolerance: RiskToleranceSchema.default('moderate').describe('Investment risk tolerance'),

  // Financial goals
  primaryGoal: z
    .string()
    .min(10)
    .max(500)
    .describe('Primary financial goal or objective'),
  secondaryGoals: z
    .array(z.string().min(5).max(200))
    .max(5)
    .optional()
    .describe('Additional financial goals'),

  // Current financial situation (optional structured data)
  annualIncome: z
    .number()
    .nonnegative()
    .optional()
    .describe('Annual gross income'),
  monthlyExpenses: z
    .number()
    .nonnegative()
    .optional()
    .describe('Average monthly expenses'),
  totalAssets: z
    .number()
    .nonnegative()
    .optional()
    .describe('Total current assets'),
  totalLiabilities: z
    .number()
    .nonnegative()
    .optional()
    .describe('Total current liabilities/debts'),
  currentSavingsRate: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Current savings rate as percentage'),

  // Document uploads
  financialStatements: z
    .array(FileInputSchema)
    .max(5)
    .optional()
    .describe('Uploaded financial statements (bank statements, tax returns, etc.)'),
  supportingDocuments: z
    .array(FileInputSchema)
    .max(5)
    .optional()
    .describe('Additional supporting documents'),

  // Context and constraints
  specificConcerns: z
    .string()
    .max(2000)
    .optional()
    .describe('Specific concerns or constraints to address'),
  existingAccounts: z
    .string()
    .max(1000)
    .optional()
    .describe('Description of existing financial accounts (401k, IRA, etc.)'),

  // Analysis preferences
  includeProjections: z.boolean().default(true).describe('Include financial projections'),
  includeActionPlan: z.boolean().default(true).describe('Include step-by-step action plan'),
  includeTaxConsiderations: z.boolean().default(true).describe('Include tax optimization suggestions'),
  includeRiskAnalysis: z.boolean().default(true).describe('Include risk analysis'),
});

export type FinancePlannerInput = z.infer<typeof FinancePlannerInputSchema>;

// =============================================================================
// Form Configuration
// =============================================================================

/**
 * Form field configuration for dynamic UI generation
 */
export const FinancePlannerFormConfig = {
  sections: [
    {
      id: 'service-info',
      title: 'Planning Service',
      description: 'What type of financial planning do you need?',
      fields: ['serviceType', 'clientType', 'timeHorizon'],
    },
    {
      id: 'goals',
      title: 'Financial Goals',
      description: 'Describe your financial objectives',
      fields: ['primaryGoal', 'secondaryGoals'],
    },
    {
      id: 'current-situation',
      title: 'Current Financial Situation',
      description: 'Provide details about your current finances (optional but recommended)',
      fields: [
        'annualIncome',
        'monthlyExpenses',
        'totalAssets',
        'totalLiabilities',
        'currentSavingsRate',
        'existingAccounts',
      ],
    },
    {
      id: 'documents',
      title: 'Financial Documents',
      description: 'Upload relevant financial documents for analysis',
      fields: ['financialStatements', 'supportingDocuments'],
    },
    {
      id: 'preferences',
      title: 'Analysis Preferences',
      description: 'Customize the analysis output',
      fields: [
        'riskTolerance',
        'currency',
        'includeProjections',
        'includeActionPlan',
        'includeTaxConsiderations',
        'includeRiskAnalysis',
      ],
    },
    {
      id: 'context',
      title: 'Additional Context',
      description: 'Any specific concerns or constraints',
      fields: ['specificConcerns'],
    },
  ],
  fieldLabels: {
    serviceType: 'Planning Service Type',
    clientType: 'Client Category',
    timeHorizon: 'Planning Horizon',
    currency: 'Currency',
    riskTolerance: 'Risk Tolerance',
    primaryGoal: 'Primary Goal',
    secondaryGoals: 'Additional Goals',
    annualIncome: 'Annual Income',
    monthlyExpenses: 'Monthly Expenses',
    totalAssets: 'Total Assets',
    totalLiabilities: 'Total Liabilities',
    currentSavingsRate: 'Current Savings Rate (%)',
    financialStatements: 'Financial Statements',
    supportingDocuments: 'Supporting Documents',
    specificConcerns: 'Specific Concerns',
    existingAccounts: 'Existing Accounts',
    includeProjections: 'Include Projections',
    includeActionPlan: 'Include Action Plan',
    includeTaxConsiderations: 'Include Tax Suggestions',
    includeRiskAnalysis: 'Include Risk Analysis',
  },
  fieldDescriptions: {
    serviceType: 'Select the type of financial planning you need',
    clientType: 'Are you planning for yourself, family, or business?',
    timeHorizon: 'How far ahead are you planning?',
    riskTolerance: 'How much investment risk are you comfortable with?',
    primaryGoal: 'What is your main financial objective?',
    annualIncome: 'Your total annual gross income',
    monthlyExpenses: 'Your average monthly spending',
    financialStatements: 'Bank statements, tax returns, investment statements',
    specificConcerns: 'Any specific financial concerns or constraints we should consider',
  },
  serviceTypeOptions: [
    { value: 'budget-analysis', label: 'Budget Analysis' },
    { value: 'investment-planning', label: 'Investment Planning' },
    { value: 'retirement-planning', label: 'Retirement Planning' },
    { value: 'debt-management', label: 'Debt Management' },
    { value: 'tax-optimization', label: 'Tax Optimization' },
    { value: 'cash-flow-analysis', label: 'Cash Flow Analysis' },
    { value: 'business-valuation', label: 'Business Valuation' },
    { value: 'financial-projection', label: 'Financial Projection' },
    { value: 'expense-optimization', label: 'Expense Optimization' },
    { value: 'savings-strategy', label: 'Savings Strategy' },
    { value: 'other', label: 'Other' },
  ],
  clientTypeOptions: [
    { value: 'individual', label: 'Individual' },
    { value: 'family', label: 'Family' },
    { value: 'small-business', label: 'Small Business' },
    { value: 'startup', label: 'Startup' },
    { value: 'enterprise', label: 'Enterprise' },
    { value: 'nonprofit', label: 'Nonprofit' },
  ],
  timeHorizonOptions: [
    { value: 'short-term', label: 'Short-term (< 1 year)' },
    { value: 'medium-term', label: 'Medium-term (1-5 years)' },
    { value: 'long-term', label: 'Long-term (5-10 years)' },
    { value: 'retirement', label: 'Retirement (10+ years)' },
  ],
  riskToleranceOptions: [
    { value: 'conservative', label: 'Conservative - Preserve capital' },
    { value: 'moderate', label: 'Moderate - Balanced growth' },
    { value: 'aggressive', label: 'Aggressive - High growth' },
    { value: 'speculative', label: 'Speculative - Maximum growth' },
  ],
} as const;
