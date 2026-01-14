/**
 * PII Detection and Compliance Guardrails
 *
 * Configurable layer to detect and flag sensitive personal information (PII)
 * in inputs and outputs based on organization policy.
 *
 * Features:
 * - Pattern-based PII detection (SSN, credit card, email, phone, etc.)
 * - Configurable severity levels and policies per org
 * - Support for flagging vs blocking modes
 * - Audit logging for compliance
 *
 * @see docs/DESIGN.md - Compliance Guardrails
 * @see docs/IMPLEMENTATION.md - Phase 0.6 Security
 */

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Types of PII that can be detected
 */
export type PIIType =
  | 'ssn'           // Social Security Number (US)
  | 'credit_card'   // Credit/Debit card numbers
  | 'email'         // Email addresses
  | 'phone'         // Phone numbers
  | 'ip_address'    // IP addresses
  | 'passport'      // Passport numbers
  | 'drivers_license' // Driver's license numbers
  | 'bank_account'  // Bank account numbers
  | 'date_of_birth' // Dates of birth
  | 'medical_id'    // Medical record numbers
  | 'address';      // Physical addresses

/**
 * Severity level for PII detection
 */
export type PIISeverity = 'info' | 'warning' | 'critical';

/**
 * Action to take when PII is detected
 */
export type PIIAction = 'log' | 'flag' | 'block' | 'redact';

/**
 * A detected PII instance
 */
export interface PIIMatch {
  /** Type of PII detected */
  type: PIIType;
  /** The matched value (may be partially redacted for logging) */
  match: string;
  /** Start position in text */
  startIndex: number;
  /** End position in text */
  endIndex: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Severity based on policy */
  severity: PIISeverity;
}

/**
 * Policy configuration for PII handling
 */
export interface PIIPolicy {
  /** PII types to detect */
  enabledTypes: PIIType[];
  /** Action to take per severity level */
  actions: Record<PIISeverity, PIIAction>;
  /** Whether to log all detections */
  auditLog: boolean;
  /** Custom patterns per org (optional) */
  customPatterns?: Array<{
    name: string;
    pattern: RegExp;
    type: PIIType;
    severity: PIISeverity;
  }>;
}

/**
 * Result of PII detection scan
 */
export interface PIIDetectionResult {
  /** Whether any PII was found */
  hasPII: boolean;
  /** Whether the content should be blocked based on policy */
  shouldBlock: boolean;
  /** All detected PII instances */
  matches: PIIMatch[];
  /** Summary by type */
  summary: Partial<Record<PIIType, number>>;
  /** Highest severity found */
  maxSeverity: PIISeverity | 'none';
  /** Redacted content (if redaction is enabled) */
  redactedContent?: string;
}

/**
 * Audit log entry for PII detection
 */
export interface PIIAuditEntry {
  timestamp: string;
  userId?: string;
  orgId?: string;
  agentId?: string;
  direction: 'input' | 'output';
  piiTypes: PIIType[];
  count: number;
  maxSeverity: PIISeverity;
  action: PIIAction;
  /** Content hash for correlation without storing actual content */
  contentHash?: string;
}

// =============================================================================
// PII Detection Patterns
// =============================================================================

/**
 * Regex patterns for PII detection
 * Each pattern includes validation logic to reduce false positives
 */
