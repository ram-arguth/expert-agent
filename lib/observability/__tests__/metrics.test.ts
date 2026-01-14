/**
 * Metrics Module Tests
 *
 * Comprehensive tests for the application metrics module.
 * Covers counters, gauges, histograms, and high-level metric helpers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  incrementCounter,
  setGauge,
  recordHistogram,
  measureDuration,
  measureDurationSync,
  recordRequest,
  recordTokenUsage,
  recordAILatency,
  recordAIError,
  recordSecurityBlock,
  recordPIIDetection,
  recordRateLimitExceeded,
  recordCost,
  recordSessionCreated,
  setActiveSessionCount,
  recordQueryDuration,
  getCounterValue,
  getGaugeValue,
  getHistogramStats,
  getAllMetrics,
  clearMetrics,
  getMetricDefinitions,
  METRIC_DEFINITIONS,
} from '../metrics';

describe('Metrics Module', () => {
  beforeEach(() => {
    clearMetrics();
  });

  describe('Metric Definitions', () => {
    it('defines all required metrics', () => {
      const definitions = getMetricDefinitions();

      // Request metrics
      expect(definitions['request.latency']).toBeDefined();
      expect(definitions['request.count']).toBeDefined();
      expect(definitions['request.error']).toBeDefined();

      // AI metrics
      expect(definitions['ai.tokens.input']).toBeDefined();
      expect(definitions['ai.tokens.output']).toBeDefined();
      expect(definitions['ai.latency']).toBeDefined();
      expect(definitions['ai.error']).toBeDefined();

      // Session metrics
      expect(definitions['session.active']).toBeDefined();
      expect(definitions['session.created']).toBeDefined();

      // Security metrics
      expect(definitions['security.blocked']).toBeDefined();
      expect(definitions['security.pii_detected']).toBeDefined();

      // Rate limiting
      expect(definitions['rate_limit.exceeded']).toBeDefined();

      // Cost
      expect(definitions['cost.estimated']).toBeDefined();

      // Query
      expect(definitions['query.duration']).toBeDefined();
    });

    it('metrics have correct types', () => {
      expect(METRIC_DEFINITIONS['request.latency'].type).toBe('histogram');
      expect(METRIC_DEFINITIONS['request.count'].type).toBe('counter');
      expect(METRIC_DEFINITIONS['session.active'].type).toBe('gauge');
    });

    it('metrics have descriptions and units', () => {
      for (const [key, def] of Object.entries(METRIC_DEFINITIONS)) {
        expect(def.description, `${key} should have description`).toBeTruthy();
        expect(def.unit, `${key} should have unit`).toBeTruthy();
        expect(def.name, `${key} should have name`).toBeTruthy();
      }
    });
  });

  describe('Counter Metrics', () => {
    it('increments counter by 1 by default', () => {
      incrementCounter('request.count', 1, { endpoint: '/api/test', method: 'GET', status_code: '200' });
      const value = getCounterValue('request.count', { endpoint: '/api/test', method: 'GET', status_code: '200' });
      expect(value).toBe(1);
    });

    it('increments counter by specified value', () => {
      incrementCounter('ai.tokens.input', 100, { agent_id: 'ux-analyst', model: 'gemini-3' });
      incrementCounter('ai.tokens.input', 50, { agent_id: 'ux-analyst', model: 'gemini-3' });
      const value = getCounterValue('ai.tokens.input', { agent_id: 'ux-analyst', model: 'gemini-3' });
      expect(value).toBe(150);
    });

    it('tracks counters with different labels separately', () => {
      incrementCounter('request.count', 1, { endpoint: '/api/a', method: 'GET', status_code: '200' });
      incrementCounter('request.count', 1, { endpoint: '/api/b', method: 'GET', status_code: '200' });
      incrementCounter('request.count', 1, { endpoint: '/api/a', method: 'POST', status_code: '200' });

      expect(getCounterValue('request.count', { endpoint: '/api/a', method: 'GET', status_code: '200' })).toBe(1);
      expect(getCounterValue('request.count', { endpoint: '/api/b', method: 'GET', status_code: '200' })).toBe(1);
      expect(getCounterValue('request.count', { endpoint: '/api/a', method: 'POST', status_code: '200' })).toBe(1);
    });

    it('returns 0 for untracked counter', () => {
      const value = getCounterValue('request.count', { endpoint: '/not/tracked', method: 'GET', status_code: '200' });
      expect(value).toBe(0);
    });
  });

  describe('Gauge Metrics', () => {
    it('sets gauge value', () => {
      setGauge('session.active', 10, { org_id: 'org-1' });
      const value = getGaugeValue('session.active', { org_id: 'org-1' });
      expect(value).toBe(10);
    });

    it('overwrites gauge value', () => {
      setGauge('session.active', 10, { org_id: 'org-1' });
      setGauge('session.active', 5, { org_id: 'org-1' });
      const value = getGaugeValue('session.active', { org_id: 'org-1' });
      expect(value).toBe(5);
    });

    it('tracks gauges with different labels separately', () => {
      setGauge('session.active', 10, { org_id: 'org-1' });
      setGauge('session.active', 20, { org_id: 'org-2' });

      expect(getGaugeValue('session.active', { org_id: 'org-1' })).toBe(10);
      expect(getGaugeValue('session.active', { org_id: 'org-2' })).toBe(20);
    });

    it('returns 0 for untracked gauge', () => {
      const value = getGaugeValue('session.active', { org_id: 'not-tracked' });
      expect(value).toBe(0);
    });
  });

  describe('Histogram Metrics', () => {
    it('records histogram values', () => {
      recordHistogram('request.latency', 50, { endpoint: '/api/test', method: 'GET', status_code: '200' });
      recordHistogram('request.latency', 100, { endpoint: '/api/test', method: 'GET', status_code: '200' });
      recordHistogram('request.latency', 150, { endpoint: '/api/test', method: 'GET', status_code: '200' });

      const stats = getHistogramStats('request.latency', { endpoint: '/api/test', method: 'GET', status_code: '200' });
      expect(stats).toBeDefined();
      expect(stats!.count).toBe(3);
      expect(stats!.sum).toBe(300);
      expect(stats!.avg).toBe(100);
    });

    it('returns undefined for untracked histogram', () => {
      const stats = getHistogramStats('request.latency', { endpoint: '/not/tracked', method: 'GET', status_code: '200' });
      expect(stats).toBeUndefined();
    });

    it('tracks histograms with different labels separately', () => {
      recordHistogram('request.latency', 50, { endpoint: '/api/a', method: 'GET', status_code: '200' });
      recordHistogram('request.latency', 100, { endpoint: '/api/b', method: 'GET', status_code: '200' });

      const statsA = getHistogramStats('request.latency', { endpoint: '/api/a', method: 'GET', status_code: '200' });
      const statsB = getHistogramStats('request.latency', { endpoint: '/api/b', method: 'GET', status_code: '200' });

      expect(statsA!.avg).toBe(50);
      expect(statsB!.avg).toBe(100);
    });
  });

  describe('Duration Measurement', () => {
    it('measures async operation duration', async () => {
      const result = await measureDuration('ai.latency', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'done';
      }, { agent_id: 'test', model: 'gemini-3' });

      expect(result).toBe('done');

      const stats = getHistogramStats('ai.latency', { agent_id: 'test', model: 'gemini-3', success: 'true' });
      expect(stats).toBeDefined();
      expect(stats!.count).toBe(1);
      expect(stats!.avg).toBeGreaterThanOrEqual(10);
    });

    it('records failure for async operation that throws', async () => {
      await expect(
        measureDuration('ai.latency', async () => {
          throw new Error('Test error');
        }, { agent_id: 'test', model: 'gemini-3' })
      ).rejects.toThrow('Test error');

      const successStats = getHistogramStats('ai.latency', { agent_id: 'test', model: 'gemini-3', success: 'true' });
      const failureStats = getHistogramStats('ai.latency', { agent_id: 'test', model: 'gemini-3', success: 'false' });

      expect(successStats).toBeUndefined();
      expect(failureStats).toBeDefined();
      expect(failureStats!.count).toBe(1);
    });

    it('measures sync operation duration', () => {
      const result = measureDurationSync('query.duration', () => {
        // Simulate some work
        let sum = 0;
        for (let i = 0; i < 10000; i++) sum += i;
        return sum;
      }, { agent_id: 'test' });

      expect(result).toBe(49995000);

      const stats = getHistogramStats('query.duration', { agent_id: 'test', success: 'true' });
      expect(stats).toBeDefined();
      expect(stats!.count).toBe(1);
    });
  });

  describe('High-Level Metric Helpers', () => {
    describe('recordRequest', () => {
      it('records successful request', () => {
        recordRequest('/api/query', 'POST', 200, 150);

        const latencyStats = getHistogramStats('request.latency', {
          endpoint: '/api/query',
          method: 'POST',
          status_code: '200',
        });
        expect(latencyStats!.count).toBe(1);
        expect(latencyStats!.avg).toBe(150);

        const countValue = getCounterValue('request.count', {
          endpoint: '/api/query',
          method: 'POST',
          status_code: '200',
        });
        expect(countValue).toBe(1);
      });

      it('records client error request', () => {
        recordRequest('/api/query', 'POST', 400, 50);

        const errorValue = getCounterValue('request.error', {
          endpoint: '/api/query',
          error_type: 'client_error',
          status_code: '400',
        });
        expect(errorValue).toBe(1);
      });

      it('records server error request', () => {
        recordRequest('/api/query', 'POST', 500, 100);

        const errorValue = getCounterValue('request.error', {
          endpoint: '/api/query',
          error_type: 'server_error',
          status_code: '500',
        });
        expect(errorValue).toBe(1);
      });
    });

    describe('recordTokenUsage', () => {
      it('records input and output tokens', () => {
        recordTokenUsage('ux-analyst', 'gemini-3-pro', 1000, 500);

        expect(getCounterValue('ai.tokens.input', { agent_id: 'ux-analyst', model: 'gemini-3-pro' })).toBe(1000);
        expect(getCounterValue('ai.tokens.output', { agent_id: 'ux-analyst', model: 'gemini-3-pro' })).toBe(500);
      });

      it('accumulates token usage', () => {
        recordTokenUsage('ux-analyst', 'gemini-3-pro', 1000, 500);
        recordTokenUsage('ux-analyst', 'gemini-3-pro', 2000, 1000);

        expect(getCounterValue('ai.tokens.input', { agent_id: 'ux-analyst', model: 'gemini-3-pro' })).toBe(3000);
        expect(getCounterValue('ai.tokens.output', { agent_id: 'ux-analyst', model: 'gemini-3-pro' })).toBe(1500);
      });
    });

    describe('recordAILatency', () => {
      it('records successful AI latency', () => {
        recordAILatency('ux-analyst', 'gemini-3-pro', 1500, true);

        const stats = getHistogramStats('ai.latency', {
          agent_id: 'ux-analyst',
          model: 'gemini-3-pro',
          success: 'true',
        });
        expect(stats!.avg).toBe(1500);
      });

      it('records failed AI latency', () => {
        recordAILatency('ux-analyst', 'gemini-3-pro', 500, false);

        const stats = getHistogramStats('ai.latency', {
          agent_id: 'ux-analyst',
          model: 'gemini-3-pro',
          success: 'false',
        });
        expect(stats!.avg).toBe(500);
      });
    });

    describe('recordAIError', () => {
      it('records AI errors', () => {
        recordAIError('ux-analyst', 'rate_limit');
        recordAIError('ux-analyst', 'rate_limit');
        recordAIError('ux-analyst', 'timeout');

        expect(getCounterValue('ai.error', { agent_id: 'ux-analyst', error_type: 'rate_limit' })).toBe(2);
        expect(getCounterValue('ai.error', { agent_id: 'ux-analyst', error_type: 'timeout' })).toBe(1);
      });
    });

    describe('Security Metrics', () => {
      it('records security blocks', () => {
        recordSecurityBlock('prompt_injection', 'critical');
        recordSecurityBlock('jailbreak', 'high');

        expect(getCounterValue('security.blocked', { reason: 'prompt_injection', severity: 'critical' })).toBe(1);
        expect(getCounterValue('security.blocked', { reason: 'jailbreak', severity: 'high' })).toBe(1);
      });

      it('records PII detection', () => {
        recordPIIDetection('ssn', 'input', 'block');
        recordPIIDetection('credit_card', 'output', 'redact');

        expect(getCounterValue('security.pii_detected', { pii_type: 'ssn', direction: 'input', action: 'block' })).toBe(1);
        expect(getCounterValue('security.pii_detected', { pii_type: 'credit_card', direction: 'output', action: 'redact' })).toBe(1);
      });
    });

    describe('Rate Limiting Metrics', () => {
      it('records rate limit exceeded', () => {
        recordRateLimitExceeded('free', 'requests_per_hour');
        recordRateLimitExceeded('pro', 'tokens_per_day');

        expect(getCounterValue('rate_limit.exceeded', { tier: 'free', limit_type: 'requests_per_hour' })).toBe(1);
        expect(getCounterValue('rate_limit.exceeded', { tier: 'pro', limit_type: 'tokens_per_day' })).toBe(1);
      });
    });

    describe('Cost Metrics', () => {
      it('records estimated cost', () => {
        recordCost('user-1', 'org-1', 100); // $1.00
        recordCost('user-1', 'org-1', 50);  // $0.50

        expect(getCounterValue('cost.estimated', { user_id: 'user-1', org_id: 'org-1' })).toBe(150);
      });
    });

    describe('Session Metrics', () => {
      it('records session creation', () => {
        recordSessionCreated('org-1', 'ux-analyst');
        recordSessionCreated('org-1', 'ux-analyst');
        recordSessionCreated('org-1', 'legal-advisor');

        expect(getCounterValue('session.created', { org_id: 'org-1', agent_id: 'ux-analyst' })).toBe(2);
        expect(getCounterValue('session.created', { org_id: 'org-1', agent_id: 'legal-advisor' })).toBe(1);
      });

      it('sets active session count', () => {
        setActiveSessionCount('org-1', 10);
        expect(getGaugeValue('session.active', { org_id: 'org-1' })).toBe(10);

        setActiveSessionCount('org-1', 15);
        expect(getGaugeValue('session.active', { org_id: 'org-1' })).toBe(15);
      });
    });

    describe('Query Metrics', () => {
      it('records query duration', () => {
        recordQueryDuration('ux-analyst', 2500, true);
        recordQueryDuration('ux-analyst', 3500, true);

        const stats = getHistogramStats('query.duration', { agent_id: 'ux-analyst', success: 'true' });
        expect(stats!.count).toBe(2);
        expect(stats!.avg).toBe(3000);
      });
    });
  });

  describe('getAllMetrics', () => {
    it('returns all tracked metrics', () => {
      incrementCounter('request.count', 1, { endpoint: '/api/test', method: 'GET', status_code: '200' });
      setGauge('session.active', 5, { org_id: 'org-1' });
      recordHistogram('request.latency', 100, { endpoint: '/api/test', method: 'GET', status_code: '200' });

      const all = getAllMetrics();

      expect(all.counters.size).toBeGreaterThan(0);
      expect(all.gauges.size).toBeGreaterThan(0);
      expect(all.recentValues.length).toBe(3);
    });

    it('recent values have timestamps', () => {
      incrementCounter('request.count', 1, { endpoint: '/api/test', method: 'GET', status_code: '200' });

      const all = getAllMetrics();
      expect(all.recentValues[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('clearMetrics', () => {
    it('clears all metrics', () => {
      incrementCounter('request.count', 10, { endpoint: '/api/test', method: 'GET', status_code: '200' });
      setGauge('session.active', 5, { org_id: 'org-1' });

      clearMetrics();

      expect(getCounterValue('request.count', { endpoint: '/api/test', method: 'GET', status_code: '200' })).toBe(0);
      expect(getGaugeValue('session.active', { org_id: 'org-1' })).toBe(0);

      const all = getAllMetrics();
      expect(all.counters.size).toBe(0);
      expect(all.gauges.size).toBe(0);
      expect(all.recentValues.length).toBe(0);
    });
  });

  describe('Invalid Metric Handling', () => {
    it('warns on invalid counter metric', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      incrementCounter('invalid.metric' as keyof typeof METRIC_DEFINITIONS, 1, {});
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown or invalid'));
      consoleSpy.mockRestore();
    });

    it('warns on wrong metric type', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // Trying to use histogram metric as counter
      incrementCounter('request.latency', 1, {});
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown or invalid'));
      consoleSpy.mockRestore();
    });
  });
});
