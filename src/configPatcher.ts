/**
 * configPatcher.ts
 *
 * wdio-swarm spawns many `wdio run` OS processes concurrently, all off the
 * same wdio.conf.js. If that config wires up a file-based reporter (allure,
 * json, junit, ...) with a static `outputDir`, every worker's reporter races
 * on the same directory and corrupts the results.
 *
 * This generates a temporary wrapper config that scopes every reporter's
 * outputDir to a `run-<pid>` subdirectory per worker, and points `wdio run`
 * at the wrapper instead of the user's file. No changes to the user's own
 * wdio.conf.js are required.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ReporterPatch {
  patchedConfigPath: string;
  outputDirs: string[];
}

function findReporterOutputDirs(reporters: any[] = []): string[] {
  const dirs = new Set<string>();
  for (const r of reporters) {
    if (Array.isArray(r) && typeof r[1]?.outputDir === 'string') {
      dirs.add(r[1].outputDir);
    }
  }
  return [...dirs];
}

/**
 * @param {string} configPath - The wdio config path as passed to wdio-swarm.
 * @param {any}    wdioConfig - The already-loaded config object (from loadConfig).
 * @returns The wrapper config to run instead and the base output dirs to
 * flatten once the swarm finishes, or null if no reporter has an outputDir.
 */
export function patchConfigForOutputIsolation(
  configPath: string,
  wdioConfig: any,
): ReporterPatch | null {
  const outputDirs = findReporterOutputDirs(wdioConfig.reporters);
  if (outputDirs.length === 0) return null;

  const originalUrl = pathToFileURL(path.resolve(process.cwd(), configPath)).href;
  const isolationHelperUrl = pathToFileURL(path.join(__dirname, 'outputIsolation.js')).href;

  const wrapperSource = `import { getIsolatedOutputDir } from ${JSON.stringify(isolationHelperUrl)};
const mod = await import(${JSON.stringify(originalUrl)});
const userConfig = mod.config || mod.default?.config || mod.default || mod;

const reporters = (userConfig.reporters || []).map((r) =>
  Array.isArray(r) && typeof r[1]?.outputDir === 'string'
    ? [r[0], { ...r[1], outputDir: getIsolatedOutputDir(r[1].outputDir) }]
    : r,
);

export const config = { ...userConfig, reporters };
`;

  const patchedConfigPath = path.join(
    os.tmpdir(),
    `wdio-swarm-config-${process.pid}-${Date.now()}.mjs`,
  );
  fs.writeFileSync(patchedConfigPath, wrapperSource, 'utf-8');

  return { patchedConfigPath, outputDirs };
}