const PII_PATTERNS: Record<PIIType, {
  pattern: RegExp;
  severity: PIISeverity;
  validate?: (match: string) => boolean;
  description: string;
}> = {
  ssn: {
    pattern: /\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/g,
    severity: 'critical',
    validate: (match) => {
      // Basic Luhn-like validation for SSN format
      const digits = match.replace(/[-\s]/g, '');
      return digits.length === 9 && !/^(?:000|666|9\d{2})/.test(digits);
    },
    description: 'US Social Security Number',
  },

  credit_card: {
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12}|3(?:0[0-5]|[68][0-9])[0-9]{11})\b/g,
    severity: 'critical',
    validate: (match) => {
      // Luhn algorithm validation
      const digits = match.replace(/\D/g, '');
      if (digits.length < 13 || digits.length > 19) return false;
      
      let sum = 0;
      let isEven = false;
      for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits[i], 10);
        if (isEven) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
        isEven = !isEven;
      }
      return sum % 10 === 0;
    },
    description: 'Credit/Debit Card Number',
  },

  email: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    severity: 'warning',
    description: 'Email Address',
  },

  phone: {
    pattern: /\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    severity: 'warning',
    validate: (match) => {
      // Filter out common false positives (dates, sequential numbers)
      const digits = match.replace(/\D/g, '');
      if (digits.length < 10) return false;
      // Reject obviously fake patterns
      if (/^(\d)\1+$/.test(digits)) return false;
      return true;
    },
    description: 'Phone Number',
  },

  ip_address: {
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    severity: 'info',
    validate: (match) => {
      // Exclude common non-identifying IPs
      const commonIPs = ['0.0.0.0', '127.0.0.1', '255.255.255.255', '192.168.', '10.', '172.'];
      return !commonIPs.some(ip => match.startsWith(ip));
    },
    description: 'IP Address',
  },

  passport: {
    pattern: /\b[A-Z]{1,2}\d{6,9}\b/g,
    severity: 'critical',
    validate: (match) => {
      // Very basic validation - most passports are letter(s) + 6-9 digits
      return /^[A-Z]{1,2}\d{6,9}$/.test(match);
    },
    description: 'Passport Number',
  },

  drivers_license: {
    // Very broad pattern - actual format varies by state/country
    pattern: /\b[A-Z]\d{7,8}\b|\b\d{7,9}\b/g,
    severity: 'critical',
    validate: (match) => {
      // Must be in valid length range
      const alphanumLength = match.replace(/\D/g, '').length;
      return alphanumLength >= 7 && alphanumLength <= 9;
    },
    description: "Driver's License Number",
  },

  bank_account: {
    pattern: /\b\d{8,17}\b/g,
    severity: 'critical',
    validate: (match) => {
      // Bank accounts typically 8-17 digits
      // Exclude common false positives
      const digits = match.replace(/\D/g, '');
      if (digits.length < 8 || digits.length > 17) return false;
      // Exclude sequential or repetitive numbers
      if (/^(\d)\1+$/.test(digits)) return false;
      if (/^(0123456789|9876543210)/.test(digits)) return false;
      return true;
    },
    description: 'Bank Account Number',
  },

  date_of_birth: {
    pattern: /\b(?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12][0-9]|3[01])[-/](?:19|20)\d{2}\b|\b(?:19|20)\d{2}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12][0-9]|3[01])\b/g,
    severity: 'warning',
    description: 'Date of Birth',
  },

  medical_id: {
    pattern: /\bMRN[-:\s]?\d{6,12}\b/gi,
    severity: 'critical',
    description: 'Medical Record Number',
  },

  address: {
    pattern: /\b\d{1,5}\s+\w+(?:\s+\w+)?\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Circle|Cir|Place|Pl)\.?\b/gi,
    severity: 'warning',
    description: 'Physical Address',
  },
};

// =============================================================================
// Default Policy
// =============================================================================

/**
 * Default PII policy - detect common PII, warn on detection
 */
export const DEFAULT_PII_POLICY: PIIPolicy = {
  enabledTypes: [
    'ssn',
    'credit_card',
    'email',
    'phone',
    'passport',
    'bank_account',
    'medical_id',
  ],
  actions: {
    info: 'log',
    warning: 'flag',
    critical: 'block',
  },
  auditLog: true,
};

/**
 * Strict PII policy - block all PII
 */
export const STRICT_PII_POLICY: PIIPolicy = {
  enabledTypes: Object.keys(PII_PATTERNS) as PIIType[],
  actions: {
    info: 'flag',
    warning: 'block',
    critical: 'block',
  },
  auditLog: true,
};

/**
 * Lenient PII policy - log only, no blocking
 */
export const LENIENT_PII_POLICY: PIIPolicy = {
  enabledTypes: ['ssn', 'credit_card', 'bank_account'],
  actions: {
    info: 'log',
    warning: 'log',
    critical: 'flag',
  },
  auditLog: true,
};

// =============================================================================
// PII Detection Functions
// =============================================================================

/**
 * Scan text for PII matches
 */
