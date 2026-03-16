import { loadConfig } from './configLoader.js';
import { DeviceManager, type Device } from './deviceManager.js';
import { TaskQueue, type Task } from './taskQueue.js';
import { executeTask } from './testExecutor.js';
import { ResultsManager, type TestResult } from './resultsManager.js';

// Re-export the resolver for package consumers
export { resolveData, isRunnerActive } from './testDataResolver.js';

/**
 * Orchestrates the entire parallel test execution.
 * 
 * @param {string}   configPath - Absolute path to WDIO config.
 * @param {any[]}    testData   - Array of data rows (already sliced/filtered).
 * @param {any}      options    - CLI configuration options.
 */
export async function executeRunner(configPath: string, testData: any[], options: any = {}): Promise<void> {
  const strategy: string = options.strategy || 'spec-first';
  const maxRetries: number = parseInt(options.retries) || 0;
  const taskTimeout: number | null = options.taskTimeout ? parseInt(options.taskTimeout) * 1000 : null;
  const outputPath: string | null = options.output || null;
  const specOverride: string | null = options.spec || null;
  const isRerun: boolean = options.isRerun || false;

  console.log('Loading WDIO configuration...');
  const wdioConfig = await loadConfig(configPath);

  // Pool management
  const capabilities = wdioConfig.capabilities || [];
  if (capabilities.length === 0) throw new Error('No capabilities found in WDIO config');

  const globalMax: number = wdioConfig.maxInstances || 1;
  const expandedCapabilities: any[] = [];
  capabilities.forEach((cap: any) => {
    const limit = cap.maxInstances || globalMax;
    for (let i = 0; i < limit; i++) expandedCapabilities.push(cap);
  });

  let taskList: Task[];

  if (isRerun) {
    // Re-run mode: testData is an array of failed TestResult objects
    taskList = testData.map((record: any, idx: number) => ({
      id: `rerun_${idx}`,
      specPath: record.spec,
      data: record.data,
      dataIndex: record.dataIndex ?? idx,
    }));
  } else {
    // Normal mode: Generate task permutations
    const targetSpecs = specOverride ? [specOverride] : wdioConfig.specs;
    if (!targetSpecs || targetSpecs.length === 0) {
      throw new Error('No spec files provided in config or CLI args.');
    }
    const q = new TaskQueue(targetSpecs, testData, strategy);
    taskList = [];
    while (!q.isEmpty()) {
       const task = q.getNextTask();
       if (task) taskList.push(task);
    }
  }

  const deviceManager = new DeviceManager(expandedCapabilities);
  const resultsManager = new ResultsManager(outputPath);
  const totalTasks = taskList.length;

  console.log(`Device Pool: ${capabilities.length} capability(ies), expanded to ${expandedCapabilities.length} concurrent workers.`);
  if (!isRerun) console.log(`Strategy: ${strategy}`);
  console.log(`Total tasks: ${totalTasks}`);

  return new Promise((resolve) => {
    let activeWorkers = 0;
    let completed = 0;
    let taskIndex = 0;

    /**
     * Recursive task dispatcher that keeps workers balanced.
     */
    const dispatchTasks = (): void => {
      // Termination condition
      if (taskIndex >= taskList.length && activeWorkers === 0) {
        resultsManager.save();
        return resolve();
      }

      while (taskIndex < taskList.length && deviceManager.hasIdleDevices()) {
        // Concurrency cap
        if (activeWorkers >= expandedCapabilities.length) break;

        const device = deviceManager.getAvailableDevice();
        if (!device) break;

        const task = taskList[taskIndex++];
        deviceManager.markDeviceBusy(device.id);
        activeWorkers++;

        console.log(`▶  [${task.id}] → ${task.specPath.split('/').pop()} (data index: ${task.dataIndex})`);

        runWithRetry(configPath, task, device.capability, maxRetries, taskTimeout)
          .then(({ code, attempts }) => {
            const status: 'passed' | 'failed' = code === 0 ? 'passed' : 'failed';
            completed++;
            resultsManager.record(task, status, attempts);
            const icon = status === 'passed' ? '✅' : '❌';
            console.log(`${icon} [${task.id}] ${status.toUpperCase()} (attempts: ${attempts}) | ${completed}/${totalTasks} done`);
          })
          .catch((err: Error) => {
            completed++;
            resultsManager.record(task, 'failed', maxRetries + 1, err.message);
            console.error(`💥 [${task.id}] CRASHED: ${err.message} | ${completed}/${totalTasks} done`);
          })
          .finally(() => {
            deviceManager.markDeviceIdle(device.id);
            activeWorkers--;
            dispatchTasks();
          });
      }
    };

    dispatchTasks();
  });
}

/**
 * Executes a task with automatic retries on failure.
 */
async function runWithRetry(
  configPath: string, 
  task: Task, 
  capability: any, 
  maxRetries: number, 
  timeoutMs: number | null
): Promise<{ code: number; attempts: number }> {
  let attempts = 0;
  let lastCode = -1;

  while (attempts <= maxRetries) {
    attempts++;
    try {
      const code = await executeTask(configPath, task, capability, timeoutMs);
      lastCode = code;
      if (code === 0) return { code, attempts };
      
      if (attempts <= maxRetries) {
        console.warn(`⚠️  [${task.id}] failed (exit ${code}), retrying... (${attempts}/${maxRetries})`);
      }
    } catch (err: any) {
      if (attempts <= maxRetries) {
        console.warn(`⚠️  [${task.id}] error: ${err.message}, retrying... (${attempts}/${maxRetries})`);
      } else {
        throw err;
      }
    }
  }
  return { code: lastCode, attempts };
}
