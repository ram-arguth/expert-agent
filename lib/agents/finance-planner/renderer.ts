/**
 * Finance Planner Agent - Markdown Renderer
 *
 * Converts structured Finance Planner output to formatted Markdown.
 *
 * @see docs/DESIGN.md - Renderer Pattern
 */

import type {
  FinancePlannerOutput,
  ActionItem,
  InvestmentRecommendation,
  ProjectionScenario,
} from './output-schema';

/**
 * Health status badge with emoji
 */
function getHealthBadge(status: string): string {
  const badges: Record<string, string> = {
    excellent: '🟢 **Excellent**',
    good: '🟡 **Good**',
    fair: '🟠 **Fair**',
    'needs-attention': '🔴 **Needs Attention**',
    critical: '⛔ **Critical**',
  };
  return badges[status] || status.toUpperCase();
}

/**
 * Priority badge
 */
function getPriorityBadge(priority: string): string {
  const badges: Record<string, string> = {
    immediate: '⚡ **Immediate**',
    'short-term': '📅 **Short-term**',
    'medium-term': '📆 **Medium-term**',
    'long-term': '🎯 **Long-term**',
  };
  return badges[priority] || priority;
}

/**
 * Impact badge
 */
function getImpactBadge(impact: string): string {
  const badges: Record<string, string> = {
    high: '💰 High Impact',
    medium: '💵 Medium Impact',
    low: '💲 Low Impact',
  };
  return badges[impact] || impact;
}

/**
 * Risk level badge
 */
function getRiskBadge(risk: string): string {
  const badges: Record<string, string> = {
    high: '🔴 High Risk',
    medium: '🟠 Medium Risk',
    low: '🟡 Low Risk',
    minimal: '🟢 Minimal Risk',
  };
  return badges[risk] || risk;
}

/**
 * Feasibility badge
 */
function getFeasibilityBadge(feasibility: string): string {
  const badges: Record<string, string> = {
    'highly-achievable': '✅ Highly Achievable',
    achievable: '🟢 Achievable',
    challenging: '🟠 Challenging',
    'needs-revision': '🔴 Needs Revision',
  };
  return badges[feasibility] || feasibility;
}

/**
 * Generate visual score bar
 */
function renderScoreBar(score: number, label: string): string {
  const barLength = 20;
  const filled = Math.round((score / 100) * barLength);
  const empty = barLength - filled;
  const emoji = score >= 70 ? '🟢' : score >= 40 ? '🟠' : '🔴';
  return `${emoji} \`${'█'.repeat(filled)}${'░'.repeat(empty)}\` **${score}/100** - ${label}`;
}

/**
 * Format currency
 */
