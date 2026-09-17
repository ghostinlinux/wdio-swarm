/**
 * outputIsolation.ts
 *
 * wdio-swarm spawns one full `wdio run` OS process per task and runs many of
 * them concurrently. A static output directory in wdio.conf.js (allure, json,
 * junit, or any other file-based reporter) is shared by every one of those
 * processes, and their reporters race on it (writers cleaning/touching the
 * same directory mid-run), which corrupts the report.
 *
 * These helpers isolate each worker into its own `run-<pid>` subdirectory
 * (safe, since `process.pid` inside a spawned worker is unique to it) and
 * merge them back together once the swarm run finishes.
 */

import fs from 'fs';
import path from 'path';

/**
 * Per-worker output dir, isolated by OS pid.
 *
 * @param {string} baseDir - The shared reporter output directory (e.g. './reports/allure-results')
 * @returns {string} A pid-scoped subdirectory of baseDir.
 */
export function getIsolatedOutputDir(baseDir: string): string {
  return path.join(baseDir, `run-${process.pid}`);
}

/**
 * Flattens every `run-<pid>` subdirectory produced by {@link getIsolatedOutputDir}
 * back into baseDir, then removes the now-empty subdirectories.
 *
 * @param {string} baseDir - The shared reporter output directory passed to getIsolatedOutputDir.
 */
export function flattenIsolatedResults(baseDir: string): void {
  const resolvedBase = path.resolve(process.cwd(), baseDir);
  if (!fs.existsSync(resolvedBase)) return;

  for (const entry of fs.readdirSync(resolvedBase)) {
    if (!entry.startsWith('run-')) continue;
    const runDir = path.join(resolvedBase, entry);
    if (!fs.statSync(runDir).isDirectory()) continue;

    for (const file of fs.readdirSync(runDir)) {
      fs.copyFileSync(path.join(runDir, file), path.join(resolvedBase, file));
    }
    fs.rmSync(runDir, { recursive: true, force: true });
  }
}