export function scanForPII(
  text: string,
  policy: PIIPolicy = DEFAULT_PII_POLICY
): PIIDetectionResult {
  const allMatches: PIIMatch[] = [];
  let maxSeverity: PIISeverity | 'none' = 'none';
  let shouldBlock = false;

  // Prioritized order - more specific patterns first
  const prioritizedTypes: PIIType[] = [
    'medical_id',   // Has prefix marker (MRN), most specific
    'credit_card',  // More specific than bank_account (Luhn validated)
    'ssn',          // Specific 9-digit format
    'passport',     // Letter + digits
    'drivers_license',
    'email',
    'phone',
    'ip_address',
    'date_of_birth',
    'address',
    'bank_account', // Most generic, check last
  ];

  // Filter to only enabled types, maintaining priority order
  const orderedTypes = prioritizedTypes.filter(t => policy.enabledTypes.includes(t));

  // Scan with built-in patterns in priority order
  for (const piiType of orderedTypes) {
    const config = PII_PATTERNS[piiType];
    if (!config) continue;

    // Reset regex lastIndex
    config.pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = config.pattern.exec(text)) !== null) {
      const matchValue = match[0];
      const startIndex = match.index;
      const endIndex = match.index + matchValue.length;

      // Run validation if available
      if (config.validate && !config.validate(matchValue)) {
        continue;
      }

      // Check if this position is already covered by a higher-priority match
      const alreadyCovered = allMatches.some(existing =>
        (startIndex >= existing.startIndex && startIndex < existing.endIndex) ||
        (endIndex > existing.startIndex && endIndex <= existing.endIndex) ||
        (startIndex <= existing.startIndex && endIndex >= existing.endIndex)
      );

      if (alreadyCovered) {
        continue; // Skip - already matched by a more specific type
      }

      // Calculate confidence based on pattern specificity
      const confidence = config.validate ? 0.9 : 0.7;

      allMatches.push({
        type: piiType,
        match: redactMatch(matchValue),
        startIndex,
        endIndex,
        confidence,
        severity: config.severity,
      });

      // Update max severity
      if (maxSeverity === 'none' || severityRank(config.severity) > severityRank(maxSeverity)) {
        maxSeverity = config.severity;
      }

      // Check if should block
      if (policy.actions[config.severity] === 'block') {
        shouldBlock = true;
      }
    }
  }

  // Scan with custom patterns if provided
  if (policy.customPatterns) {
    for (const custom of policy.customPatterns) {
      custom.pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = custom.pattern.exec(text)) !== null) {
        const startIndex = match.index;
        const endIndex = match.index + match[0].length;

        // Check overlap with existing matches
        const alreadyCovered = allMatches.some(existing =>
          (startIndex >= existing.startIndex && startIndex < existing.endIndex) ||
          (endIndex > existing.startIndex && endIndex <= existing.endIndex)
        );

        if (alreadyCovered) continue;

        allMatches.push({
          type: custom.type,
          match: redactMatch(match[0]),
          startIndex,
          endIndex,
          confidence: 0.8,
          severity: custom.severity,
        });

        if (maxSeverity === 'none' || severityRank(custom.severity) > severityRank(maxSeverity)) {
          maxSeverity = custom.severity;
        }

        if (policy.actions[custom.severity] === 'block') {
          shouldBlock = true;
        }
      }
    }
  }

  // Sort matches by position
  allMatches.sort((a, b) => a.startIndex - b.startIndex);

  // Build summary
  const summary: Partial<Record<PIIType, number>> = {};
  for (const m of allMatches) {
    summary[m.type] = (summary[m.type] || 0) + 1;
  }

  const result: PIIDetectionResult = {
    hasPII: allMatches.length > 0,
    shouldBlock,
    matches: allMatches,
    summary,
    maxSeverity,
  };

  // Generate redacted content if redaction is enabled
  const needsRedaction = Object.values(policy.actions).some(a => a === 'redact');
  if (needsRedaction && allMatches.length > 0) {
    result.redactedContent = redactContent(text, allMatches);
  }

  return result;
}

/**
 * Check if text contains any PII (quick check)
 */
