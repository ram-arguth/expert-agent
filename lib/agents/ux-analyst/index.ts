/**
 * UX Analyst Agent - Main Export
 *
 * Exports all UX Analyst agent components for use in the application.
 */

// Input schema
export {
  UxAnalystInputSchema,
  type UxAnalystInput,
  FileInputSchema,
  type FileInput,
  UxAnalystFormConfig,
} from './input-schema';

// Output schema
export {
  UxAnalystOutputSchema,
  type UxAnalystOutput,
  FindingSchema,
  type Finding,
  RecommendationSchema,
  type Recommendation,
  SeveritySchema,
  type Severity,
  PrioritySchema,
  type Priority,
  UxCategorySchema,
  type UxCategory,
  ScoresSchema,
  type Scores,
  CompetitorInsightSchema,
  type CompetitorInsight,
} from './output-schema';

// Prompt template
export { UX_ANALYST_PROMPT_TEMPLATE, compilePrompt } from './prompt-template';

// Renderer
export { renderToMarkdown } from './renderer';

// Agent configuration
export const UX_ANALYST_CONFIG = {
  id: 'ux-analyst',
  displayName: 'UX Analyst',
  description:
    'Expert UX analysis of your digital product. Get actionable insights on usability, accessibility, and visual design.',
  category: 'design',
  iconUrl: '/icons/agents/ux-analyst.svg',
  isBeta: false,
  isPublic: true,
  supportsGuidedInterview: true,
  supportsFileUpload: true,
  supportsStreaming: true,
} as const;
