/**
 * UX Analyst Agent - Markdown Renderer
 *
 * Converts structured JSON output to human-readable Markdown.
 *
 * @see docs/DESIGN.md - Markdown Rendering Pattern
 */

import type { UxAnalystOutput, Finding, Recommendation } from './output-schema';

/**
 * Severity badge styles for rendering
 */
const SEVERITY_BADGES: Record<string, string> = {
  critical: '🔴 Critical',
  high: '🟠 High',
  medium: '🟡 Medium',
  low: '🟢 Low',
  info: '🔵 Info',
};

/**
 * Priority badges for recommendations
 */
const PRIORITY_BADGES: Record<string, string> = {
  immediate: '🚨 Immediate',
  'short-term': '📅 Short-term',
  'long-term': '📆 Long-term',
};

/**
 * Category icons
 */
const CATEGORY_ICONS: Record<string, string> = {
  usability: '🎯',
  accessibility: '♿',
  'visual-design': '🎨',
  'information-architecture': '🗂️',
  'interaction-design': '👆',
  content: '📝',
  performance: '⚡',
  'mobile-responsiveness': '📱',
  consistency: '🔄',
  'error-handling': '⚠️',
};

/**
 * Render the complete UX analysis report to Markdown
 */
export function renderToMarkdown(output: UxAnalystOutput): string {
  const sections: string[] = [];

  // Title
  sections.push('# UX Analysis Report\n');

  // Executive Summary
  sections.push('## Executive Summary\n');
  sections.push(output.executiveSummary + '\n');

  // Scores Dashboard
  sections.push(renderScoresSection(output.scores));

  // Key Insights
  sections.push(renderKeyInsightsSection(output.keyInsights));

  // Strengths
  sections.push(renderStrengthsSection(output.strengths));

  // Findings
  sections.push(renderFindingsSection(output.findings));

  // Recommendations
  sections.push(renderRecommendationsSection(output.recommendations));

  // Accessibility Compliance (if present)
  if (output.accessibilityCompliance) {
    sections.push(renderAccessibilitySection(output.accessibilityCompliance));
  }

  // Competitor Analysis (if present)
  if (output.competitorAnalysis && output.competitorAnalysis.length > 0) {
    sections.push(renderCompetitorSection(output.competitorAnalysis));
  }

  // Next Steps
  sections.push(renderNextStepsSection(output.nextSteps));

  return sections.join('\n');
}

/**
 * Render scores as a visual dashboard
 */
function renderScoresSection(
  scores: UxAnalystOutput['scores']
): string {
  const scoreBar = (score: number): string => {
    const filled = Math.round(score / 10);
    const empty = 10 - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${score}`;
  };

  return `## UX Scores

| Category | Score |
|----------|-------|
| **Overall** | ${scoreBar(scores.overall)} |
| Usability | ${scoreBar(scores.usability)} |
| Accessibility | ${scoreBar(scores.accessibility)} |
| Visual Design | ${scoreBar(scores.visualDesign)} |
| Information Architecture | ${scoreBar(scores.informationArchitecture)} |

`;
}

/**
 * Render key insights as a numbered list
 */
function renderKeyInsightsSection(insights: string[]): string {
  let md = '## Key Insights\n\n';
  insights.forEach((insight, i) => {
    md += `${i + 1}. ${insight}\n`;
  });
  return md + '\n';
}

/**
 * Render strengths section
 */
function renderStrengthsSection(strengths: string[]): string {
  let md = '## Strengths\n\n';
  md += "Here's what the product does well:\n\n";
  strengths.forEach((strength) => {
    md += `- ✅ ${strength}\n`;
  });
  return md + '\n';
}

/**
 * Render findings section with grouping by severity
 */
function renderFindingsSection(findings: Finding[]): string {
  let md = '## Findings\n\n';
  md += `Found **${findings.length}** issues requiring attention.\n\n`;

  // Group by severity
  const bySeverity = groupBySeverity(findings);
  const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];

  for (const severity of severityOrder) {
    const items = bySeverity[severity];
    if (items && items.length > 0) {
      md += `### ${SEVERITY_BADGES[severity]} Issues (${items.length})\n\n`;

      items.forEach((finding) => {
        md += renderFinding(finding);
      });
    }
  }

  return md;
}

/**
 * Render a single finding
 */
