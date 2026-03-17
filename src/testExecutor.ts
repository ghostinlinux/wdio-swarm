import { spawn } from 'child_process';
import path from 'path';
import type { Task } from './taskQueue.js';

/**
 * Spawns a single WebdriverIO worker for the given task.
 * 
 * @param {string} configPath - Path to the WDIO config file.
 * @param {Task}   task       - The task containing the spec and data for this worker.
 * @param {any}    capability - The specific browser capability to use.
 * @param {number | null} timeoutMs - Max execution time in milliseconds.
 * @returns {Promise<number>} Resolves with the worker's exit code.
 */
export function executeTask(
  configPath: string,
  task: Task,
  capability: any,
  timeoutMs: number | null = null
): Promise<number> {
  return new Promise((resolve, reject) => {
    const absoluteSpecPath = path.resolve(process.cwd(), task.specPath);

    // Prepare worker environment with injected data, safely coercing all to strings
    const stringifiedData: Record<string, string> = {};
    for (const [key, val] of Object.entries(task.data || {})) {
      stringifiedData[key] = String(val);
    }
    
    const workerEnv: NodeJS.ProcessEnv = {
      ...process.env,
      WDR_ACTIVE: 'true',
      ...stringifiedData
    };

    /**
     * Launch worker: npx wdio run <config> --spec <path>
     */
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(command, ['wdio', 'run', configPath, '--spec', absoluteSpecPath], {
      stdio: 'inherit',
      env: workerEnv
    });

    let timeoutWatcher: NodeJS.Timeout | null = null;
    if (timeoutMs) {
      timeoutWatcher = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Task timeout after ${timeoutMs / 1000}s`));
      }, timeoutMs);
    }

    child.on('close', (code) => {
      if (timeoutWatcher) clearTimeout(timeoutWatcher);
      resolve(code || 0);
    });

    child.on('error', (err) => {
      if (timeoutWatcher) clearTimeout(timeoutWatcher);
      reject(err);
    });
  });
}
