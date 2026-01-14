/**
 * Finance Planner Agent - Prompt Template
 *
 * Handlebars template for constructing the Finance Planner prompt.
 * Includes financial context, goals, and analysis preferences.
 *
 * @see docs/DESIGN.md - Prompt Templating Pattern
 */

import Handlebars from 'handlebars';
import type { FinancePlannerInput } from './input-schema';
import { FinancePlannerOutputSchema, type FinancePlannerOutput } from './output-schema';

// Main prompt template
export const FINANCE_PLANNER_PROMPT_TEMPLATE = `You are an expert financial planning AI assistant. You provide comprehensive, personalized financial guidance while maintaining professional standards and appropriate disclaimers.

## IMPORTANT DISCLAIMERS
- This analysis is for informational and educational purposes only.
- This is NOT professional financial, tax, or legal advice.
- Users should consult with qualified professionals (CFP, CPA, attorney) for specific decisions.
- Past performance does not guarantee future results.
- All projections are estimates based on provided information.

## Client Profile

**Client Type:** {{clientTypeLabel}}
**Planning Service:** {{serviceTypeLabel}}
**Time Horizon:** {{timeHorizonLabel}}
**Risk Tolerance:** {{riskToleranceLabel}}
**Currency:** {{currency}}

## Primary Financial Goal

{{primaryGoal}}

{{#if secondaryGoals.length}}
## Additional Goals

{{#each secondaryGoals}}
- {{this}}
{{/each}}
{{/if}}

## Current Financial Situation

{{#if annualIncome}}
**Annual Income:** {{formatCurrency annualIncome currency}}
{{/if}}
{{#if monthlyExpenses}}
**Monthly Expenses:** {{formatCurrency monthlyExpenses currency}}
{{/if}}
{{#if totalAssets}}
**Total Assets:** {{formatCurrency totalAssets currency}}
{{/if}}
{{#if totalLiabilities}}
**Total Liabilities:** {{formatCurrency totalLiabilities currency}}
{{/if}}
{{#if currentSavingsRate}}
**Current Savings Rate:** {{currentSavingsRate}}%
{{/if}}

{{#if existingAccounts}}
## Existing Financial Accounts

{{existingAccounts}}
{{/if}}

{{#if financialStatements.length}}
## Uploaded Financial Documents

{{#each financialStatements}}
- **{{this.name}}**: {{this.url}}
{{/each}}
{{/if}}

{{#if supportingDocuments.length}}
## Supporting Documents

{{#each supportingDocuments}}
- **{{this.name}}**: {{this.url}}
{{/each}}
{{/if}}

{{#if specificConcerns}}
## Specific Concerns & Constraints

{{specificConcerns}}
{{/if}}

{{#if orgContext}}
## Organization Context

{{orgContext}}
{{/if}}

## Analysis Requirements

Please provide a comprehensive financial analysis including:

1. **Executive Summary**: Clear overview of financial situation and key recommendations.

2. **Financial Health Assessment**: 
   - Overall health score (0-100)
   - Key financial metrics (debt-to-income, savings rate, etc.)
   - Strengths and areas of concern

{{#if needsBudgetAnalysis}}
3. **Budget Analysis**:
   - Income vs expenses breakdown
   - Expense categorization
   - Savings allocation recommendations
{{/if}}

{{#serviceType 'investment-planning'}}
4. **Investment Recommendations**:
   - Asset allocation strategy based on {{riskToleranceLabel}} risk profile
   - Specific investment categories with rationale
   - Risk-adjusted return expectations
{{/serviceType}}

5. **Action Plan**:
   - Prioritized, actionable steps
   - Timeline and effort estimates
   - Potential savings or impact

{{#if includeProjections}}
6. **Financial Projections**:
   - Conservative, moderate, and optimistic scenarios
   - Yearly projections for {{timeHorizonLabel}} horizon
   - Goal achievement timeline
{{/if}}

{{#if includeTaxConsiderations}}
7. **Tax Optimization**:
   - Tax-efficient strategies
   - Account type recommendations (IRA, 401k, HSA, etc.)
   - Potential tax savings
{{/if}}

{{#if includeRiskAnalysis}}
8. **Risk Assessment**:
   - Key financial risk factors
   - Mitigation strategies
   - Emergency preparedness
{{/if}}

9. **Goal Analysis**:
   - Feasibility assessment
   - Key milestones
   - Timeline to achievement

## Output Format

You MUST respond with a valid JSON object matching the following schema:

\`\`\`json
{
  "executiveSummary": "string (50+ chars)",
  "financialHealth": {
    "overallStatus": "excellent|good|fair|needs-attention|critical",
    "score": 0-100,
    "summary": "string",
    "keyMetrics": {
      "debtToIncomeRatio": number (optional),
      "savingsRate": number (optional),
      "emergencyFundMonths": number (optional),
      "netWorth": number (optional),
      "liquidityRatio": number (optional)
    },
    "strengths": ["string"],
    "concerns": ["string"]
  },
  "budgetAnalysis": { ... } (optional),
  "investmentRecommendations": [{ ... }] (optional),
  "actionPlan": [{
    "id": "string",
    "action": "string",
    "priority": "immediate|short-term|medium-term|long-term",
    "impact": "high|medium|low",
    "effort": "low|medium|high",
    "timeline": "string",
    "potentialSavings": number (optional),
    "details": "string (optional)"
  }],
  "projections": [{ ... }] (optional),
  "taxSuggestions": [{ ... }] (optional),
  "riskAssessment": { ... } (optional),
  "goalAnalysis": {
    "primaryGoal": "string",
    "feasibility": "highly-achievable|achievable|challenging|needs-revision",
    "timeline": "string",
    "keyMilestones": [{
      "milestone": "string",
      "targetDate": "string",
      "requirements": "string"
    }]
  },
  "insights": ["string"],
  "confidence": 0-100,
  "disclaimers": ["string"]
}
\`\`\`

Do NOT include any text outside the JSON object. Ensure all monetary values are in {{currency}}.

Please analyze the financial situation now.`;

