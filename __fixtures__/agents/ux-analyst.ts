/**
 * UX Analyst Mock Fixtures
 *
 * Realistic agent response fixtures for testing.
 * These mock Vertex AI/Gemini responses to avoid API costs in tests.
 *
 * @see docs/IMPEMENTATION.md - AI/LLM Mocking Policy
 */

/**
 * Sample UX analysis output matching the UxAnalystOutputSchema
 */
export const uxAnalystSuccessResponse = {
  executiveSummary:
    'This analysis identified 5 key usability opportunities across the application interface. The primary concerns center around navigation clarity and form accessibility.',
  findings: [
    {
      id: 'UX-001',
      title: 'Navigation Menu Lacks Clear Hierarchy',
      severity: 'high' as const,
      category: 'navigation',
      description:
        'The main navigation menu presents all items at the same visual weight, making it difficult for users to identify primary actions.',
      impactedUsers: 'All users, especially new visitors',
      recommendation:
        'Implement visual hierarchy using size, color, and spacing to differentiate primary from secondary navigation items.',
      wcagReference: 'WCAG 2.1 - 2.4.4 Link Purpose',
    },
    {
      id: 'UX-002',
      title: 'Form Labels Not Associated with Inputs',
      severity: 'critical' as const,
      category: 'accessibility',
      description:
        'Form fields lack proper label associations, causing screen readers to announce inputs without context.',
      impactedUsers: 'Screen reader users, keyboard navigators',
      recommendation:
        'Add htmlFor attributes to labels and id attributes to inputs. Use aria-labelledby for complex label patterns.',
      wcagReference: 'WCAG 2.1 - 1.3.1 Info and Relationships',
    },
    {
      id: 'UX-003',
      title: 'Low Contrast Text in Footer',
      severity: 'medium' as const,
      category: 'visual-design',
      description:
        'Footer links have a contrast ratio of 3.2:1, below the WCAG AA minimum of 4.5:1 for normal text.',
      impactedUsers: 'Users with low vision, users in bright environments',
      recommendation:
        'Increase text contrast to at least 4.5:1 by darkening the text or lightening the background.',
      wcagReference: 'WCAG 2.1 - 1.4.3 Contrast (Minimum)',
    },
    {
      id: 'UX-004',
      title: 'Missing Loading States',
      severity: 'medium' as const,
      category: 'feedback',
      description:
        'Asynchronous operations do not provide visual feedback, leaving users uncertain if their action was registered.',
      impactedUsers: 'All users, especially those on slow connections',
      recommendation:
        'Add loading indicators for all async operations. Consider skeleton screens for content loading.',
    },
    {
      id: 'UX-005',
      title: 'Touch Targets Too Small on Mobile',
      severity: 'low' as const,
      category: 'mobile',
      description:
        'Several interactive elements have touch targets below the recommended 44x44px minimum.',
      impactedUsers: 'Mobile users, users with motor impairments',
      recommendation:
        'Increase touch target sizes to at least 44x44px. Add padding if visual size increase is not desired.',
      wcagReference: 'WCAG 2.1 - 2.5.5 Target Size',
    },
  ],
  recommendations: [
    {
      id: 'REC-001',
      title: 'Implement Visual Hierarchy System',
      priority: 'high' as const,
      effort: 'medium' as const,
      description:
        'Create a consistent visual hierarchy system using typography, color, and spacing.',
      relatedFindings: ['UX-001'],
    },
    {
      id: 'REC-002',
      title: 'Accessibility Audit and Remediation',
      priority: 'critical' as const,
      effort: 'high' as const,
      description:
        'Conduct full accessibility audit and fix all WCAG 2.1 AA violations.',
      relatedFindings: ['UX-002', 'UX-003', 'UX-005'],
    },
    {
      id: 'REC-003',
      title: 'Add Comprehensive Loading States',
      priority: 'medium' as const,
      effort: 'low' as const,
      description:
        'Implement loading indicators and skeleton screens throughout the application.',
      relatedFindings: ['UX-004'],
    },
  ],
  overallScore: 68,
  accessibilityScore: 52,
  usabilityScore: 74,
  visualDesignScore: 78,
  metadata: {
    analysisDate: new Date().toISOString(),
    modelVersion: 'gemini-3-pro-preview',
    pagesAnalyzed: 3,
    estimatedReviewTime: '15 minutes',
  },
};

/**
 * Minimal valid response for quick tests
 */
export const uxAnalystMinimalResponse = {
  executiveSummary: 'Brief analysis completed.',
  findings: [],
  recommendations: [],
  overallScore: 85,
  accessibilityScore: 80,
  usabilityScore: 90,
  visualDesignScore: 85,
  metadata: {
    analysisDate: new Date().toISOString(),
    modelVersion: 'gemini-3-pro-preview',
    pagesAnalyzed: 1,
    estimatedReviewTime: '5 minutes',
  },
};

/**
 * Error responses for testing error handling
 */
export const uxAnalystErrorResponses = {
  rateLimitExceeded: {
    error: {
      code: 429,
      message: 'Resource exhausted. Quota exceeded for aiplatform.googleapis.com',
      status: 'RESOURCE_EXHAUSTED',
    },
  },
  contentFiltered: {
    error: {
      code: 400,
      message: 'Content was blocked due to safety filters.',
      status: 'INVALID_ARGUMENT',
    },
  },
  modelOverloaded: {
    error: {
      code: 503,
      message: 'The model is currently overloaded. Please try again later.',
      status: 'UNAVAILABLE',
    },
  },
  invalidInput: {
    error: {
      code: 400,
      message: 'Invalid input: Image format not supported.',
      status: 'INVALID_ARGUMENT',
    },
  },
};

/**
 * Token usage for cost tracking tests
 */
export const uxAnalystTokenUsage = {
  promptTokens: 1250,
  completionTokens: 850,
  totalTokens: 2100,
  estimatedCost: 0.02,
};

/**
 * Streaming response chunks for testing streaming behavior
 */
export const uxAnalystStreamingChunks = [
  '{"executive',
  'Summary": "This ',
  'analysis identified ',
  '5 key usability ',
  'opportunities..."',
];
