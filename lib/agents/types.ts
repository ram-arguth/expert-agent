/**
 * Agent Configuration Types
 * 
 * Defines the structure for agent configuration, including localization support.
 */

export interface AgentLocaleVariant {
  /** Additional context specific to this locale (e.g. "UK Regulatory Guidelines...") */
  localizedContext?: string;
  /** Optional overrides for prompts or other config */
  promptOverride?: string;
}

export interface AgentConfig {
  id: string;
  displayName: string;
  description: string;
  category: string;
  iconUrl: string;
  isBeta: boolean;
  isPublic: boolean;
  supportsGuidedInterview: boolean;
  supportsFileUpload: boolean;
  supportsStreaming: boolean;
  /**
   * Locale-specific overrides and context.
   * Key is the locale code (e.g., 'en-GB', 'ja-JP').
   */
  localeVariants?: Record<string, AgentLocaleVariant>;
  /**
   * List of allowed organization IDs for beta/private agents.
   */
  allowedOrgIds?: string[];
}
