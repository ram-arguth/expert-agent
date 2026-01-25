import { describe, it, expect } from 'vitest';
import { UX_ANALYST_CONFIG, compilePrompt } from '../ux-analyst';

describe('Localization Support', () => {
  describe('Configuration', () => {
    it('has localeVariants defined for UX Analyst', () => {
      expect(UX_ANALYST_CONFIG.localeVariants).toBeDefined();
      expect(UX_ANALYST_CONFIG.localeVariants?.['en-GB']).toBeDefined();
    });

    it('contains localized context for en-GB', () => {
      const gbVariant = UX_ANALYST_CONFIG.localeVariants?.['en-GB'];
      expect(gbVariant?.localizedContext).toContain('UK Accessibility Regulations');
    });
  });

  describe('Prompt Compilation', () => {
    const baseInput = {
      productName: 'Test App',
      productDescription: 'A test application',
      targetAudience: 'General public',
      primaryGoal: 'Usability',
      featuresToAnalyze: ['Login'],
      platform: 'Web',
    };

    it('compiles prompt without localized context when no locale provided', () => {
      const prompt = compilePrompt(baseInput);
      expect(prompt).not.toContain('Region-Specific Guidelines');
      expect(prompt).not.toContain('UK Accessibility Regulations');
    });

    it('compiles prompt with localized context when provided', () => {
      const localizedContext = UX_ANALYST_CONFIG.localeVariants?.['en-GB']?.localizedContext;
      const prompt = compilePrompt({
        ...baseInput,
        localizedContext,
      });

      expect(prompt).toContain('Region-Specific Guidelines');
      expect(prompt).toContain('UK Accessibility Regulations');
    });
  });
});
