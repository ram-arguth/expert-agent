/**
 * Legal Advisor Agent Tests
 *
 * Comprehensive tests for the Legal Advisor agent:
 * - Input schema validation
 * - Output schema validation
 * - Prompt template compilation
 * - Markdown rendering
 */

import { describe, it, expect } from 'vitest';
import {
  LegalAdvisorInputSchema,
  LegalAdvisorOutputSchema,
  compilePrompt,
  renderToMarkdown,
  LEGAL_ADVISOR_CONFIG,
  type LegalAdvisorInput,
  type LegalAdvisorOutput,
} from './index';

// =============================================================================
// Test Fixtures
// =============================================================================

const validInput: LegalAdvisorInput = {
  jurisdiction: 'US',
  contractType: 'employment',
  primaryContract: {
    name: 'employment-agreement.pdf',
    url: 'https://storage.example.com/contracts/emp-001.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024000,
  },
  partyRole: 'party-a',
  reviewPriority: 'standard',
  dealValue: '100k-1m',
  compareWithStandard: true,
  flagNonStandardTerms: true,
  suggestNegotiationPoints: true,
};

const validOutput: LegalAdvisorOutput = {
  executiveSummary:
    'This is a standard employment agreement with several notable provisions that require attention.',
  contractMetadata: {
    title: 'Employment Agreement',
    parties: ['Acme Corp', 'John Doe'],
    effectiveDate: '2024-01-01',
    expirationDate: '2025-12-31',
    governingLaw: 'State of California',
    contractValue: '$150,000 annual salary',
  },
  riskAssessment: {
    overallRisk: 'medium',
    riskScore: 45,
    keyRisks: [
      'Broad non-compete clause',
      'Assignment of all IP rights',
      'One-sided termination provisions',
    ],
    mitigatingFactors: [
      'Standard severance package',
      'Clear performance expectations',
    ],
    riskByCategory: {
      'non-compete': 'high',
      'ip-rights': 'high',
      termination: 'medium',
      confidentiality: 'low',
    },
  },
  findings: [
    {
      id: 'finding-001',
      title: 'Overly broad non-compete clause',
      severity: 'high',
      category: 'non-compete',
      description:
        'The non-compete clause prohibits employment in any related industry for 2 years within a 100-mile radius.',
      clauseReference: 'Section 8.2',
      originalText:
        'Employee shall not engage in any competing business within 100 miles for 24 months...',
      riskExplanation:
        'This may be unenforceable in California but could limit opportunities in other states.',
      affectedParty: 'party-b',
    },
    {
      id: 'finding-002',
      title: 'IP assignment includes pre-existing work',
      severity: 'critical',
      category: 'ip-rights',
      description:
        'The IP assignment clause appears to include work created before employment.',
      clauseReference: 'Section 5.1',
      riskExplanation: 'This could result in loss of ownership of personal projects.',
      affectedParty: 'party-b',
    },
  ],
  recommendations: [
    {
      id: 'rec-001',
      findingId: 'finding-001',
      action: 'Negotiate narrower geographic and time restrictions',
      priority: 'immediate',
      rationale: 'California courts rarely enforce broad non-competes.',
      suggestedLanguage:
        'Employee shall not solicit direct clients for 12 months post-termination.',
      negotiationTip:
        'Cite California Business & Professions Code Section 16600.',
      effort: 'medium',
    },
    {
      id: 'rec-002',
      findingId: 'finding-002',
      action: 'Add exclusion for pre-existing IP',
      priority: 'immediate',
      rationale: 'Protects personal projects and prior inventions.',
      suggestedLanguage:
        'Excluded from assignment: all works listed in Exhibit A created prior to employment.',
      effort: 'low',
    },
  ],
  clauseSummaries: [
    {
      clauseName: 'Non-Compete',
      clauseReference: 'Section 8',
      summary:
        'Standard non-compete with overly broad geographic and temporal scope.',
      isStandard: false,
      marketComparison:
        'Most tech companies limit to 12 months and specific client solicitation.',
      favorability: 'unfavorable',
    },
    {
      clauseName: 'Confidentiality',
      clauseReference: 'Section 6',
      summary: 'Standard confidentiality provisions with reasonable scope.',
      isStandard: true,
      favorability: 'neutral',
    },
  ],
  complianceChecks: [
    {
      area: 'California Labor Code',
      status: 'partially-compliant',
      details: 'Non-compete may violate Section 16600.',
      requiredActions: ['Review non-compete enforceability'],
    },
  ],
  negotiationStrategy: {
    overallApproach:
      'Focus on IP assignment and non-compete modifications while maintaining core terms.',
    priorityPoints: ['IP exclusion for pre-existing work', 'Non-compete reduction'],
    dealBreakers: ['Full IP assignment without exclusions'],
    concessionPoints: ['Confidentiality terms', 'Notice period'],
  },
  keyDates: [
    {
      date: '2024-01-01',
      description: 'Employment start date',
      actionRequired: 'Complete onboarding paperwork',
    },
    {
      date: '2024-03-01',
      description: 'First performance review',
    },
  ],
  confidence: 85,
  disclaimers: [
    'This analysis is for informational purposes only and does not constitute legal advice.',
    'Laws may have changed since the AI training data cutoff.',
    'Consult with a qualified attorney in your jurisdiction.',
  ],
};

