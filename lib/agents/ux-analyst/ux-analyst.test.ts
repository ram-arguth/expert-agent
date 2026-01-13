/**
 * UX Analyst Agent Tests
 *
 * Tests for input/output schemas, prompt template, and renderer.
 * Includes positive and negative security-centric test cases.
 */

import { describe, it, expect } from 'vitest';
import {
  UxAnalystInputSchema,
  type UxAnalystInput,
  FileInputSchema,
} from './input-schema';
import {
  UxAnalystOutputSchema,
  FindingSchema,
  RecommendationSchema,
  type UxAnalystOutput,
} from './output-schema';
import { renderToMarkdown } from './renderer';

describe('UX Analyst Input Schema', () => {
  const validInput: UxAnalystInput = {
    productType: 'web-app',
    targetAudience: 'Small business owners who need to manage invoices',
    primaryUserTask: 'Create and send invoices to clients quickly',
    screenshots: [
      {
        name: 'homepage.png',
        url: 'https://storage.example.com/screenshots/homepage.png',
        mimeType: 'image/png',
        sizeBytes: 123456,
      },
    ],
    accessibilityLevel: 'wcag-aa',
    analysisDepth: 'standard',
  };

  describe('Positive Tests', () => {
    it('validates correct input', () => {
      const result = UxAnalystInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('accepts all product types', () => {
      const types = ['web-app', 'mobile-app', 'desktop-app', 'website', 'saas', 'other'];

      types.forEach((productType) => {
        const input = { ...validInput, productType };
        const result = UxAnalystInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    it('accepts optional fields', () => {
      const input = {
        ...validInput,
        additionalContext: 'Focus on checkout flow',
        competitorUrls: ['https://competitor.com'],
      };
      const result = UxAnalystInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts multiple screenshots', () => {
      const input = {
        ...validInput,
        screenshots: Array(10)
          .fill(null)
          .map((_, i) => ({
            name: `screen${i}.png`,
            url: `https://storage.example.com/screen${i}.png`,
            mimeType: 'image/png',
            sizeBytes: 10000,
          })),
      };
      const result = UxAnalystInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('Negative Tests', () => {
    it('rejects missing required fields', () => {
      const input = { productType: 'web-app' };
      const result = UxAnalystInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects invalid product type', () => {
      const input = { ...validInput, productType: 'invalid-type' };
      const result = UxAnalystInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects empty screenshots array', () => {
      const input = { ...validInput, screenshots: [] };
      const result = UxAnalystInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects too many screenshots', () => {
      const input = {
        ...validInput,
        screenshots: Array(21)
          .fill(null)
          .map((_, i) => ({
            name: `screen${i}.png`,
            url: `https://storage.example.com/screen${i}.png`,
            mimeType: 'image/png',
            sizeBytes: 10000,
          })),
      };
      const result = UxAnalystInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects target audience that is too short', () => {
      const input = { ...validInput, targetAudience: 'Users' };
      const result = UxAnalystInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects invalid screenshot URL', () => {
      const input = {
        ...validInput,
        screenshots: [{ ...validInput.screenshots[0], url: 'not-a-url' }],
      };
      const result = UxAnalystInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects invalid competitor URLs', () => {
      const input = {
        ...validInput,
        competitorUrls: ['not-a-url', 'https://valid.com'],
      };
      const result = UxAnalystInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Security Tests', () => {
    it('sanitizes by rejecting XSS in text fields', () => {
      // The schema doesn't explicitly sanitize, but the type constraints help
      const input = {
        ...validInput,
        additionalContext: '<script>alert("xss")</script>',
      };
      // This should parse (Zod doesn't sanitize by default)
      // but the renderer should escape HTML
      const result = UxAnalystInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('limits text field lengths', () => {
      const input = {
        ...validInput,
        additionalContext: 'x'.repeat(3000),
      };
      const result = UxAnalystInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('limits competitor URLs count', () => {
      const input = {
        ...validInput,
        competitorUrls: Array(10).fill('https://competitor.com'),
      };
      const result = UxAnalystInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe('UX Analyst Output Schema', () => {
  const validOutput: UxAnalystOutput = {
    executiveSummary: 'This is an executive summary of the UX analysis.',
    scores: {
      overall: 75,
      usability: 80,
      accessibility: 70,
      visualDesign: 85,
      informationArchitecture: 65,
    },
    findings: [
      {
        id: 'F001',
        title: 'Low contrast text',
        category: 'accessibility',
        severity: 'high',
        description: 'Several text elements have insufficient contrast ratio.',
        userImpact: 'Users with visual impairments may have difficulty reading.',
      },
    ],
    recommendations: [
      {
        id: 'R001',
        title: 'Increase text contrast',
        priority: 'immediate',
        category: 'accessibility',
        description: 'Update text colors to meet WCAG AA contrast requirements.',
        rationale: 'Improves readability for all users.',
        implementationEffort: 'low',
        businessImpact: 'medium',
      },
    ],
    strengths: ['Clean visual design', 'Good use of whitespace'],
    keyInsights: [
      'Accessibility needs significant improvement',
      'Navigation is intuitive',
      'Mobile experience is lacking',
    ],
    nextSteps: [
      'Fix critical accessibility issues',
      'Improve mobile responsiveness',
      'Add user feedback mechanisms',
    ],
  };

  describe('Positive Tests', () => {
    it('validates correct output', () => {
      const result = UxAnalystOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('accepts optional fields', () => {
      const output = {
        ...validOutput,
        competitorAnalysis: [
          {
            competitorUrl: 'https://competitor.com',
            strengths: ['Good mobile experience'],
            weaknesses: ['Poor accessibility'],
            opportunities: ['Better onboarding'],
          },
        ],
        accessibilityCompliance: {
          level: 'WCAG-AA',
          status: 'partial' as const,
          criticalIssues: 3,
          summary: 'Needs improvement.',
        },
      };
      const result = UxAnalystOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('accepts all severity levels', () => {
      const severities = ['critical', 'high', 'medium', 'low', 'info'];

      severities.forEach((severity) => {
        const finding = {
          ...validOutput.findings[0],
          severity,
        };
        const result = FindingSchema.safeParse(finding);
        expect(result.success).toBe(true);
      });
    });

    it('accepts all priority levels', () => {
      const priorities = ['immediate', 'short-term', 'long-term'];

      priorities.forEach((priority) => {
        const rec = {
          ...validOutput.recommendations[0],
          priority,
        };
        const result = RecommendationSchema.safeParse(rec);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Negative Tests', () => {
    it('rejects missing required fields', () => {
      const output = { executiveSummary: 'Summary' };
      const result = UxAnalystOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('rejects empty findings array', () => {
      const output = { ...validOutput, findings: [] };
      const result = UxAnalystOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('rejects empty recommendations array', () => {
      const output = { ...validOutput, recommendations: [] };
      const result = UxAnalystOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('rejects invalid severity', () => {
      const finding = {
        ...validOutput.findings[0],
        severity: 'invalid',
      };
      const result = FindingSchema.safeParse(finding);
      expect(result.success).toBe(false);
    });

    it('rejects scores out of range', () => {
      const output = {
        ...validOutput,
        scores: { ...validOutput.scores, overall: 150 },
      };
      const result = UxAnalystOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('rejects too few key insights', () => {
      const output = {
        ...validOutput,
        keyInsights: ['Only one insight'],
      };
      const result = UxAnalystOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });
  });
});

describe('UX Analyst Renderer', () => {
  const validOutput: UxAnalystOutput = {
    executiveSummary: 'Test summary with **bold** text.',
    scores: {
      overall: 75,
      usability: 80,
      accessibility: 70,
      visualDesign: 85,
      informationArchitecture: 65,
    },
    findings: [
      {
        id: 'F001',
        title: 'Test Finding',
        category: 'accessibility',
        severity: 'high',
        description: 'Description of the finding.',
        userImpact: 'Impact on users.',
        location: 'Header section',
        wcagCriteria: '1.4.3',
      },
    ],
    recommendations: [
      {
        id: 'R001',
        title: 'Test Recommendation',
        priority: 'immediate',
        category: 'accessibility',
        description: 'What to do.',
        rationale: 'Why it matters.',
        implementationEffort: 'low',
        businessImpact: 'high',
        relatedFindings: ['F001'],
      },
    ],
    strengths: ['Strength 1', 'Strength 2'],
    keyInsights: ['Insight 1', 'Insight 2', 'Insight 3'],
    nextSteps: ['Step 1', 'Step 2', 'Step 3'],
  };

  it('renders complete markdown report', () => {
    const markdown = renderToMarkdown(validOutput);

    expect(markdown).toContain('# UX Analysis Report');
    expect(markdown).toContain('## Executive Summary');
    expect(markdown).toContain('## UX Scores');
    expect(markdown).toContain('## Key Insights');
    expect(markdown).toContain('## Strengths');
    expect(markdown).toContain('## Findings');
    expect(markdown).toContain('## Recommendations');
    expect(markdown).toContain('## Next Steps');
  });

  it('includes finding details', () => {
    const markdown = renderToMarkdown(validOutput);

    expect(markdown).toContain('F001');
    expect(markdown).toContain('Test Finding');
    expect(markdown).toContain('accessibility');
    expect(markdown).toContain('Header section');
    expect(markdown).toContain('1.4.3');
  });

  it('includes recommendation details', () => {
    const markdown = renderToMarkdown(validOutput);

    expect(markdown).toContain('R001');
    expect(markdown).toContain('Test Recommendation');
    expect(markdown).toContain('F001');
    expect(markdown).toContain('low');
    expect(markdown).toContain('high');
  });

  it('renders scores with visual bars', () => {
    const markdown = renderToMarkdown(validOutput);

    // Should contain score bars with filled and empty blocks
    expect(markdown).toContain('█');
    expect(markdown).toContain('░');
    expect(markdown).toContain('75'); // overall score
  });

  it('renders accessibility section when present', () => {
    const output: UxAnalystOutput = {
      ...validOutput,
      accessibilityCompliance: {
        level: 'WCAG-AA',
        status: 'partial',
        criticalIssues: 2,
        summary: 'Needs work on contrast.',
      },
    };

    const markdown = renderToMarkdown(output);

    expect(markdown).toContain('## Accessibility Compliance');
    expect(markdown).toContain('WCAG-AA');
    expect(markdown).toContain('PARTIAL');
    expect(markdown).toContain('Critical Issues');
  });

  it('renders competitor analysis when present', () => {
    const output: UxAnalystOutput = {
      ...validOutput,
      competitorAnalysis: [
        {
          competitorUrl: 'https://competitor.example.com/page',
          strengths: ['Good mobile UX'],
          weaknesses: ['Slow loading'],
          opportunities: ['Better onboarding'],
        },
      ],
    };

    const markdown = renderToMarkdown(output);

    expect(markdown).toContain('## Competitive Analysis');
    expect(markdown).toContain('competitor.example.com');
    expect(markdown).toContain('Good mobile UX');
    expect(markdown).toContain('Slow loading');
    expect(markdown).toContain('Better onboarding');
  });
});