export function containsPII(
  text: string,
  policy: PIIPolicy = DEFAULT_PII_POLICY
): boolean {
  for (const piiType of policy.enabledTypes) {
    const config = PII_PATTERNS[piiType];
    if (!config) continue;

    config.pattern.lastIndex = 0;
    const match = config.pattern.exec(text);
    
    if (match) {
      if (!config.validate || config.validate(match[0])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Redact PII from content
 */
export function redactPII(
  text: string,
  policy: PIIPolicy = DEFAULT_PII_POLICY
): string {
  const result = scanForPII(text, policy);
  if (!result.hasPII) return text;
  return redactContent(text, result.matches);
}

// =============================================================================
// Audit Logging
// =============================================================================

// In-memory audit log for testing (production uses Cloud Logging)
const auditLog: PIIAuditEntry[] = [];

/**
 * Log a PII detection event for compliance audit
 */
export function logPIIDetection(
  result: PIIDetectionResult,
  context: {
    userId?: string;
    orgId?: string;
    agentId?: string;
    direction: 'input' | 'output';
    action: PIIAction;
  }
): void {
  if (!result.hasPII) return;

  const entry: PIIAuditEntry = {
    timestamp: new Date().toISOString(),
    userId: context.userId,
    orgId: context.orgId,
    agentId: context.agentId,
    direction: context.direction,
    piiTypes: [...new Set(result.matches.map(m => m.type))],
    count: result.matches.length,
    maxSeverity: result.maxSeverity === 'none' ? 'info' : result.maxSeverity,
    action: context.action,
  };

  // Log to console (Cloud Logging in production)
  console.log('[PII_AUDIT]', JSON.stringify(entry));

  // Store in memory for testing
  auditLog.push(entry);
}

/**
 * Get audit log entries (for testing)
 */
export function getAuditLog(): PIIAuditEntry[] {
  return [...auditLog];
}

/**
 * Clear audit log (for testing)
 */
export function clearAuditLog(): void {
  auditLog.length = 0;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get numeric rank for severity comparison
 */
function severityRank(severity: PIISeverity): number {
  switch (severity) {
    case 'info': return 1;
    case 'warning': return 2;
    case 'critical': return 3;
    default: return 0;
  }
}

/**
 * Partially redact a matched value for logging
 * Shows first and last few characters
 */
function redactMatch(value: string): string {
  if (value.length <= 4) return '****';
  if (value.length <= 8) return value.slice(0, 2) + '****' + value.slice(-2);
  return value.slice(0, 3) + '****' + value.slice(-3);
}

/**
 * Redact content by replacing PII matches with placeholders
 */
function redactContent(text: string, matches: PIIMatch[]): string {
  // Sort matches by position descending to replace from end first
  const sortedMatches = [...matches].sort((a, b) => b.startIndex - a.startIndex);

  let result = text;
  for (const match of sortedMatches) {
    const placeholder = `[${match.type.toUpperCase()}_REDACTED]`;
    result = result.slice(0, match.startIndex) + placeholder + result.slice(match.endIndex);
  }

  return result;
}

/**
 * Generate a simple hash for content (for audit correlation)
 */
export function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// =============================================================================
// Guard Functions for Query Pipeline
// =============================================================================

/**
 * Guard input for PII (used in query pipeline)
 */
export async function guardInputForPII(
  input: string,
  options: {
    userId?: string;
    orgId?: string;
    agentId?: string;
    policy?: PIIPolicy;
  } = {}
): Promise<{
  allowed: boolean;
  result: PIIDetectionResult;
  userMessage?: string;
}> {
  const policy = options.policy || DEFAULT_PII_POLICY;
  const result = scanForPII(input, policy);

  if (result.hasPII) {
    logPIIDetection(result, {
      userId: options.userId,
      orgId: options.orgId,
      agentId: options.agentId,
      direction: 'input',
      action: result.shouldBlock ? 'block' : 'flag',
    });
  }

  if (result.shouldBlock) {
    return {
      allowed: false,
      result,
      userMessage: 'Your request contains sensitive personal information that cannot be processed. Please remove any SSN, credit card numbers, or other sensitive data.',
    };
  }

  return {
    allowed: true,
    result,
  };
}

/**
 * Guard output for PII (used in query pipeline)
 */
export async function guardOutputForPII(
  output: string,
  options: {
    userId?: string;
    orgId?: string;
    agentId?: string;
    policy?: PIIPolicy;
  } = {}
): Promise<{
  output: string;
  result: PIIDetectionResult;
  wasModified: boolean;
}> {
  const policy = options.policy || {
    ...DEFAULT_PII_POLICY,
    actions: {
      info: 'log',
      warning: 'redact',
      critical: 'redact',
    },
  };

  const result = scanForPII(output, policy);

  if (result.hasPII) {
    logPIIDetection(result, {
      userId: options.userId,
      orgId: options.orgId,
      agentId: options.agentId,
      direction: 'output',
      action: 'redact',
    });

    // Redact PII from output
    const redactedOutput = redactPII(output, policy);

    return {
      output: redactedOutput,
      result,
      wasModified: true,
    };
  }

  return {
    output,
    result,
    wasModified: false,
  };
}