function formatCurrency(amount: number | undefined, currency = 'USD'): string {
  if (amount === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Render action plan section
 */
function renderActionPlan(actions: ActionItem[]): string {
  if (!actions.length) return 'No specific actions recommended at this time.\n';

  // Group by priority
  const grouped: Record<string, ActionItem[]> = {
    immediate: [],
    'short-term': [],
    'medium-term': [],
    'long-term': [],
  };

  actions.forEach((a) => {
    const key = a.priority || 'short-term';
    if (grouped[key]) {
      grouped[key].push(a);
    } else {
      grouped['long-term'].push(a);
    }
  });

  let md = '';

  for (const priority of ['immediate', 'short-term', 'medium-term', 'long-term']) {
    const items = grouped[priority];
    if (items.length === 0) continue;

    md += `\n### ${getPriorityBadge(priority)}\n\n`;

    items.forEach((action, idx) => {
      md += `**${idx + 1}. ${action.action}**\n\n`;
      md += `- ${getImpactBadge(action.impact)} | Effort: ${action.effort} | Timeline: ${action.timeline}\n`;
      if (action.potentialSavings) {
        md += `- 💰 Potential Savings: ${formatCurrency(action.potentialSavings)}/year\n`;
      }
      if (action.details) {
        md += `- ${action.details}\n`;
      }
      md += '\n';
    });
  }

  return md;
}

/**
 * Render investment recommendations
 */
function renderInvestments(investments: InvestmentRecommendation[]): string {
  if (!investments.length) return '';

  let md = '## 📊 Investment Recommendations\n\n';
  md += '| Category | Allocation | Risk | Expected Return |\n';
  md += '|----------|------------|------|------------------|\n';

  investments.forEach((inv) => {
    md += `| ${inv.category} | ${inv.allocationPercentage}% | ${getRiskBadge(inv.riskLevel)} | ${inv.expectedReturn || 'N/A'} |\n`;
  });

  md += '\n### Investment Details\n\n';

  investments.forEach((inv, idx) => {
    md += `#### ${idx + 1}. ${inv.category} (${inv.allocationPercentage}%)\n\n`;
    md += `${inv.recommendation}\n\n`;
    md += `**Rationale:** ${inv.rationale}\n\n`;
    if (inv.considerations && inv.considerations.length > 0) {
      md += '**Considerations:**\n';
      inv.considerations.forEach((c) => {
        md += `- ${c}\n`;
      });
      md += '\n';
    }
  });

  return md;
}

/**
 * Render projections
 */
function renderProjections(projections: ProjectionScenario[]): string {
  if (!projections.length) return '';

  let md = '## 📈 Financial Projections\n\n';

  projections.forEach((scenario) => {
    const scenarioEmoji = scenario.name === 'optimistic' ? '🚀' : scenario.name === 'conservative' ? '🛡️' : '⚖️';
    md += `### ${scenarioEmoji} ${scenario.name.charAt(0).toUpperCase() + scenario.name.slice(1)} Scenario\n\n`;

    md += '**Assumptions:**\n';
    scenario.assumptions.forEach((a) => {
      md += `- ${a}\n`;
    });
    md += '\n';

    if (scenario.goalAchievementYear) {
      md += `🎯 **Goal Achievement:** Year ${scenario.goalAchievementYear}\n\n`;
    }

    md += '| Year | Net Worth | Savings | Investments | Milestone |\n';
    md += '|------|-----------|---------|-------------|----------|\n';

    scenario.dataPoints.forEach((dp) => {
      md += `| ${dp.year} | ${formatCurrency(dp.netWorth)} | ${formatCurrency(dp.savings)} | ${formatCurrency(dp.investments)} | ${dp.milestone || '-'} |\n`;
    });
    md += '\n';
  });

  return md;
}

/**
 * Main render function - converts output to Markdown
 */
export function renderToMarkdown(output: FinancePlannerOutput): string {
  let md = '';

  // Header
  md += '# 📊 Financial Planning Analysis\n\n';

  // Disclaimers (important for financial content)
  md += '<details>\n<summary>⚠️ Important Disclaimers</summary>\n\n';
  output.disclaimers.forEach((d) => {
    md += `> ${d}\n>\n`;
  });
  md += '\n</details>\n\n';

  // Executive Summary
  md += '## 📝 Executive Summary\n\n';
  md += `${output.executiveSummary}\n\n`;

  // Confidence score
  md += `**Analysis Confidence:** ${output.confidence}%\n\n`;

  // Financial Health Assessment
  md += '## 💰 Financial Health Assessment\n\n';
  md += `### Overall Status: ${getHealthBadge(output.financialHealth.overallStatus)}\n\n`;
  md += renderScoreBar(output.financialHealth.score, output.financialHealth.summary) + '\n\n';

  // Key Metrics
  const metrics = output.financialHealth.keyMetrics;
  if (Object.values(metrics).some((v) => v !== undefined)) {
    md += '### Key Financial Metrics\n\n';
    md += '| Metric | Value |\n';
    md += '|--------|-------|\n';
    if (metrics.netWorth !== undefined) md += `| Net Worth | ${formatCurrency(metrics.netWorth)} |\n`;
    if (metrics.savingsRate !== undefined) md += `| Savings Rate | ${metrics.savingsRate}% |\n`;
    if (metrics.debtToIncomeRatio !== undefined) md += `| Debt-to-Income Ratio | ${metrics.debtToIncomeRatio}% |\n`;
    if (metrics.emergencyFundMonths !== undefined) md += `| Emergency Fund | ${metrics.emergencyFundMonths} months |\n`;
    if (metrics.liquidityRatio !== undefined) md += `| Liquidity Ratio | ${metrics.liquidityRatio}x |\n`;
    md += '\n';
  }

  // Strengths
  if (output.financialHealth.strengths.length > 0) {
    md += '### ✅ Strengths\n\n';
    output.financialHealth.strengths.forEach((s) => {
      md += `- ${s}\n`;
    });
    md += '\n';
  }

  // Concerns
  if (output.financialHealth.concerns.length > 0) {
    md += '### ⚠️ Areas of Concern\n\n';
    output.financialHealth.concerns.forEach((c) => {
      md += `- ${c}\n`;
    });
    md += '\n';
  }

  // Budget Analysis (if present)
  if (output.budgetAnalysis) {
    md += '## 📋 Budget Analysis\n\n';
    const budget = output.budgetAnalysis;
    md += `| Category | Amount |\n`;
    md += `|----------|--------|\n`;
    md += `| Monthly Income | ${formatCurrency(budget.monthlyIncome)} |\n`;
    md += `| Monthly Expenses | ${formatCurrency(budget.monthlyExpenses)} |\n`;
    md += `| Monthly Surplus | ${formatCurrency(budget.monthlySurplus)} |\n`;
    md += '\n';

    if (budget.expenseBreakdown.length > 0) {
      md += '### Expense Breakdown\n\n';
      md += '| Category | Amount | % of Income | Recommendation |\n';
      md += '|----------|--------|-------------|----------------|\n';
      budget.expenseBreakdown.forEach((exp) => {
        md += `| ${exp.category} | ${formatCurrency(exp.amount)} | ${exp.percentOfIncome}% | ${exp.recommendation || '-'} |\n`;
      });
      md += '\n';
    }

    md += '### Savings Allocation\n\n';
    md += `- **Recommended Monthly Savings:** ${formatCurrency(budget.savingsAllocation.recommended)}\n`;
    md += `- **Current Monthly Savings:** ${formatCurrency(budget.savingsAllocation.current)}\n`;
    md += `- **Gap:** ${formatCurrency(budget.savingsAllocation.gap)}\n\n`;
  }

  // Goal Analysis
  md += '## 🎯 Goal Analysis\n\n';
  md += `**Goal:** ${output.goalAnalysis.primaryGoal}\n\n`;
  md += `**Feasibility:** ${getFeasibilityBadge(output.goalAnalysis.feasibility)}\n\n`;
  md += `**Timeline:** ${output.goalAnalysis.timeline}\n\n`;

  if (output.goalAnalysis.keyMilestones.length > 0) {
    md += '### Key Milestones\n\n';
    md += '| Milestone | Target Date | Requirements |\n';
    md += '|-----------|-------------|---------------|\n';
    output.goalAnalysis.keyMilestones.forEach((m) => {
      md += `| ${m.milestone} | ${m.targetDate} | ${m.requirements} |\n`;
    });
    md += '\n';
  }

  // Investment Recommendations (if present)
  if (output.investmentRecommendations && output.investmentRecommendations.length > 0) {
    md += renderInvestments(output.investmentRecommendations);
  }

  // Action Plan
  md += '## 📝 Action Plan\n\n';
  md += renderActionPlan(output.actionPlan);

  // Projections (if present)
  if (output.projections && output.projections.length > 0) {
    md += renderProjections(output.projections);
  }

  // Tax Suggestions (if present)
  if (output.taxSuggestions && output.taxSuggestions.length > 0) {
    md += '## 💼 Tax Optimization Suggestions\n\n';
    output.taxSuggestions.forEach((tax, idx) => {
      md += `### ${idx + 1}. ${tax.strategy}\n\n`;
      md += `**Potential Savings:** ${tax.potentialSavings}\n\n`;
      md += `**Applicability:** ${tax.applicability}\n\n`;
      if (tax.requirements && tax.requirements.length > 0) {
        md += '**Requirements:**\n';
        tax.requirements.forEach((r) => {
          md += `- ${r}\n`;
        });
        md += '\n';
      }
      if (tax.disclaimer) {
        md += `> ⚠️ ${tax.disclaimer}\n\n`;
      }
    });
  }

  // Risk Assessment (if present)
  if (output.riskAssessment) {
    md += '## ⚠️ Risk Assessment\n\n';
    md += `### Overall Risk: ${getRiskBadge(output.riskAssessment.overallRisk)}\n\n`;
    md += renderScoreBar(output.riskAssessment.riskScore, 'Risk Score (higher = more risk)') + '\n\n';

    if (output.riskAssessment.riskFactors.length > 0) {
      md += '### Risk Factors\n\n';
      md += '| Factor | Level | Mitigation |\n';
      md += '|--------|-------|------------|\n';
      output.riskAssessment.riskFactors.forEach((rf) => {
        md += `| ${rf.factor} | ${getRiskBadge(rf.level)} | ${rf.mitigation} |\n`;
      });
      md += '\n';
    }

    if (output.riskAssessment.recommendations.length > 0) {
      md += '### Risk Mitigation Recommendations\n\n';
      output.riskAssessment.recommendations.forEach((r) => {
        md += `- ${r}\n`;
      });
      md += '\n';
    }
  }

  // Key Insights
  if (output.insights.length > 0) {
    md += '## 💡 Key Insights\n\n';
    output.insights.forEach((insight) => {
      md += `- ${insight}\n`;
    });
    md += '\n';
  }

  // Footer
  md += '---\n\n';
  md += '*This analysis was generated by the Finance Planner AI. ';
  md += 'Please consult with qualified financial professionals for personalized advice.*\n';

  return md;
}
