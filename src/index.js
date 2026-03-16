import { loadConfig } from './configLoader.js';
import { DeviceManager } from './deviceManager.js';
import { TaskQueue } from './taskQueue.js';
import { executeTask } from './testExecutor.js';
import { ResultsManager } from './resultsManager.js';

// Re-export the resolver so end-users can import it from the package directly:
// import { resolveData } from 'wdio-swarm';
export { resolveData, isRunnerActive } from './testDataResolver.js';

/**
 * @param {string}   configPath  - Absolute path to WDIO config
 * @param {object[]} testData    - Parsed data rows (already sliced/filtered by runner.js)
 * @param {object}   options     - CLI options object from commander
 */
export async function executeRunner(configPath, testData, options = {}) {
  const strategy     = options.strategy    || 'spec-first';
  const maxRetries   = parseInt(options.retries)      || 0;
  const taskTimeout  = options.taskTimeout ? parseInt(options.taskTimeout) * 1000 : null;
  const outputPath   = options.output      || null;
  const specOverride = options.spec        || null;
  const isRerun      = options.isRerun     || false;

  console.log('Loading WDIO configuration...');
  const wdioConfig = await loadConfig(configPath);

  // Expand capabilities up to maxInstances
  const capabilities = wdioConfig.capabilities || [];
  if (capabilities.length === 0) throw new Error('No capabilities found in WDIO config');

  const globalMax = wdioConfig.maxInstances || 1;
  const expandedCapabilities = [];
  capabilities.forEach(cap => {
    const limit = cap.maxInstances || globalMax;
    for (let i = 0; i < limit; i++) expandedCapabilities.push(cap);
  });

  let taskList;

  if (isRerun) {
    // Re-run mode: each item in testData is a failed result record with its own spec.
    // Build tasks directly — NO cross-product with config specs.
    taskList = testData.map((record, idx) => ({
      id: `rerun_${idx}`,
      specPath: record.spec,
      data: record.data,
      dataIndex: record.dataIndex ?? idx,
    }));
  } else {
    // Normal mode: cross specs × data rows via TaskQueue
    const targetSpecs = specOverride ? [specOverride] : wdioConfig.specs;
    if (!targetSpecs || targetSpecs.length === 0) {
      throw new Error('No spec files provided in config or CLI args.');
    }
    const q = new TaskQueue(targetSpecs, testData, strategy);
    taskList = [];
    while (!q.isEmpty()) taskList.push(q.getNextTask());
  }

  const deviceManager  = new DeviceManager(expandedCapabilities);
  const resultsManager = new ResultsManager(outputPath);
  const totalTasks     = taskList.length;

  console.log(`Device Pool: ${capabilities.length} capability(ies), expanded to ${expandedCapabilities.length} concurrent workers.`);
  if (!isRerun) console.log(`Strategy: ${strategy}`);
  console.log(`Total tasks: ${totalTasks}`);
  if (maxRetries > 0) console.log(`Retries: up to ${maxRetries} per task`);
  if (taskTimeout)    console.log(`Task timeout: ${taskTimeout / 1000}s`);

  return new Promise((resolve, reject) => {
    let activeWorkers = 0;
    let completed     = 0;
    let taskIndex     = 0; // pointer into taskList

    const dispatchTasks = () => {
      // All done?
      if (taskIndex >= taskList.length && activeWorkers === 0) {
        resultsManager.save();
        return resolve();
      }

      while (taskIndex < taskList.length && deviceManager.hasIdleDevices()) {
        if (activeWorkers >= globalMax) break;

        const device = deviceManager.getAvailableDevice();
        if (!device) break;

        const task = taskList[taskIndex++];
        deviceManager.markDeviceBusy(device.id);
        activeWorkers++;

        console.log(`▶  [${task.id}] → ${task.specPath.split('/').pop()} (data index: ${task.dataIndex})`);

        runWithRetry(configPath, task, device.capability, maxRetries, taskTimeout)
          .then(({ code, attempts }) => {
            const status = code === 0 ? 'passed' : 'failed';
            completed++;
            resultsManager.record(task, status, attempts);
            const icon = status === 'passed' ? '✅' : '❌';
            console.log(`${icon} [${task.id}] ${status.toUpperCase()} (attempts: ${attempts}) | ${completed}/${totalTasks} done`);
          })
          .catch(err => {
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
 * Feature 4: Retry on failure
 * Feature 3: Timeout — kills the worker if it runs too long
 */
async function runWithRetry(configPath, task, capability, maxRetries, timeoutMs) {
  let attempts = 0;
  let lastCode = -1;

  while (attempts <= maxRetries) {
    attempts++;
    try {
      const code = await executeTask(configPath, task, capability, timeoutMs);
      lastCode = code;
      if (code === 0) return { code, attempts };
      // non-zero exit — retry if attempts remaining
      if (attempts <= maxRetries) {
        console.warn(`⚠️  [${task.id}] failed (exit ${code}), retrying... (${attempts}/${maxRetries})`);
      }
    } catch (err) {
      // timeout or crash
      if (attempts <= maxRetries) {
        console.warn(`⚠️  [${task.id}] error: ${err.message}, retrying... (${attempts}/${maxRetries})`);
      } else {
        throw err;
      }
    }
  }
  return { code: lastCode, attempts };
}