function renderFinding(finding: Finding): string {
  const icon = CATEGORY_ICONS[finding.category] || '•';
  let md = `#### ${icon} ${finding.id}: ${finding.title}\n\n`;

  md += `**Category:** ${finding.category.replace('-', ' ')}\n\n`;
  md += `${finding.description}\n\n`;

  if (finding.location) {
    md += `**Location:** ${finding.location}\n\n`;
  }

  if (finding.wcagCriteria) {
    md += `**WCAG Criteria:** ${finding.wcagCriteria}\n\n`;
  }

  md += `**User Impact:** ${finding.userImpact}\n\n`;

  if (finding.evidence) {
    md += `> ${finding.evidence}\n\n`;
  }

  md += '---\n\n';

  return md;
}

/**
 * Render recommendations section
 */
function renderRecommendationsSection(recommendations: Recommendation[]): string {
  let md = '## Recommendations\n\n';
  md += `**${recommendations.length}** actionable recommendations to improve UX.\n\n`;

  // Group by priority
  const byPriority: Record<string, Recommendation[]> = {
    immediate: [],
    'short-term': [],
    'long-term': [],
  };

  recommendations.forEach((rec) => {
    byPriority[rec.priority].push(rec);
  });

  const priorityOrder = ['immediate', 'short-term', 'long-term'];

  for (const priority of priorityOrder) {
    const items = byPriority[priority];
    if (items.length > 0) {
      md += `### ${PRIORITY_BADGES[priority]} (${items.length})\n\n`;

      items.forEach((rec) => {
        md += renderRecommendation(rec);
      });
    }
  }

  return md;
}

/**
 * Render a single recommendation
 */
function renderRecommendation(rec: Recommendation): string {
  const icon = CATEGORY_ICONS[rec.category] || '•';
  let md = `#### ${icon} ${rec.id}: ${rec.title}\n\n`;

  md += `${rec.description}\n\n`;

  md += `| Effort | Impact |\n`;
  md += `|--------|--------|\n`;
  md += `| ${rec.implementationEffort} | ${rec.businessImpact} |\n\n`;

  md += `**Rationale:** ${rec.rationale}\n\n`;

  if (rec.relatedFindings && rec.relatedFindings.length > 0) {
    md += `**Addresses:** ${rec.relatedFindings.join(', ')}\n\n`;
  }

  if (rec.exampleImplementation) {
    md += `**Example:**\n\n\`\`\`\n${rec.exampleImplementation}\n\`\`\`\n\n`;
  }

  md += '---\n\n';

  return md;
}

/**
 * Render accessibility compliance section
 */
function renderAccessibilitySection(
  compliance: NonNullable<UxAnalystOutput['accessibilityCompliance']>
): string {
  const statusIcons = {
    compliant: '✅',
    partial: '⚠️',
    'non-compliant': '❌',
  };

  let md = '## Accessibility Compliance\n\n';
  md += `**Target Level:** ${compliance.level}\n\n`;
  md += `**Status:** ${statusIcons[compliance.status]} ${compliance.status.toUpperCase()}\n\n`;

  if (compliance.criticalIssues > 0) {
    md += `**⚠️ Critical Issues:** ${compliance.criticalIssues}\n\n`;
  }

  md += compliance.summary + '\n\n';

  return md;
}

/**
 * Render competitor analysis section
 */
function renderCompetitorSection(
  competitors: NonNullable<UxAnalystOutput['competitorAnalysis']>
): string {
  let md = '## Competitive Analysis\n\n';

  competitors.forEach((comp) => {
    md += `### ${new URL(comp.competitorUrl).hostname}\n\n`;

    md += '**Strengths:**\n';
    comp.strengths.forEach((s) => {
      md += `- ${s}\n`;
    });
    md += '\n';

    md += '**Weaknesses:**\n';
    comp.weaknesses.forEach((w) => {
      md += `- ${w}\n`;
    });
    md += '\n';

    md += '**Opportunities for Differentiation:**\n';
    comp.opportunities.forEach((o) => {
      md += `- 💡 ${o}\n`;
    });
    md += '\n';
  });

  return md;
}

/**
 * Render next steps section
 */
function renderNextStepsSection(nextSteps: string[]): string {
  let md = '## Next Steps\n\n';
  md += 'Prioritized actions to take:\n\n';

  nextSteps.forEach((step, i) => {
    md += `${i + 1}. ${step}\n`;
  });

  return md + '\n';
}

/**
 * Helper to group findings by severity
 */
function groupBySeverity(
  findings: Finding[]
): Record<string, Finding[]> {
  return findings.reduce(
    (acc, finding) => {
      const key = finding.severity;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(finding);
      return acc;
    },
    {} as Record<string, Finding[]>
  );
}
