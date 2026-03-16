import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveData, isRunnerActive } from '../src/testDataResolver.js';

describe('testDataResolver', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isRunnerActive()', () => {
    it('should return true when WDR_ACTIVE is "true"', () => {
      process.env.WDR_ACTIVE = 'true';
      expect(isRunnerActive()).toBe(true);
    });

    it('should return false when WDR_ACTIVE is not "true"', () => {
      process.env.WDR_ACTIVE = 'false';
      expect(isRunnerActive()).toBe(false);
    });
  });

  describe('resolveData()', () => {
    it('should return the fallback value when data runner is NOT active', () => {
      process.env.WDR_ACTIVE = 'false';
      process.env['MY_FALLBACK'] = 'local-user';
      process.env['InjectedColumn'] = 'excel-user';

      const result = resolveData('InjectedColumn', 'MY_FALLBACK');
      expect(result).toBe('local-user');
    });

    it('should return the dataColumn value when data runner IS active', () => {
      process.env.WDR_ACTIVE = 'true';
      process.env['MY_FALLBACK'] = 'local-user';
      process.env['InjectedColumn'] = 'excel-user';

      const result = resolveData('InjectedColumn', 'MY_FALLBACK');
      expect(result).toBe('excel-user');
    });
  });
});
