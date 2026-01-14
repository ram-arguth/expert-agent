/**
 * Legal Advisor Agent - Markdown Renderer
 *
 * Converts structured Legal Advisor output to formatted Markdown.
 *
 * @see docs/DESIGN.md - Renderer Pattern
 */

import type { LegalAdvisorOutput, Finding, Recommendation, ClauseSummary } from './output-schema';

/**
 * Severity badge with emoji
 */
function getSeverityBadge(severity: string): string {
  const badges: Record<string, string> = {
    critical: '🔴 **CRITICAL**',
    high: '🟠 **HIGH**',
    medium: '🟡 **MEDIUM**',
    low: '🟢 **LOW**',
  };
  return badges[severity] || severity.toUpperCase();
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
 * Priority badge
 */
function getPriorityBadge(priority: string): string {
  const badges: Record<string, string> = {
    immediate: '⚡ **Immediate**',
    'short-term': '📅 **Short-term**',
    'long-term': '📆 **Long-term**',
  };
  return badges[priority] || priority;
}

/**
 * Favorability indicator
 */
function getFavorabilityIndicator(favorability: string): string {
  const indicators: Record<string, string> = {
    favorable: '✅ Favorable',
    neutral: '➖ Neutral',
    unfavorable: '⚠️ Unfavorable',
    'heavily-unfavorable': '🚨 Heavily Unfavorable',
  };
  return indicators[favorability] || favorability;
}

/**
 * Compliance status indicator
 */
function getComplianceIndicator(status: string): string {
  const indicators: Record<string, string> = {
    compliant: '✅ Compliant',
    'partially-compliant': '⚠️ Partially Compliant',
    'non-compliant': '❌ Non-Compliant',
    'not-applicable': '➖ N/A',
  };
  return indicators[status] || status;
}

/**
 * Generate visual risk score bar
 */
function renderRiskScoreBar(score: number): string {
  const barLength = 20;
  const filled = Math.round((score / 100) * barLength);
  const empty = barLength - filled;
  // Color indicator is shown in the overall risk badge, not needed here
  return `\`${'█'.repeat(filled)}${'░'.repeat(empty)}\` ${score}/100`;
}

/**
 * Render findings section
 */
function renderFindings(findings: Finding[]): string {
  if (!findings.length) {
    return '✅ No significant issues identified.\n';
  }

  // Group by severity
  const groupedFindings: Record<string, Finding[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };

  findings.forEach((f) => {
    if (groupedFindings[f.severity]) {
      groupedFindings[f.severity].push(f);
    } else {
      groupedFindings.low.push(f);
    }
  });

  let md = '';

  for (const severity of ['critical', 'high', 'medium', 'low']) {
    const items = groupedFindings[severity];
    if (items.length === 0) continue;

    md += `\n### ${getSeverityBadge(severity)} (${items.length})\n\n`;

    items.forEach((finding, idx) => {
      md += `#### ${idx + 1}. ${finding.title}\n\n`;
      md += `**Category:** ${finding.category.replace('-', ' ').toUpperCase()}\n`;
      if (finding.clauseReference) {
        md += `**Clause:** ${finding.clauseReference}\n`;
      }
      md += `**Affected Party:** ${finding.affectedParty.replace('-', ' ')}\n\n`;
      md += `${finding.description}\n\n`;
      if (finding.originalText) {
        md += `> **Original Text:** *"${finding.originalText}"*\n\n`;
      }
      md += `**Risk:** ${finding.riskExplanation}\n\n`;
      md += `---\n\n`;
    });
  }

  return md;
}

/**
 * Render recommendations section
 */
function renderRecommendations(recommendations: Recommendation[]): string {
  if (!recommendations.length) {
    return 'No specific recommendations at this time.\n';
  }

  // Group by priority
  const grouped: Record<string, Recommendation[]> = {
    immediate: [],
    'short-term': [],
    'long-term': [],
  };

  recommendations.forEach((r) => {
    const key = r.priority || 'short-term';
    if (grouped[key]) {
      grouped[key].push(r);
    } else {
      grouped['long-term'].push(r);
    }
  });

  let md = '';

  for (const priority of ['immediate', 'short-term', 'long-term']) {
    const items = grouped[priority];
    if (items.length === 0) continue;

    md += `\n### ${getPriorityBadge(priority)}\n\n`;

    items.forEach((rec, idx) => {
      md += `**${idx + 1}. ${rec.action}**\n\n`;
      md += `${rec.rationale}\n\n`;
      if (rec.suggestedLanguage) {
        md += `> **Suggested Language:**\n> \n> *${rec.suggestedLanguage}*\n\n`;
      }
      if (rec.negotiationTip) {
        md += `💡 **Negotiation Tip:** ${rec.negotiationTip}\n\n`;
      }
      if (rec.effort) {
        md += `**Effort:** ${rec.effort.charAt(0).toUpperCase() + rec.effort.slice(1)}\n\n`;
      }
    });
  }

  return md;
}

/**
 * Render clause summaries
 */
function renderClauseSummaries(clauses: ClauseSummary[]): string {
  if (!clauses.length) return '';

  let md = '## 📋 Key Clause Analysis\n\n';
  md += '| Clause | Reference | Favorability | Standard? |\n';
  md += '|--------|-----------|--------------|----------|\n';

  clauses.forEach((clause) => {
    md += `| ${clause.clauseName} | ${clause.clauseReference} | ${getFavorabilityIndicator(
      clause.favorability
    )} | ${clause.isStandard ? '✅' : '⚠️'} |\n`;
  });

  md += '\n### Clause Details\n\n';

  clauses.forEach((clause) => {
    md += `#### ${clause.clauseName} (${clause.clauseReference})\n\n`;
    md += `${clause.summary}\n\n`;
    if (clause.marketComparison) {
      md += `**Market Comparison:** ${clause.marketComparison}\n\n`;
    }
  });

  return md;
}

/**
 * Render risk assessment section
 */
function renderRiskAssessment(output: LegalAdvisorOutput): string {
  const { riskAssessment } = output;

  let md = '## ⚠️ Risk Assessment\n\n';

  // Overall risk with visual bar
  md += `### Overall Risk Level: ${getRiskBadge(riskAssessment.overallRisk)}\n\n`;
  md += `**Risk Score:** ${renderRiskScoreBar(riskAssessment.riskScore)}\n\n`;

  // Key risks
  if (riskAssessment.keyRisks.length > 0) {
    md += '### Key Risk Factors\n\n';
    riskAssessment.keyRisks.forEach((risk) => {
      md += `- 🔸 ${risk}\n`;
    });
    md += '\n';
  }

  // Mitigating factors
  if (riskAssessment.mitigatingFactors.length > 0) {
    md += '### Mitigating Factors\n\n';
    riskAssessment.mitigatingFactors.forEach((factor) => {
      md += `- ✅ ${factor}\n`;
    });
    md += '\n';
  }

  // Risk by category
  if (riskAssessment.riskByCategory) {
    md += '### Risk by Category\n\n';
    md += '| Category | Risk Level |\n';
    md += '|----------|------------|\n';
    Object.entries(riskAssessment.riskByCategory).forEach(([category, level]) => {
      md += `| ${category.replace(/-/g, ' ').toUpperCase()} | ${getRiskBadge(level)} |\n`;
    });
    md += '\n';
  }

  return md;
}

/**
 * Main render function - converts output to Markdown
 */
export function renderToMarkdown(output: LegalAdvisorOutput): string {
  let md = '';

  // Header
  md += '# 📜 Legal Contract Analysis\n\n';

  // Disclaimers (important for legal content)
  md += '<details>\n<summary>⚖️ Important Legal Disclaimers</summary>\n\n';
  output.disclaimers.forEach((d) => {
    md += `> ${d}\n>\n`;
  });
  md += '\n</details>\n\n';

  // Executive Summary
  md += '## 📝 Executive Summary\n\n';
  md += `${output.executiveSummary}\n\n`;

  // Confidence score
  md += `**Analysis Confidence:** ${output.confidence}%\n\n`;

  // Contract Metadata
  md += '## 📄 Contract Information\n\n';
  md += `| Property | Value |\n`;
  md += `|----------|-------|\n`;
  md += `| **Title** | ${output.contractMetadata.title} |\n`;
  md += `| **Parties** | ${output.contractMetadata.parties.join(', ')} |\n`;
  if (output.contractMetadata.effectiveDate) {
    md += `| **Effective Date** | ${output.contractMetadata.effectiveDate} |\n`;
  }
  if (output.contractMetadata.expirationDate) {
    md += `| **Expiration Date** | ${output.contractMetadata.expirationDate} |\n`;
  }
  if (output.contractMetadata.governingLaw) {
    md += `| **Governing Law** | ${output.contractMetadata.governingLaw} |\n`;
  }
  if (output.contractMetadata.contractValue) {
    md += `| **Contract Value** | ${output.contractMetadata.contractValue} |\n`;
  }
  md += '\n';

  // Risk Assessment
  md += renderRiskAssessment(output);

  // Findings
  md += '## 🔍 Findings\n\n';
  md += `Found **${output.findings.length}** issues to review.\n\n`;
  md += renderFindings(output.findings);

  // Recommendations
  md += '## 💡 Recommendations\n\n';
  md += renderRecommendations(output.recommendations);

  // Clause Summaries (if provided)
  if (output.clauseSummaries && output.clauseSummaries.length > 0) {
    md += renderClauseSummaries(output.clauseSummaries);
  }

  // Compliance Checks (if provided)
  if (output.complianceChecks && output.complianceChecks.length > 0) {
    md += '## ✅ Compliance Analysis\n\n';
    md += '| Area | Status | Details |\n';
    md += '|------|--------|----------|\n';
    output.complianceChecks.forEach((check) => {
      md += `| ${check.area} | ${getComplianceIndicator(check.status)} | ${check.details} |\n`;
    });
    md += '\n';
  }

  // Negotiation Strategy (if provided)
  if (output.negotiationStrategy) {
    md += '## 🤝 Negotiation Strategy\n\n';
    md += `**Overall Approach:** ${output.negotiationStrategy.overallApproach}\n\n`;

    if (output.negotiationStrategy.priorityPoints.length > 0) {
      md += '### Priority Negotiation Points\n\n';
      output.negotiationStrategy.priorityPoints.forEach((point, i) => {
        md += `${i + 1}. ${point}\n`;
      });
      md += '\n';
    }

    if (output.negotiationStrategy.dealBreakers.length > 0) {
      md += '### 🚫 Potential Deal Breakers\n\n';
      output.negotiationStrategy.dealBreakers.forEach((breaker) => {
        md += `- ${breaker}\n`;
      });
      md += '\n';
    }

    if (output.negotiationStrategy.concessionPoints.length > 0) {
      md += '### 🤲 Possible Concession Points\n\n';
      output.negotiationStrategy.concessionPoints.forEach((point) => {
        md += `- ${point}\n`;
      });
      md += '\n';
    }
  }

  // Key Dates (if provided)
  if (output.keyDates && output.keyDates.length > 0) {
    md += '## 📅 Key Dates & Deadlines\n\n';
    md += '| Date | Description | Action Required |\n';
    md += '|------|-------------|------------------|\n';
    output.keyDates.forEach((date) => {
      md += `| ${date.date} | ${date.description} | ${date.actionRequired || '-'} |\n`;
    });
    md += '\n';
  }

  // Appendix (if provided)
  if (output.appendix) {
    md += '## 📎 Appendix\n\n';
    md += output.appendix;
    md += '\n\n';
  }

  // Footer
  md += '---\n\n';
  md += '*This analysis was generated by the Legal Advisor AI. ';
  md += 'Please consult with a qualified attorney for legal advice.*\n';

  return md;
}
