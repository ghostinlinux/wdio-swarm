import { spawn } from 'child_process';
import path from 'path';

/**
 * Spawn a single WDIO worker for the given task.
 *
 * Key design decision: we use WDIO's native --spec CLI flag to tell each worker
 * exactly which spec to run. This means end users do NOT need to add any
 * WDR_TARGET_SPEC logic to their wdio.conf.js — their config stays untouched.
 *
 * Feature 3: If timeoutMs is set, the process is killed after that duration.
 *
 * @param {string}      configPath  - Absolute WDIO config path
 * @param {object}      task        - Task object { id, specPath, data, dataIndex }
 * @param {object}      capability  - Capability object for this worker
 * @param {number|null} timeoutMs   - Optional hard timeout in milliseconds
 * @returns {Promise<number>}       - WDIO exit code
 */
export function executeTask(configPath, task, capability, timeoutMs = null) {
  return new Promise((resolve, reject) => {
    const absoluteSpecPath = path.resolve(process.cwd(), task.specPath);

    // Inject the entire data row + runner metadata as env vars for the worker
    const env = {
      ...process.env,
      ...task.data,       // e.g. { InsuranceNbr: 'zzz123', Status: 'active' }
      WDR_ACTIVE: 'true',
      WDR_CAPABILITY: JSON.stringify(capability),
    };

    // Pass --spec natively to WDIO CLI — no wdio.conf.js changes needed by the user
    const args = ['wdio', 'run', configPath, '--spec', absoluteSpecPath];

    const wdioProcess = spawn('npx', args, {
      env,
      stdio: 'inherit',
      shell: true,
    });

    // Feature 3: Task Timeout
    let timeoutHandle = null;
    if (timeoutMs) {
      timeoutHandle = setTimeout(() => {
        console.warn(`⏱  [${task.id}] Timeout (${timeoutMs / 1000}s) — killing worker.`);
        wdioProcess.kill('SIGTERM');
        reject(new Error(`Task [${task.id}] exceeded timeout of ${timeoutMs / 1000}s`));
      }, timeoutMs);
    }

    wdioProcess.on('error', (err) => {
      clearTimeout(timeoutHandle);
      reject(err);
    });

    wdioProcess.on('exit', (code) => {
      clearTimeout(timeoutHandle);
      resolve(code ?? 1);
    });
  });
}
