/**
 * Legal Advisor Agent - Input Schema
 *
 * Defines the input structure for the Legal Advisor agent.
 * Used for form generation and validation.
 *
 * @see docs/DESIGN.md - Agent Schema Pattern
 */

import { z } from 'zod';

// File input schema (for form generation)
export const FileInputSchema = z.object({
  name: z.string().min(1, 'File name is required'),
  url: z.string().url('Valid URL is required'),
  mimeType: z.string(),
  sizeBytes: z.number().positive(),
});

export type FileInput = z.infer<typeof FileInputSchema>;

// Jurisdiction enum
export const JurisdictionSchema = z.enum([
  'US', // United States
  'US-CA', // California
  'US-NY', // New York
  'US-TX', // Texas
  'US-DE', // Delaware (corporate)
  'UK', // United Kingdom
  'EU', // European Union
  'EU-DE', // Germany
  'EU-FR', // France
  'CA', // Canada
  'AU', // Australia
  'SG', // Singapore
  'other',
]);

export type Jurisdiction = z.infer<typeof JurisdictionSchema>;

// Contract type enum
export const ContractTypeSchema = z.enum([
  'employment', // Employment/labor contracts
  'nda', // Non-disclosure agreements
  'service-agreement', // Service/consulting agreements
  'license', // Software/IP licensing
  'lease', // Property/equipment lease
  'sales', // Sales/purchase agreements
  'partnership', // Partnership agreements
  'merger', // M&A documents
  'loan', // Loan/credit agreements
  'tos', // Terms of service
  'privacy-policy', // Privacy policies
  'other',
]);

export type ContractType = z.infer<typeof ContractTypeSchema>;

// Review priority enum
export const ReviewPrioritySchema = z.enum([
  'express', // 24-hour urgent
  'standard', // 3-5 business days
  'comprehensive', // Deep analysis, 5-7 days
]);

export type ReviewPriority = z.infer<typeof ReviewPrioritySchema>;

// Main input schema
export const LegalAdvisorInputSchema = z.object({
  // Required fields
  jurisdiction: JurisdictionSchema.describe(
    'Legal jurisdiction governing the contract'
  ),

  contractType: ContractTypeSchema.describe('Type of contract or document'),

  primaryContract: FileInputSchema.describe('Main contract document (PDF, DOCX)'),

  // Optional fields
  supportingDocuments: z
    .array(FileInputSchema)
    .max(10, 'Maximum 10 supporting documents')
    .optional()
    .describe('Supporting documents, amendments, or exhibits'),

  partyRole: z
    .enum(['party-a', 'party-b', 'neutral'])
    .default('neutral')
    .describe('Your role in the contract (determines perspective of analysis)'),

  specificConcerns: z
    .string()
    .max(2000)
    .optional()
    .describe('Specific areas of concern or questions'),

  dealValue: z
    .enum(['under-10k', '10k-100k', '100k-1m', 'over-1m', 'not-specified'])
    .default('not-specified')
    .describe('Approximate value of the deal (affects risk assessment)'),

  reviewPriority: ReviewPrioritySchema.default('standard').describe(
    'Priority level for the review'
  ),

  compareWithStandard: z
    .boolean()
    .default(true)
    .describe('Compare against standard contract templates'),

  flagNonStandardTerms: z
    .boolean()
    .default(true)
    .describe('Highlight unusual or non-standard terms'),

  suggestNegotiationPoints: z
    .boolean()
    .default(true)
    .describe('Suggest points for negotiation'),
});

export type LegalAdvisorInput = z.infer<typeof LegalAdvisorInputSchema>;

// Form field configuration for dynamic form generation
export const LegalAdvisorFormConfig = {
  sections: [
    {
      id: 'contract-info',
      title: 'Contract Information',
      fields: ['jurisdiction', 'contractType', 'partyRole'],
    },
    {
      id: 'documents',
      title: 'Contract Documents',
      fields: ['primaryContract', 'supportingDocuments'],
    },
    {
      id: 'review-options',
      title: 'Review Options',
      fields: [
        'dealValue',
        'reviewPriority',
        'compareWithStandard',
        'flagNonStandardTerms',
        'suggestNegotiationPoints',
      ],
    },
    {
      id: 'concerns',
      title: 'Specific Concerns (Optional)',
      fields: ['specificConcerns'],
    },
  ],
  fieldLabels: {
    jurisdiction: 'Jurisdiction',
    contractType: 'Contract Type',
    primaryContract: 'Primary Contract',
    supportingDocuments: 'Supporting Documents',
    partyRole: 'Your Role',
    specificConcerns: 'Specific Concerns',
    dealValue: 'Deal Value',
    reviewPriority: 'Review Priority',
    compareWithStandard: 'Compare with Standard Templates',
    flagNonStandardTerms: 'Flag Non-Standard Terms',
    suggestNegotiationPoints: 'Suggest Negotiation Points',
  },
  fieldPlaceholders: {
    specificConcerns:
      'e.g., Concerned about IP assignment clause, termination penalties, non-compete scope',
  },
  jurisdictionLabels: {
    US: 'United States (Federal)',
    'US-CA': 'United States - California',
    'US-NY': 'United States - New York',
    'US-TX': 'United States - Texas',
    'US-DE': 'United States - Delaware',
    UK: 'United Kingdom',
    EU: 'European Union',
    'EU-DE': 'Germany',
    'EU-FR': 'France',
    CA: 'Canada',
    AU: 'Australia',
    SG: 'Singapore',
    other: 'Other Jurisdiction',
  },
  contractTypeLabels: {
    employment: 'Employment Agreement',
    nda: 'Non-Disclosure Agreement (NDA)',
    'service-agreement': 'Service/Consulting Agreement',
    license: 'License Agreement',
    lease: 'Lease Agreement',
    sales: 'Sales/Purchase Agreement',
    partnership: 'Partnership Agreement',
    merger: 'M&A Documents',
    loan: 'Loan Agreement',
    tos: 'Terms of Service',
    'privacy-policy': 'Privacy Policy',
    other: 'Other Document Type',
  },
} as const;