// =============================================================================
// Input Schema Tests
// =============================================================================

describe('Legal Advisor Input Schema', () => {
  describe('Valid Inputs', () => {
    it('accepts valid input with all fields', () => {
      const result = LegalAdvisorInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('accepts minimal required fields', () => {
      const minimal = {
        jurisdiction: 'US',
        contractType: 'nda',
        primaryContract: {
          name: 'nda.pdf',
          url: 'https://example.com/nda.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 50000,
        },
      };
      const result = LegalAdvisorInputSchema.safeParse(minimal);
      expect(result.success).toBe(true);
    });

    it('accepts all jurisdiction values', () => {
      const jurisdictions = [
        'US',
        'US-CA',
        'US-NY',
        'UK',
        'EU',
        'EU-DE',
        'CA',
        'AU',
        'SG',
        'other',
      ];
      jurisdictions.forEach((j) => {
        const input = { ...validInput, jurisdiction: j };
        const result = LegalAdvisorInputSchema.safeParse(input);
        expect(result.success, `Failed for jurisdiction: ${j}`).toBe(true);
      });
    });

    it('accepts all contract types', () => {
      const types = [
        'employment',
        'nda',
        'service-agreement',
        'license',
        'lease',
        'sales',
        'partnership',
        'merger',
        'loan',
        'tos',
        'privacy-policy',
        'other',
      ];
      types.forEach((t) => {
        const input = { ...validInput, contractType: t };
        const result = LegalAdvisorInputSchema.safeParse(input);
        expect(result.success, `Failed for type: ${t}`).toBe(true);
      });
    });

    it('accepts optional supporting documents', () => {
      const input = {
        ...validInput,
        supportingDocuments: [
          {
            name: 'exhibit-a.pdf',
            url: 'https://example.com/exhibit-a.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 25000,
          },
        ],
      };
      const result = LegalAdvisorInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('applies default values correctly', () => {
      const minimal = {
        jurisdiction: 'US',
        contractType: 'nda',
        primaryContract: {
          name: 'nda.pdf',
          url: 'https://example.com/nda.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 50000,
        },
      };
      const result = LegalAdvisorInputSchema.parse(minimal);
      expect(result.partyRole).toBe('neutral');
      expect(result.reviewPriority).toBe('standard');
      expect(result.dealValue).toBe('not-specified');
      expect(result.compareWithStandard).toBe(true);
      expect(result.flagNonStandardTerms).toBe(true);
      expect(result.suggestNegotiationPoints).toBe(true);
    });
  });

  describe('Invalid Inputs', () => {
    it('rejects missing jurisdiction', () => {
      const { jurisdiction, ...rest } = validInput;
      const result = LegalAdvisorInputSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects invalid jurisdiction', () => {
      const input = { ...validInput, jurisdiction: 'INVALID' };
      const result = LegalAdvisorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects missing primary contract', () => {
      const { primaryContract, ...rest } = validInput;
      const result = LegalAdvisorInputSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects invalid file URL', () => {
      const input = {
        ...validInput,
        primaryContract: {
          ...validInput.primaryContract,
          url: 'not-a-valid-url',
        },
      };
      const result = LegalAdvisorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects too many supporting documents', () => {
      const input = {
        ...validInput,
        supportingDocuments: Array(11).fill({
          name: 'doc.pdf',
          url: 'https://example.com/doc.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1000,
        }),
      };
      const result = LegalAdvisorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects concerns exceeding max length', () => {
      const input = {
        ...validInput,
        specificConcerns: 'x'.repeat(2001),
      };
      const result = LegalAdvisorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

// =============================================================================
// Output Schema Tests
// =============================================================================

describe('Legal Advisor Output Schema', () => {
  describe('Valid Outputs', () => {
    it('accepts valid full output', () => {
      const result = LegalAdvisorOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('accepts minimal required fields', () => {
      const minimal = {
        executiveSummary: 'Summary',
        contractMetadata: {
          title: 'Contract',
          parties: ['A', 'B'],
        },
        riskAssessment: {
          overallRisk: 'low',
          riskScore: 20,
          keyRisks: [],
          mitigatingFactors: [],
        },
        findings: [],
        recommendations: [],
        confidence: 90,
        disclaimers: ['This is not legal advice.'],
      };
      const result = LegalAdvisorOutputSchema.safeParse(minimal);
      expect(result.success).toBe(true);
    });

    it('accepts all severity levels in findings', () => {
      const severities = ['critical', 'high', 'medium', 'low'];
      severities.forEach((s) => {
        const output = {
          ...validOutput,
          findings: [
            {
              ...validOutput.findings[0],
              severity: s,
            },
          ],
        };
        const result = LegalAdvisorOutputSchema.safeParse(output);
        expect(result.success, `Failed for severity: ${s}`).toBe(true);
      });
    });

    it('accepts all risk levels', () => {
      const levels = ['high', 'medium', 'low', 'minimal'];
      levels.forEach((l) => {
        const output = {
          ...validOutput,
          riskAssessment: {
            ...validOutput.riskAssessment,
            overallRisk: l,
          },
        };
        const result = LegalAdvisorOutputSchema.safeParse(output);
        expect(result.success, `Failed for level: ${l}`).toBe(true);
      });
    });
  });

  describe('Invalid Outputs', () => {
    it('rejects missing executive summary', () => {
      const { executiveSummary, ...rest } = validOutput;
      const result = LegalAdvisorOutputSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects invalid risk score out of range', () => {
      const output = {
        ...validOutput,
        riskAssessment: {
          ...validOutput.riskAssessment,
          riskScore: 150,
        },
      };
      const result = LegalAdvisorOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('rejects invalid severity', () => {
      const output = {
        ...validOutput,
        findings: [
          {
            ...validOutput.findings[0],
            severity: 'invalid',
          },
        ],
      };
      const result = LegalAdvisorOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('rejects confidence above 100', () => {
      const output = { ...validOutput, confidence: 101 };
      const result = LegalAdvisorOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('rejects missing disclaimers', () => {
      const { disclaimers, ...rest } = validOutput;
      const result = LegalAdvisorOutputSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });
});

// =============================================================================
// Prompt Template Tests
// =============================================================================

describe('Legal Advisor Prompt Template', () => {
  it('compiles prompt with all fields', () => {
    const prompt = compilePrompt(validInput);
    expect(prompt).toContain('US'); // Jurisdiction code
    expect(prompt).toContain('Employment Agreement'); // Contract type label
    expect(prompt).toContain('employment-agreement.pdf'); // File name
    expect(prompt).toContain('$100,000 - $1,000,000'); // Deal value label
  });

  it('includes org context when provided', () => {
    const prompt = compilePrompt(validInput, 'Our company policy requires...');
    expect(prompt).toContain('Organization Context');
    expect(prompt).toContain('Our company policy requires');
  });

  it('excludes org context section when not provided', () => {
    const prompt = compilePrompt(validInput);
    expect(prompt).not.toContain('Organization Context');
  });

  it('includes specific concerns when provided', () => {
    const input = { ...validInput, specificConcerns: 'Worried about IP clause' };
    const prompt = compilePrompt(input);
    expect(prompt).toContain('Specific Concerns');
    expect(prompt).toContain('Worried about IP clause');
  });

  it('includes JSON schema instructions', () => {
    const prompt = compilePrompt(validInput);
    expect(prompt).toContain('JSON object');
    expect(prompt).toContain('executiveSummary');
    expect(prompt).toContain('findings');
  });

  it('handles supporting documents', () => {
    const input = {
      ...validInput,
      supportingDocuments: [
        {
          name: 'exhibit-a.pdf',
          url: 'https://example.com/exhibit-a.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1000,
        },
      ],
    };
    const prompt = compilePrompt(input);
    expect(prompt).toContain('Supporting Documents');
    expect(prompt).toContain('exhibit-a.pdf');
  });
});

// =============================================================================
// Renderer Tests
// =============================================================================

describe('Legal Advisor Renderer', () => {
  it('renders full output to markdown', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('# 📜 Legal Contract Analysis');
    expect(markdown).toContain('Executive Summary');
    expect(markdown).toContain('Risk Assessment');
    expect(markdown).toContain('Findings');
    expect(markdown).toContain('Recommendations');
  });

  it('includes risk score visualization', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('45/100');
    expect(markdown).toContain('Medium Risk');
  });

  it('groups findings by severity', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('CRITICAL');
    expect(markdown).toContain('HIGH');
  });

  it('includes clause summaries when present', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('Key Clause Analysis');
    expect(markdown).toContain('Non-Compete');
    expect(markdown).toContain('Confidentiality');
  });

  it('includes compliance checks when present', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('Compliance Analysis');
    expect(markdown).toContain('California Labor Code');
  });

  it('includes negotiation strategy when present', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('Negotiation Strategy');
    expect(markdown).toContain('Priority Negotiation Points');
    expect(markdown).toContain('Deal Breakers');
  });

  it('includes key dates when present', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('Key Dates');
    expect(markdown).toContain('Employment start date');
  });

  it('includes disclaimers collapsed', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('Legal Disclaimers');
    expect(markdown).toContain('informational purposes');
  });

  it('shows contract metadata', () => {
    const markdown = renderToMarkdown(validOutput);
    expect(markdown).toContain('Contract Information');
    expect(markdown).toContain('Acme Corp');
    expect(markdown).toContain('John Doe');
    expect(markdown).toContain('State of California');
  });

  it('handles empty findings gracefully', () => {
    const output = { ...validOutput, findings: [] };
    const markdown = renderToMarkdown(output);
    expect(markdown).toContain('No significant issues identified');
  });
});

// =============================================================================
// Config Tests
// =============================================================================

describe('Legal Advisor Config', () => {
  it('has correct agent ID', () => {
    expect(LEGAL_ADVISOR_CONFIG.id).toBe('legal-advisor');
  });

  it('is marked as beta', () => {
    expect(LEGAL_ADVISOR_CONFIG.isBeta).toBe(true);
  });

  it('is not public', () => {
    expect(LEGAL_ADVISOR_CONFIG.isPublic).toBe(false);
  });

  it('supports file upload', () => {
    expect(LEGAL_ADVISOR_CONFIG.supportsFileUpload).toBe(true);
  });

  it('includes supported MIME types', () => {
    expect(LEGAL_ADVISOR_CONFIG.supportedMimeTypes).toContain('application/pdf');
    expect(LEGAL_ADVISOR_CONFIG.supportedMimeTypes).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  });

  it('has high token limits for legal documents', () => {
    expect(LEGAL_ADVISOR_CONFIG.maxInputTokens).toBeGreaterThanOrEqual(100000);
  });
});
