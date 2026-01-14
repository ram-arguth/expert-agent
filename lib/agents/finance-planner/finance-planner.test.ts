/**
 * Finance Planner Agent Tests
 *
 * Comprehensive tests for the Finance Planner agent:
 * - Input schema validation
 * - Output schema validation
 * - Prompt template compilation
 * - Markdown rendering
 */

import { describe, it, expect } from 'vitest';
import {
  FinancePlannerInputSchema,
  FinancePlannerOutputSchema,
  compilePrompt,
  renderToMarkdown,
  FINANCE_PLANNER_CONFIG,
  type FinancePlannerInput,
  type FinancePlannerOutput,
} from './index';

// =============================================================================
// Test Fixtures
// =============================================================================

const validInput: FinancePlannerInput = {
  serviceType: 'retirement-planning',
  clientType: 'family',
  timeHorizon: 'retirement',
  currency: 'USD',
  riskTolerance: 'moderate',
  primaryGoal: 'Retire comfortably at age 65 with $2 million in savings',
  secondaryGoals: ['Pay off mortgage by age 55', 'Fund children education'],
  annualIncome: 150000,
  monthlyExpenses: 8000,
  totalAssets: 500000,
  totalLiabilities: 200000,
  currentSavingsRate: 15,
  includeProjections: true,
  includeActionPlan: true,
  includeTaxConsiderations: true,
  includeRiskAnalysis: true,
};

const validOutput: FinancePlannerOutput = {
  executiveSummary:
    'Your financial situation is solid with a good savings rate and manageable debt. You are on track to meet your retirement goals with some adjustments.',
  financialHealth: {
    overallStatus: 'good',
    score: 72,
    summary: 'Strong income and savings habits with room for optimization',
    keyMetrics: {
      debtToIncomeRatio: 16,
      savingsRate: 15,
      emergencyFundMonths: 4,
      netWorth: 300000,
      liquidityRatio: 2.5,
    },
    strengths: ['Consistent savings habit', 'Diversified income sources', 'Low debt-to-income ratio'],
    concerns: ['Emergency fund below 6-month target', 'High mortgage interest rate'],
  },
  budgetAnalysis: {
    monthlyIncome: 12500,
    monthlyExpenses: 8000,
    monthlySurplus: 4500,
    expenseBreakdown: [
      {
        category: 'Housing',
        amount: 2500,
        percentOfIncome: 20,
        recommendation: 'Consider refinancing mortgage',
      },
      {
        category: 'Transportation',
        amount: 800,
        percentOfIncome: 6.4,
      },
    ],
    savingsAllocation: {
      recommended: 3750,
      current: 1875,
      gap: 1875,
    },
  },
  investmentRecommendations: [
    {
      id: 'inv-001',
      category: 'Diversified Stock Index',
      recommendation: 'Invest in low-cost S&P 500 index fund',
      allocationPercentage: 60,
      riskLevel: 'medium',
      expectedReturn: '7-10% annually',
      rationale: 'Long time horizon allows for equity exposure',
      considerations: ['Dollar-cost averaging recommended', 'Rebalance annually'],
    },
    {
      id: 'inv-002',
      category: 'Bonds',
      recommendation: 'Invest in bond index fund for stability',
      allocationPercentage: 30,
      riskLevel: 'low',
      expectedReturn: '3-5% annually',
      rationale: 'Provides stability and income',
    },
  ],
  actionPlan: [
    {
      id: 'action-001',
      action: 'Increase 401(k) contribution to employer match maximum',
      priority: 'immediate',
      impact: 'high',
      effort: 'low',
      timeline: 'This month',
      potentialSavings: 5000,
      details: 'Maximize free money from employer match',
    },
    {
      id: 'action-002',
      action: 'Build emergency fund to 6 months expenses',
      priority: 'short-term',
      impact: 'high',
      effort: 'medium',
      timeline: '6-12 months',
      details: 'Target $48,000 in high-yield savings account',
    },
  ],
  projections: [
    {
      name: 'moderate',
      assumptions: ['7% average annual return', '3% inflation', 'Current savings rate maintained'],
      dataPoints: [
        { year: 2025, netWorth: 350000, savings: 400000, investments: 300000 },
        { year: 2030, netWorth: 750000, savings: 600000, investments: 650000, milestone: 'Mortgage paid off' },
        { year: 2035, netWorth: 1500000, savings: 800000, investments: 1200000 },
      ],
      goalAchievementYear: 2038,
    },
  ],
  taxSuggestions: [
    {
      id: 'tax-001',
      strategy: 'Maximize 401(k) contributions',
      potentialSavings: '$7,500/year in tax savings',
      applicability: 'Available to all employees with 401(k) plans',
      requirements: ['Active 401(k) plan', 'Available contribution room'],
      disclaimer: 'Consult a tax professional for personalized advice',
    },
  ],
  riskAssessment: {
    overallRisk: 'medium',
    riskScore: 45,
    riskFactors: [
      {
        factor: 'Insufficient emergency fund',
        level: 'medium',
        mitigation: 'Build fund to 6 months expenses',
      },
      {
        factor: 'Single income dependency',
        level: 'medium',
        mitigation: 'Consider diversifying income sources',
      },
    ],
    recommendations: ['Increase emergency fund', 'Review insurance coverage', 'Diversify income'],
  },
  goalAnalysis: {
    primaryGoal: 'Retire comfortably at age 65 with $2 million in savings',
    feasibility: 'achievable',
    timeline: '20 years',
    keyMilestones: [
      {
        milestone: 'Pay off mortgage',
        targetDate: '2030',
        requirements: 'Continue current payment plus $500/month extra',
      },
      {
        milestone: 'Reach $1M net worth',
        targetDate: '2033',
        requirements: 'Maintain 20% savings rate',
      },
    ],
  },
  insights: [
    'Your debt-to-income ratio is healthy at 16%',
    'Increasing savings rate by 5% could accelerate retirement by 3 years',
    'Tax-advantaged accounts are underutilized',
  ],
  confidence: 85,
  disclaimers: [
    'This analysis is for informational purposes only and does not constitute financial advice.',
    'Consult with a qualified financial planner for personalized recommendations.',
    'Past performance does not guarantee future results.',
  ],
};

