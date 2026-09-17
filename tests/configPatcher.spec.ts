import { describe, it, expect, afterEach } from 'vitest';
import { patchConfigForOutputIsolation } from '../src/configPatcher.js';
import fs from 'fs';

describe('configPatcher', () => {
  let patchedPath: string | undefined;

  afterEach(() => {
    if (patchedPath) fs.rmSync(patchedPath, { force: true });
    patchedPath = undefined;
  });

  it('returns null when no reporter has an outputDir', () => {
    const result = patchConfigForOutputIsolation('wdio.conf.js', {
      reporters: ['spec', ['allure', {}]],
    });
    expect(result).toBeNull();
  });

  it('writes a wrapper config and reports every outputDir found', () => {
    const result = patchConfigForOutputIsolation('wdio.conf.js', {
      reporters: [
        ['allure', { outputDir: './reports/allure-results' }],
        ['json', { outputDir: './reports/json-results' }],
        'spec',
      ],
    });

    expect(result).not.toBeNull();
    patchedPath = result!.patchedConfigPath;
    expect(result!.outputDirs).toEqual(['./reports/allure-results', './reports/json-results']);
    expect(fs.existsSync(patchedPath)).toBe(true);

    const source = fs.readFileSync(patchedPath, 'utf-8');
    expect(source).toContain('getIsolatedOutputDir');
    expect(source).toContain('export const config');
  });
});
