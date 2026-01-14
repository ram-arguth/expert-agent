/**
 * Legal Advisor Agent - Main Export
 *
 * Exports all Legal Advisor agent components for use in the application.
 */

// Input schema
export {
  LegalAdvisorInputSchema,
  type LegalAdvisorInput,
  FileInputSchema,
  type FileInput,
  JurisdictionSchema,
  type Jurisdiction,
  ContractTypeSchema,
  type ContractType,
  ReviewPrioritySchema,
  type ReviewPriority,
  LegalAdvisorFormConfig,
} from './input-schema';

// Output schema
export {
  LegalAdvisorOutputSchema,
  type LegalAdvisorOutput,
  FindingSchema,
  type Finding,
  RecommendationSchema,
  type Recommendation,
  SeveritySchema,
  type Severity,
  PrioritySchema,
  type Priority,
  RiskLevelSchema,
  type RiskLevel,
  RiskAssessmentSchema,
  type RiskAssessment,
  ClauseSummarySchema,
  type ClauseSummary,
  ComplianceCheckSchema,
  type ComplianceCheck,
} from './output-schema';

// Prompt template
export {
  LEGAL_ADVISOR_PROMPT_TEMPLATE,
  compilePrompt,
  validateOutput,
} from './prompt-template';

// Renderer
export { renderToMarkdown } from './renderer';

// Agent configuration
export const LEGAL_ADVISOR_CONFIG = {
  id: 'legal-advisor',
  displayName: 'Legal Advisor',
  description:
    'Expert contract analysis and legal document review. Get actionable insights on risks, terms, and negotiation strategies.',
  category: 'legal',
  iconUrl: '/icons/agents/legal-advisor.svg',
  isBeta: true, // Currently in beta
  isPublic: false, // Requires beta access
  supportsGuidedInterview: true,
  supportsFileUpload: true,
  supportsStreaming: true,
  // Supported document types
  supportedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  // Token limits
  maxInputTokens: 100000, // Legal documents can be lengthy
  maxOutputTokens: 16000,
  // Jurisdictions supported
  supportedJurisdictions: [
    'US',
    'US-CA',
    'US-NY',
    'US-TX',
    'US-DE',
    'UK',
    'EU',
    'EU-DE',
    'EU-FR',
    'CA',
    'AU',
    'SG',
  ],
} as const;