// =============================================================================
// Input Schema Tests
// =============================================================================

describe('Finance Planner Input Schema', () => {
  describe('Valid Inputs', () => {
    it('accepts valid input with all fields', () => {
      const result = FinancePlannerInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('accepts minimal required fields', () => {
      const minimal = {
        serviceType: 'budget-analysis',
        clientType: 'individual',
        timeHorizon: 'short-term',
        primaryGoal: 'Create a monthly budget to reduce expenses',
      };
      const result = FinancePlannerInputSchema.safeParse(minimal);
      expect(result.success).toBe(true);
    });

    it('accepts all service types', () => {
      const serviceTypes = [
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
      ];
      serviceTypes.forEach((s) => {
        const input = { ...validInput, serviceType: s };
        const result = FinancePlannerInputSchema.safeParse(input);
        expect(result.success, `Failed for service type: ${s}`).toBe(true);
      });
    });

    it('accepts all client types', () => {
      const clientTypes = ['individual', 'family', 'small-business', 'startup', 'enterprise', 'nonprofit'];
      clientTypes.forEach((c) => {
        const input = { ...validInput, clientType: c };
        const result = FinancePlannerInputSchema.safeParse(input);
        expect(result.success, `Failed for client type: ${c}`).toBe(true);
      });
    });

    it('accepts all time horizons', () => {
      const horizons = ['short-term', 'medium-term', 'long-term', 'retirement'];
      horizons.forEach((h) => {
        const input = { ...validInput, timeHorizon: h };
        const result = FinancePlannerInputSchema.safeParse(input);
        expect(result.success, `Failed for time horizon: ${h}`).toBe(true);
      });
    });

    it('applies default values correctly', () => {
      const minimal = {
        serviceType: 'budget-analysis',
        clientType: 'individual',
        timeHorizon: 'short-term',
        primaryGoal: 'Create a monthly budget to reduce expenses',
      };
      const result = FinancePlannerInputSchema.parse(minimal);
      expect(result.currency).toBe('USD');
      expect(result.riskTolerance).toBe('moderate');
      expect(result.includeProjections).toBe(true);
      expect(result.includeActionPlan).toBe(true);
      expect(result.includeTaxConsiderations).toBe(true);
      expect(result.includeRiskAnalysis).toBe(true);
    });

    it('accepts optional financial figures', () => {
      const input = {
        ...validInput,
        annualIncome: 75000,
        monthlyExpenses: 5000,
        totalAssets: 100000,
        totalLiabilities: 50000,
        currentSavingsRate: 20,
      };
      const result = FinancePlannerInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid Inputs', () => {
    it('rejects missing service type', () => {
      const { serviceType, ...rest } = validInput;
      const result = FinancePlannerInputSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects invalid service type', () => {
      const input = { ...validInput, serviceType: 'invalid-type' };
      const result = FinancePlannerInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects missing primary goal', () => {
      const { primaryGoal, ...rest } = validInput;
      const result = FinancePlannerInputSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects primary goal that is too short', () => {
      const input = { ...validInput, primaryGoal: 'Save' };
      const result = FinancePlannerInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects negative financial values', () => {
      const input = { ...validInput, annualIncome: -50000 };
      const result = FinancePlannerInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects savings rate over 100%', () => {
      const input = { ...validInput, currentSavingsRate: 150 };
      const result = FinancePlannerInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects too many secondary goals', () => {
      const input = {
        ...validInput,
        secondaryGoals: Array(6).fill('Goal'),
      };
      const result = FinancePlannerInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

// =============================================================================
// Output Schema Tests
// =============================================================================

describe('Finance Planner Output Schema', () => {
  describe('Valid Outputs', () => {
    it('accepts valid full output', () => {
      const result = FinancePlannerOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('accepts minimal required fields', () => {
      const minimal = {
        executiveSummary: 'Your financial health is good with some areas for improvement.',
        financialHealth: {
          overallStatus: 'good',
          score: 70,
          summary: 'Solid financial foundation',
          keyMetrics: {},
          strengths: ['Good savings'],
          concerns: [],
        },
        actionPlan: [],
        goalAnalysis: {
          primaryGoal: 'Save for retirement',
          feasibility: 'achievable',
          timeline: '20 years',
          keyMilestones: [],
        },
        insights: ['Insight 1'],
        confidence: 80,
        disclaimers: ['This is not financial advice.'],
      };
      const result = FinancePlannerOutputSchema.safeParse(minimal);
      expect(result.success).toBe(true);
    });

    it('accepts all health status levels', () => {
      const statuses = ['excellent', 'good', 'fair', 'needs-attention', 'critical'];
      statuses.forEach((s) => {
        const output = {
          ...validOutput,
          financialHealth: {
            ...validOutput.financialHealth,
            overallStatus: s,
          },
        };
        const result = FinancePlannerOutputSchema.safeParse(output);
        expect(result.success, `Failed for status: ${s}`).toBe(true);
      });
    });

    it('accepts all feasibility levels', () => {
      const levels = ['highly-achievable', 'achievable', 'challenging', 'needs-revision'];
      levels.forEach((l) => {
        const output = {
          ...validOutput,
          goalAnalysis: {
            ...validOutput.goalAnalysis,
            feasibility: l,
          },
        };
        const result = FinancePlannerOutputSchema.safeParse(output);
        expect(result.success, `Failed for feasibility: ${l}`).toBe(true);
      });
    });
  });

  describe('Invalid Outputs', () => {
    it('rejects missing executive summary', () => {
      const { executiveSummary, ...rest } = validOutput;
      const result = FinancePlannerOutputSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects invalid health score out of range', () => {
      const output = {
        ...validOutput,
        financialHealth: {
          ...validOutput.financialHealth,
          score: 150,
        },
      };
      const result = FinancePlannerOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('rejects invalid risk level', () => {
      const output = {
        ...validOutput,
        riskAssessment: {
          ...validOutput.riskAssessment,
          overallRisk: 'invalid',
        },
      };
      const result = FinancePlannerOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('rejects confidence above 100', () => {
      const output = { ...validOutput, confidence: 101 };
      const result = FinancePlannerOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('rejects missing disclaimers', () => {
      const { disclaimers, ...rest } = validOutput;
      const result = FinancePlannerOutputSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects allocation percentage over 100', () => {
      const output = {
        ...validOutput,
        investmentRecommendations: [
          {
            ...validOutput.investmentRecommendations![0],
            allocationPercentage: 150,
          },
        ],
      };
      const result = FinancePlannerOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });
  });
});

// =============================================================================
// Prompt Template Tests
// =============================================================================

describe('Finance Planner Prompt Template', () => {
  it('compiles prompt with all fields', () => {
    const prompt = compilePrompt(validInput);
    expect(prompt).toContain('Family'); // Client type label
    expect(prompt).toContain('Retirement Planning'); // Service type label
    expect(prompt).toContain('Retire comfortably'); // Primary goal
    expect(prompt).toContain('Moderate'); // Risk tolerance label
  });

  it('includes org context when provided', () => {
    const prompt = compilePrompt(validInput, 'Company policy requires...');
    expect(prompt).toContain('Organization Context');
    expect(prompt).toContain('Company policy requires');
  });

  it('excludes org context section when not provided', () => {
    const prompt = compilePrompt(validInput);
    expect(prompt).not.toContain('Organization Context');
  });

  it('includes specific concerns when provided', () => {
    const input = { ...validInput, specificConcerns: 'Worried about market volatility' };
    const prompt = compilePrompt(input);
    expect(prompt).toContain('Specific Concerns');
    expect(prompt).toContain('market volatility');
  });

  it('includes financial figures when provided', () => {
    const prompt = compilePrompt(validInput);
    expect(prompt).toContain('Annual Income');
    expect(prompt).toContain('Monthly Expenses');
    expect(prompt).toContain('15%'); // Savings rate
  });

  it('includes JSON schema instructions', () => {
    const prompt = compilePrompt(validInput);
    expect(prompt).toContain('JSON object');
    expect(prompt).toContain('executiveSummary');
    expect(prompt).toContain('financialHealth');
    expect(prompt).toContain('actionPlan');
  });

  it('handles file uploads', () => {
    const input = {
      ...validInput,
      financialStatements: [
        {
          name: 'tax-return.pdf',
          url: 'https://storage.example.com/docs/tax.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 500000,
        },
      ],
    };
    const prompt = compilePrompt(input);
    expect(prompt).toContain('Financial Documents');
    expect(prompt).toContain('tax-return.pdf');
  });
});

// =============================================================================
// Renderer Tests
// =============================================================================

describe('Finance Planner Renderer', () => {
  it('renders full output to markdown', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('# 📊 Financial Planning Analysis');
    expect(markdown).toContain('Executive Summary');
    expect(markdown).toContain('Financial Health Assessment');
    expect(markdown).toContain('Action Plan');
  });

  it('includes health score visualization', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('72/100');
    expect(markdown).toContain('Good');
  });

  it('renders budget analysis when present', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('Budget Analysis');
    expect(markdown).toContain('Monthly Income');
    expect(markdown).toContain('Housing');
  });

  it('renders investment recommendations when present', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('Investment Recommendations');
    expect(markdown).toContain('Diversified Stock Index');
    expect(markdown).toContain('60%');
  });

  it('groups action items by priority', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('Immediate');
    expect(markdown).toContain('Short-term');
  });

  it('includes projections when present', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('Financial Projections');
    expect(markdown).toContain('Moderate Scenario');
    expect(markdown).toContain('2030');
  });

  it('includes tax suggestions when present', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('Tax Optimization');
    expect(markdown).toContain('401(k)');
  });

  it('includes risk assessment when present', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('Risk Assessment');
    expect(markdown).toContain('Medium Risk');
  });

  it('includes goal analysis', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('Goal Analysis');
    expect(markdown).toContain('Achievable');
    expect(markdown).toContain('Key Milestones');
  });

  it('includes disclaimers collapsed', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('Important Disclaimers');
    expect(markdown).toContain('informational purposes');
  });

  it('handles empty action plan gracefully', () => {
    const output = { ...validOutput, actionPlan: [] };
    const markdown = renderToMarkdown(output);
    expect(markdown).toContain('No specific actions recommended');
  });
});

// =============================================================================
// Config Tests
// =============================================================================

describe('Finance Planner Config', () => {
  it('has correct agent ID', () => {
    expect(FINANCE_PLANNER_CONFIG.id).toBe('finance-planner');
  });

  it('is marked as beta', () => {
    expect(FINANCE_PLANNER_CONFIG.isBeta).toBe(true);
  });

  it('is not public', () => {
    expect(FINANCE_PLANNER_CONFIG.isPublic).toBe(false);
  });

  it('supports file upload', () => {
    expect(FINANCE_PLANNER_CONFIG.supportsFileUpload).toBe(true);
  });

  it('includes supported MIME types', () => {
    expect(FINANCE_PLANNER_CONFIG.supportedMimeTypes).toContain('application/pdf');
    expect(FINANCE_PLANNER_CONFIG.supportedMimeTypes).toContain('text/csv');
  });

  it('requires disclaimer', () => {
    expect(FINANCE_PLANNER_CONFIG.disclaimerRequired).toBe(true);
  });

  it('has appropriate token limits', () => {
    expect(FINANCE_PLANNER_CONFIG.maxInputTokens).toBeGreaterThanOrEqual(50000);
    expect(FINANCE_PLANNER_CONFIG.maxOutputTokens).toBeGreaterThanOrEqual(8000);
  });
});
