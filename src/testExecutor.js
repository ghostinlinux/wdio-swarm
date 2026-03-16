import { spawn } from 'child_process';
import path from 'path';

export function executeTask(configPath, task, capability) {
  return new Promise((resolve, reject) => {
    // We stringify the capability to override the capability natively on the wdio CLI 
    // Wait, the WDIO CLI allows overriding capabilities or running with specific ENV vars.
    // The easiest and safest way is to pass the specific capability through env and let wdio native merge handles it, 
    // OR just pass the capability string payload via ENV to bypass complex shell string-escaping over WDIO_CLI_ARGS.
    
    // Instead of messing with WDIO_OPTIONS, we'll inject the target capability as an environment variable
    // for a custom reporter/launcher, or cleanly through the process.env.
    
    const absoluteSpecPath = path.resolve(process.cwd(), task.specPath);
    const env = { 
        ...process.env, 
        ...task.data,  // Dynamically inject the entire test data object as env variables for the worker
        WDIO_DATA_RUNNER_ACTIVE: 'true',
        WDIO_ACTIVE_CAPABILITY: JSON.stringify(capability),
        WDIO_TARGET_SPEC: absoluteSpecPath
    };

    console.log(`[${task.id}] Spawning WebdriverIO worker for spec: ${task.specPath}`);

    const wdioProcess = spawn('npx', ['wdio', 'run', configPath], {
      env,
      stdio: 'inherit',
      shell: true, // Use shell to ensure npx resolves correctly on Windows/Unix
    });

    wdioProcess.on('error', (err) => {
      reject(err);
    });

    wdioProcess.on('exit', (code) => {
      if (code !== 0) {
         console.warn(`[${task.id}] WDIO process exited with code ${code}`);
      }
      resolve(code);
    });
  });
}
