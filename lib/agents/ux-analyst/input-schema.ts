/**
 * UX Analyst Agent - Input Schema
 *
 * Defines the input structure for the UX Analyst agent.
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

// Main input schema
export const UxAnalystInputSchema = z.object({
  // Required fields
  productType: z
    .enum(['web-app', 'mobile-app', 'desktop-app', 'website', 'saas', 'other'])
    .describe('Type of digital product'),

  targetAudience: z
    .string()
    .min(10, 'Please describe your target audience in at least 10 characters')
    .max(500)
    .describe('Description of the target user demographic'),

  primaryUserTask: z
    .string()
    .min(10, 'Please describe the primary task in at least 10 characters')
    .max(500)
    .describe('The main task users try to accomplish'),

  // Files - at least one file required
  screenshots: z
    .array(FileInputSchema)
    .min(1, 'At least one screenshot is required')
    .max(20, 'Maximum 20 screenshots allowed')
    .describe('Screenshots or mockups to analyze'),

  // Optional fields
  additionalContext: z
    .string()
    .max(2000)
    .optional()
    .describe('Additional context or specific areas to focus on'),

  competitorUrls: z
    .array(z.string().url())
    .max(5, 'Maximum 5 competitor URLs')
    .optional()
    .describe('Competitor product URLs for comparison'),

  accessibilityLevel: z
    .enum(['wcag-a', 'wcag-aa', 'wcag-aaa', 'none'])
    .default('wcag-aa')
    .describe('Target accessibility compliance level'),

  analysisDepth: z
    .enum(['quick', 'standard', 'comprehensive'])
    .default('standard')
    .describe('Depth of analysis'),
});

export type UxAnalystInput = z.infer<typeof UxAnalystInputSchema>;

// Form field configuration for dynamic form generation
export const UxAnalystFormConfig = {
  sections: [
    {
      id: 'product-info',
      title: 'Product Information',
      fields: ['productType', 'targetAudience', 'primaryUserTask'],
    },
    {
      id: 'uploads',
      title: 'Screenshots & Mockups',
      fields: ['screenshots'],
    },
    {
      id: 'options',
      title: 'Analysis Options',
      fields: ['analysisDepth', 'accessibilityLevel', 'additionalContext'],
    },
    {
      id: 'competitors',
      title: 'Competitor Analysis (Optional)',
      fields: ['competitorUrls'],
    },
  ],
  fieldLabels: {
    productType: 'Product Type',
    targetAudience: 'Target Audience',
    primaryUserTask: 'Primary User Task',
    screenshots: 'Screenshots',
    additionalContext: 'Additional Context',
    competitorUrls: 'Competitor URLs',
    accessibilityLevel: 'Accessibility Level',
    analysisDepth: 'Analysis Depth',
  },
  fieldPlaceholders: {
    targetAudience: 'e.g., Small business owners aged 25-45 who manage remote teams',
    primaryUserTask: 'e.g., Create and send invoices to clients quickly',
    additionalContext: 'Any specific areas you want us to focus on, known issues, etc.',
  },
} as const;