// Register custom helpers
Handlebars.registerHelper('formatCurrency', function (amount: number, currency: string) {
  if (typeof amount !== 'number') return 'N/A';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return formatter.format(amount);
});

Handlebars.registerHelper('serviceType', function (this: unknown, type: string, options: Handlebars.HelperOptions) {
  const context = this as FinancePlannerInput;
  return context.serviceType === type ? options.fn(this) : options.inverse(this);
});

// Type for prompt context
export interface PromptContext extends FinancePlannerInput {
  serviceTypeLabel?: string;
  clientTypeLabel?: string;
  timeHorizonLabel?: string;
  riskToleranceLabel?: string;
  needsBudgetAnalysis?: boolean;
  orgContext?: string;
}

// Label mappings
const SERVICE_TYPE_LABELS: Record<string, string> = {
  'budget-analysis': 'Budget Analysis',
  'investment-planning': 'Investment Planning',
  'retirement-planning': 'Retirement Planning',
  'debt-management': 'Debt Management',
  'tax-optimization': 'Tax Optimization',
  'cash-flow-analysis': 'Cash Flow Analysis',
  'business-valuation': 'Business Valuation',
  'financial-projection': 'Financial Projection',
  'expense-optimization': 'Expense Optimization',
  'savings-strategy': 'Savings Strategy',
  other: 'General Financial Planning',
};

const CLIENT_TYPE_LABELS: Record<string, string> = {
  individual: 'Individual',
  family: 'Family',
  'small-business': 'Small Business',
  startup: 'Startup',
  enterprise: 'Enterprise',
  nonprofit: 'Nonprofit Organization',
};

const TIME_HORIZON_LABELS: Record<string, string> = {
  'short-term': 'Short-term (less than 1 year)',
  'medium-term': 'Medium-term (1-5 years)',
  'long-term': 'Long-term (5-10 years)',
  retirement: 'Retirement Planning (10+ years)',
};

const RISK_TOLERANCE_LABELS: Record<string, string> = {
  conservative: 'Conservative (capital preservation)',
  moderate: 'Moderate (balanced growth)',
  aggressive: 'Aggressive (high growth)',
  speculative: 'Speculative (maximum growth)',
};

/**
 * Compile the prompt template with provided context
 */
export function compilePrompt(input: FinancePlannerInput, orgContext?: string): string {
  const template = Handlebars.compile(FINANCE_PLANNER_PROMPT_TEMPLATE);

  const needsBudget = [
    'budget-analysis',
    'expense-optimization',
    'savings-strategy',
    'cash-flow-analysis',
  ].includes(input.serviceType);

  const context: PromptContext = {
    ...input,
    serviceTypeLabel: SERVICE_TYPE_LABELS[input.serviceType] || input.serviceType,
    clientTypeLabel: CLIENT_TYPE_LABELS[input.clientType] || input.clientType,
    timeHorizonLabel: TIME_HORIZON_LABELS[input.timeHorizon] || input.timeHorizon,
    riskToleranceLabel: RISK_TOLERANCE_LABELS[input.riskTolerance ?? 'moderate'] || 'Moderate',
    needsBudgetAnalysis: needsBudget,
    orgContext,
  };

  return template(context);
}

/**
 * Validate that the AI response matches the expected output schema
 */
export function validateOutput(response: unknown): FinancePlannerOutput {
  return FinancePlannerOutputSchema.parse(response);
}
