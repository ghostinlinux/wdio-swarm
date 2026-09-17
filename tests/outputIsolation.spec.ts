import { describe, it, expect, afterEach } from 'vitest';
import { getIsolatedOutputDir, flattenIsolatedResults } from '../src/outputIsolation.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('outputIsolation', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('scopes the output dir by the current pid', () => {
    const dir = getIsolatedOutputDir('./reports/allure-results');
    expect(dir).toBe(path.join('./reports/allure-results', `run-${process.pid}`));
  });

  it('merges run-* subdirectories into baseDir and removes them', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'output-isolation-'));
    const runA = path.join(tmpDir, 'run-111');
    const runB = path.join(tmpDir, 'run-222');
    fs.mkdirSync(runA);
    fs.mkdirSync(runB);
    fs.writeFileSync(path.join(runA, 'a.json'), 'a');
    fs.writeFileSync(path.join(runB, 'b.json'), 'b');

    flattenIsolatedResults(tmpDir);

    expect(fs.existsSync(runA)).toBe(false);
    expect(fs.existsSync(runB)).toBe(false);
    expect(fs.readFileSync(path.join(tmpDir, 'a.json'), 'utf-8')).toBe('a');
    expect(fs.readFileSync(path.join(tmpDir, 'b.json'), 'utf-8')).toBe('b');
  });

  it('does nothing when baseDir does not exist', () => {
    expect(() => flattenIsolatedResults('./does-not-exist-xyz')).not.toThrow();
  });
});
