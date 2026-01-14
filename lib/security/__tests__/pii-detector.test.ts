/**
 * PII Detection Tests
 *
 * Comprehensive tests for the PII detection and compliance guardrails module.
 * Covers all PII types, validation logic, policies, and audit logging.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  scanForPII,
  containsPII,
  redactPII,
  logPIIDetection,
  getAuditLog,
  clearAuditLog,
  guardInputForPII,
  guardOutputForPII,
  hashContent,
  DEFAULT_PII_POLICY,
  STRICT_PII_POLICY,
  LENIENT_PII_POLICY,
  type PIIPolicy,
  type PIIType,
} from '../pii-detector';

describe('PII Detection', () => {
  beforeEach(() => {
    clearAuditLog();
  });

  describe('SSN Detection', () => {
    it('detects valid SSN with dashes', () => {
      const result = scanForPII('My SSN is 123-45-6789');
      expect(result.hasPII).toBe(true);
      expect(result.matches.some(m => m.type === 'ssn')).toBe(true);
      expect(result.maxSeverity).toBe('critical');
    });

    it('detects valid SSN with spaces', () => {
      const result = scanForPII('SSN: 123 45 6789');
      expect(result.hasPII).toBe(true);
      expect(result.matches.some(m => m.type === 'ssn')).toBe(true);
    });

    it('detects valid SSN without separators', () => {
      const result = scanForPII('SSN: 123456789');
      expect(result.hasPII).toBe(true);
      expect(result.matches.some(m => m.type === 'ssn')).toBe(true);
    });

    it('rejects invalid SSN starting with 000', () => {
      const result = scanForPII('Invalid: 000-12-3456');
      expect(result.matches.filter(m => m.type === 'ssn').length).toBe(0);
    });

    it('rejects invalid SSN starting with 666', () => {
      const result = scanForPII('Invalid: 666-12-3456');
      expect(result.matches.filter(m => m.type === 'ssn').length).toBe(0);
    });

    it('rejects invalid SSN starting with 9xx', () => {
      const result = scanForPII('Invalid: 900-12-3456');
      expect(result.matches.filter(m => m.type === 'ssn').length).toBe(0);
    });
  });

  describe('Credit Card Detection', () => {
    it('detects valid Visa card', () => {
      const result = scanForPII('Card: 4111111111111111');
      expect(result.hasPII).toBe(true);
      expect(result.matches.some(m => m.type === 'credit_card')).toBe(true);
      expect(result.maxSeverity).toBe('critical');
    });

    it('detects valid MasterCard', () => {
      const result = scanForPII('Card: 5500000000000004');
      expect(result.hasPII).toBe(true);
      expect(result.matches.some(m => m.type === 'credit_card')).toBe(true);
    });

    it('detects valid American Express', () => {
      const result = scanForPII('Card: 340000000000009');
      expect(result.hasPII).toBe(true);
      expect(result.matches.some(m => m.type === 'credit_card')).toBe(true);
    });

    it('validates using Luhn algorithm', () => {
      // Invalid Luhn checksum
      const result = scanForPII('Card: 4111111111111112');
      expect(result.matches.filter(m => m.type === 'credit_card').length).toBe(0);
    });

    it('rejects too short numbers', () => {
      const result = scanForPII('Card: 411111111111');
      expect(result.matches.filter(m => m.type === 'credit_card').length).toBe(0);
    });
  });

  describe('Email Detection', () => {
    it('detects standard email', () => {
      const result = scanForPII('Contact: user@example.com');
      expect(result.hasPII).toBe(true);
      expect(result.matches.some(m => m.type === 'email')).toBe(true);
      expect(result.matches.find(m => m.type === 'email')?.severity).toBe('warning');
    });

    it('detects email with subdomain', () => {
      const result = scanForPII('Email: user@mail.example.co.uk');
      expect(result.matches.some(m => m.type === 'email')).toBe(true);
    });

    it('detects email with plus sign', () => {
      const result = scanForPII('Email: user+tag@example.com');
      expect(result.matches.some(m => m.type === 'email')).toBe(true);
    });
  });

  describe('Phone Number Detection', () => {
    it('detects US phone with dashes', () => {
      const result = scanForPII('Call: 555-123-4567');
      expect(result.hasPII).toBe(true);
      expect(result.matches.some(m => m.type === 'phone')).toBe(true);
    });

    it('detects US phone with parentheses', () => {
      const result = scanForPII('Call: (555) 123-4567');
      expect(result.matches.some(m => m.type === 'phone')).toBe(true);
    });

    it('detects US phone with country code', () => {
      const result = scanForPII('Call: +1-555-123-4567');
      expect(result.matches.some(m => m.type === 'phone')).toBe(true);
    });

    it('rejects repetitive numbers', () => {
      const result = scanForPII('Number: 111-111-1111');
      expect(result.matches.filter(m => m.type === 'phone').length).toBe(0);
    });
  });

  describe('IP Address Detection', () => {
    const ipPolicy: PIIPolicy = {
      enabledTypes: ['ip_address'],
      actions: { info: 'log', warning: 'log', critical: 'log' },
      auditLog: false,
    };

    it('detects valid public IP', () => {
      // Using a real public IP (Google DNS) that won't be filtered
      const result = scanForPII('Server: 8.8.8.8', ipPolicy);
      expect(result.hasPII).toBe(true);
      expect(result.matches.some(m => m.type === 'ip_address')).toBe(true);
    });

    it('excludes localhost', () => {
      const result = scanForPII('Local: 127.0.0.1', ipPolicy);
      expect(result.matches.filter(m => m.type === 'ip_address').length).toBe(0);
    });

    it('excludes private 192.168.x.x', () => {
      const result = scanForPII('Private: 192.168.1.1', ipPolicy);
      expect(result.matches.filter(m => m.type === 'ip_address').length).toBe(0);
    });

    it('excludes private 10.x.x.x', () => {
      const result = scanForPII('Private: 10.0.0.1', ipPolicy);
      expect(result.matches.filter(m => m.type === 'ip_address').length).toBe(0);
    });
  });

  describe('Medical ID Detection', () => {
    it('detects MRN with colon', () => {
      const result = scanForPII('Patient MRN:123456789');
      expect(result.hasPII).toBe(true);
      expect(result.matches.some(m => m.type === 'medical_id')).toBe(true);
      expect(result.maxSeverity).toBe('critical');
    });

    it('detects MRN with dash', () => {
      const result = scanForPII('MRN-987654321');
      expect(result.matches.some(m => m.type === 'medical_id')).toBe(true);
    });

    it('detects MRN with space', () => {
      const result = scanForPII('MRN 123456789012');
      expect(result.matches.some(m => m.type === 'medical_id')).toBe(true);
    });
  });

  describe('Address Detection', () => {
    it('detects street address', () => {
      const policy: PIIPolicy = {
        enabledTypes: ['address'],
        actions: { info: 'log', warning: 'log', critical: 'log' },
        auditLog: false,
      };
      const result = scanForPII('Address: 123 Main Street', policy);
      expect(result.hasPII).toBe(true);
      expect(result.matches.some(m => m.type === 'address')).toBe(true);
    });

    it('detects various street types', () => {
      const policy: PIIPolicy = {
        enabledTypes: ['address'],
        actions: { info: 'log', warning: 'log', critical: 'log' },
        auditLog: false,
      };
      // These addresses should match the pattern
      const addresses = [
        '456 Oak Avenue',
        '789 Pine Road',
        '321 Elm Blvd',
        '555 Maple Drive',
        '100 Cedar Lane',
      ];

      for (const addr of addresses) {
        const result = scanForPII(`Location: ${addr}`, policy);
        expect(result.matches.some(m => m.type === 'address'), `Expected "${addr}" to match`).toBe(true);
      }
    });
  });

  describe('Multiple PII Types', () => {
    it('detects multiple PII types in same text', () => {
      const text = `
        Contact John at john@example.com or call 555-123-4567.
        His SSN is 123-45-6789 and credit card is 4111111111111111.
      `;

      const result = scanForPII(text);
      expect(result.hasPII).toBe(true);
      expect(result.matches.length).toBeGreaterThanOrEqual(4);
      expect(result.summary.email).toBe(1);
      expect(result.summary.phone).toBe(1);
      expect(result.summary.ssn).toBe(1);
      expect(result.summary.credit_card).toBe(1);
    });

    it('returns highest severity', () => {
      const text = 'Email: user@example.com, SSN: 123-45-6789';
      const result = scanForPII(text);

      // SSN is critical, email is warning
      expect(result.maxSeverity).toBe('critical');
    });
  });

  describe('No PII Cases', () => {
    it('returns no PII for clean text', () => {
      const result = scanForPII('This is a normal message with no sensitive data.');
      expect(result.hasPII).toBe(false);
      expect(result.matches.length).toBe(0);
    });

    it('returns no PII for random numbers', () => {
      const result = scanForPII('Order #123456 was placed on 2024-01-15');
      // Should not match as SSN or credit card
      expect(result.matches.filter(m => 
        m.type === 'ssn' || m.type === 'credit_card'
      ).length).toBe(0);
    });

    it('handles empty string', () => {
      const result = scanForPII('');
      expect(result.hasPII).toBe(false);
    });
  });
});

describe('containsPII (Quick Check)', () => {
  it('returns true when PII found', () => {
    expect(containsPII('SSN: 123-45-6789')).toBe(true);
  });

  it('returns false when no PII', () => {
    expect(containsPII('Hello world')).toBe(false);
  });

  it('respects policy enabled types', () => {
    const emailOnlyPolicy: PIIPolicy = {
      enabledTypes: ['email'],
      actions: { info: 'log', warning: 'log', critical: 'log' },
      auditLog: false,
    };

    // Should find email
    expect(containsPII('user@example.com', emailOnlyPolicy)).toBe(true);

    // Should NOT find SSN with email-only policy
    expect(containsPII('SSN: 123-45-6789', emailOnlyPolicy)).toBe(false);
  });
});

describe('redactPII', () => {
  it('redacts SSN', () => {
    const redacted = redactPII('My SSN is 123-45-6789');
    expect(redacted).toContain('[SSN_REDACTED]');
    expect(redacted).not.toContain('123-45-6789');
  });

  it('redacts credit card', () => {
    const redacted = redactPII('Card: 4111111111111111');
    expect(redacted).toContain('[CREDIT_CARD_REDACTED]');
    expect(redacted).not.toContain('4111111111111111');
  });

  it('redacts multiple PII instances', () => {
    const text = 'SSN: 123-45-6789, Card: 4111111111111111';
    const redacted = redactPII(text);
    
    expect(redacted).toContain('[SSN_REDACTED]');
    expect(redacted).toContain('[CREDIT_CARD_REDACTED]');
    expect(redacted).not.toContain('123-45-6789');
    expect(redacted).not.toContain('4111111111111111');
  });

  it('preserves non-PII content', () => {
    const text = 'Hello John, your SSN is 123-45-6789. Thank you!';
    const redacted = redactPII(text);
    
    expect(redacted).toContain('Hello John');
    expect(redacted).toContain('Thank you!');
    expect(redacted).toContain('[SSN_REDACTED]');
  });

  it('returns original text if no PII', () => {
    const text = 'This is clean text';
    expect(redactPII(text)).toBe(text);
  });
});

describe('Policy Configuration', () => {
  describe('DEFAULT_PII_POLICY', () => {
    it('enables common PII types', () => {
      expect(DEFAULT_PII_POLICY.enabledTypes).toContain('ssn');
      expect(DEFAULT_PII_POLICY.enabledTypes).toContain('credit_card');
      expect(DEFAULT_PII_POLICY.enabledTypes).toContain('email');
    });

    it('blocks critical PII', () => {
      expect(DEFAULT_PII_POLICY.actions.critical).toBe('block');
    });

    it('flags warning PII', () => {
      expect(DEFAULT_PII_POLICY.actions.warning).toBe('flag');
    });
  });

  describe('STRICT_PII_POLICY', () => {
    it('enables all PII types', () => {
      expect(STRICT_PII_POLICY.enabledTypes.length).toBeGreaterThan(
        DEFAULT_PII_POLICY.enabledTypes.length
      );
    });

    it('blocks warning and critical', () => {
      expect(STRICT_PII_POLICY.actions.warning).toBe('block');
      expect(STRICT_PII_POLICY.actions.critical).toBe('block');
    });
  });

  describe('LENIENT_PII_POLICY', () => {
    it('only enables high-risk PII', () => {
      expect(LENIENT_PII_POLICY.enabledTypes).toContain('ssn');
      expect(LENIENT_PII_POLICY.enabledTypes).toContain('credit_card');
      expect(LENIENT_PII_POLICY.enabledTypes).not.toContain('email');
    });

    it('only flags critical PII', () => {
      expect(LENIENT_PII_POLICY.actions.critical).toBe('flag');
      expect(LENIENT_PII_POLICY.actions.warning).toBe('log');
    });
  });

  describe('Custom Policy', () => {
    it('respects custom enabled types', () => {
      const customPolicy: PIIPolicy = {
        enabledTypes: ['email'],
        actions: { info: 'log', warning: 'log', critical: 'log' },
        auditLog: false,
      };

      const result = scanForPII('SSN: 123-45-6789, Email: user@example.com', customPolicy);
      
      expect(result.matches.some(m => m.type === 'email')).toBe(true);
      expect(result.matches.some(m => m.type === 'ssn')).toBe(false);
    });

    it('supports custom patterns', () => {
      const customPolicy: PIIPolicy = {
        enabledTypes: [],
        actions: { info: 'log', warning: 'flag', critical: 'block' },
        auditLog: true,
        customPatterns: [
          {
            name: 'Employee ID',
            pattern: /EMP-\d{6}/g,
            type: 'passport', // Reuse type
            severity: 'warning',
          },
        ],
      };

      const result = scanForPII('Employee EMP-123456 joined', customPolicy);
      expect(result.hasPII).toBe(true);
    });
  });
});

describe('Audit Logging', () => {
  beforeEach(() => {
    clearAuditLog();
  });

  it('logs PII detection events', () => {
    const result = scanForPII('SSN: 123-45-6789');
    
    logPIIDetection(result, {
      userId: 'user-1',
      orgId: 'org-1',
      direction: 'input',
      action: 'block',
    });

    const log = getAuditLog();
    expect(log.length).toBe(1);
    expect(log[0].userId).toBe('user-1');
    expect(log[0].orgId).toBe('org-1');
    expect(log[0].direction).toBe('input');
    expect(log[0].piiTypes).toContain('ssn');
    expect(log[0].action).toBe('block');
  });

  it('does not log when no PII', () => {
    const result = scanForPII('Clean text');
    
    logPIIDetection(result, {
      userId: 'user-1',
      direction: 'input',
      action: 'log',
    });

    expect(getAuditLog().length).toBe(0);
  });

  it('clears audit log correctly', () => {
    const result = scanForPII('SSN: 123-45-6789');
    logPIIDetection(result, { direction: 'input', action: 'log' });
    
    expect(getAuditLog().length).toBe(1);
    
    clearAuditLog();
    expect(getAuditLog().length).toBe(0);
  });

  it('records multiple PII types', () => {
    const result = scanForPII('SSN: 123-45-6789, Card: 4111111111111111');
    
    logPIIDetection(result, { direction: 'input', action: 'flag' });

    const log = getAuditLog();
    expect(log[0].piiTypes).toContain('ssn');
    expect(log[0].piiTypes).toContain('credit_card');
    expect(log[0].count).toBeGreaterThanOrEqual(2);
  });
});

describe('Guard Functions', () => {
  beforeEach(() => {
    clearAuditLog();
  });

  describe('guardInputForPII', () => {
    it('allows input without PII', async () => {
      const result = await guardInputForPII('Hello, I need help with UX design');
      expect(result.allowed).toBe(true);
      expect(result.result.hasPII).toBe(false);
    });

    it('blocks input with critical PII', async () => {
      const result = await guardInputForPII('My SSN is 123-45-6789');
      expect(result.allowed).toBe(false);
      expect(result.userMessage).toBeDefined();
      expect(result.userMessage).toContain('sensitive personal information');
    });

    it('allows input with warning-level PII (default policy)', async () => {
      const result = await guardInputForPII('Contact me at user@example.com');
      // Email is warning level, should be flagged but not blocked
      expect(result.allowed).toBe(true);
      expect(result.result.hasPII).toBe(true);
    });

    it('logs blocked input', async () => {
      await guardInputForPII('SSN: 123-45-6789', {
        userId: 'user-1',
        agentId: 'ux-analyst',
      });

      const log = getAuditLog();
      expect(log.length).toBe(1);
      expect(log[0].userId).toBe('user-1');
      expect(log[0].action).toBe('block');
    });

    it('respects custom policy', async () => {
      const result = await guardInputForPII('SSN: 123-45-6789', {
        policy: LENIENT_PII_POLICY,
      });

      // Lenient policy flags but doesn't block
      expect(result.allowed).toBe(true);
    });
  });

  describe('guardOutputForPII', () => {
    it('returns unmodified output without PII', async () => {
      const output = 'Based on my analysis, your design needs improvement.';
      const result = await guardOutputForPII(output);
      
      expect(result.wasModified).toBe(false);
      expect(result.output).toBe(output);
    });

    it('redacts PII from output', async () => {
      const output = 'User SSN 123-45-6789 has been processed.';
      const result = await guardOutputForPII(output);
      
      expect(result.wasModified).toBe(true);
      expect(result.output).toContain('[SSN_REDACTED]');
      expect(result.output).not.toContain('123-45-6789');
    });

    it('logs redaction', async () => {
      await guardOutputForPII('Card: 4111111111111111', {
        userId: 'user-1',
        agentId: 'ux-analyst',
      });

      const log = getAuditLog();
      expect(log.length).toBe(1);
      expect(log[0].direction).toBe('output');
      expect(log[0].action).toBe('redact');
    });
  });
});

describe('hashContent', () => {
  it('generates consistent hash', () => {
    const content = 'Test content';
    expect(hashContent(content)).toBe(hashContent(content));
  });

  it('generates different hash for different content', () => {
    expect(hashContent('Content A')).not.toBe(hashContent('Content B'));
  });

  it('returns hex string', () => {
    const hash = hashContent('Test');
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });
});

describe('Security Edge Cases', () => {
  it('handles very long text', () => {
    const longText = 'Word '.repeat(10000) + 'SSN: 123-45-6789';
    const result = scanForPII(longText);
    expect(result.hasPII).toBe(true);
  });

  it('handles unicode text', () => {
    const text = '电话: 555-123-4567 メール: user@example.com';
    const result = scanForPII(text);
    expect(result.hasPII).toBe(true);
  });

  it('handles special characters around PII', () => {
    const text = '**SSN: 123-45-6789** (important!)';
    const result = scanForPII(text);
    expect(result.hasPII).toBe(true);
  });

  it('handles newlines in text', () => {
    const text = 'Line 1\nSSN: 123-45-6789\nLine 3';
    const result = scanForPII(text);
    expect(result.hasPII).toBe(true);
  });

  it('partially redacts matches in logs', () => {
    const result = scanForPII('Card: 4111111111111111');
    const match = result.matches.find(m => m.type === 'credit_card');
    
    // Should show partial redaction like "411****111"
    expect(match?.match).toContain('****');
    expect(match?.match).not.toBe('4111111111111111');
  });
});
