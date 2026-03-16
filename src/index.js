import { loadConfig } from './configLoader.js';
import { DeviceManager } from './deviceManager.js';
import { TaskQueue } from './taskQueue.js';
import { executeTask } from './testExecutor.js';

// Re-export the resolver so end-users can import it from the package directly:
// import { resolveData } from 'wdio-data-runner';
export { resolveData, isRunnerActive } from './testDataResolver.js';

export async function executeRunner(configPath, testData, specOverride, strategy = 'spec-first') {
  console.log('Loading WDIO configuration...');
  const wdioConfig = await loadConfig(configPath);
  
  // Resolve devices and spec
  const capabilities = wdioConfig.capabilities || [];
  if (capabilities.length === 0) {
    throw new Error('No capabilities found in WDIO config');
  }
  
  const globalMax = wdioConfig.maxInstances || 1;
  const expandedCapabilities = [];
  capabilities.forEach(cap => {
      const limit = cap.maxInstances || globalMax;
      for (let i = 0; i < limit; i++) {
          expandedCapabilities.push(cap);
      }
  });

  const targetSpecs = specOverride ? [specOverride] : wdioConfig.specs;
  if (!targetSpecs || targetSpecs.length === 0) {
     throw new Error('No spec files provided in config or CLI args.');
  }

  const deviceManager = new DeviceManager(expandedCapabilities);
  const taskQueue = new TaskQueue(targetSpecs, testData, strategy);

  console.log(`Device Pool: ${capabilities.length} capabilities defined, expanded to ${expandedCapabilities.length} concurrent workers.`);
  console.log(`Strategy: ${strategy} | Generated ${taskQueue.getTotalTasks()} tasks in queue.`);

  return new Promise((resolve, reject) => {
    let activeWorkers = 0;
    let hasFailed = false;

    // The event loop that checks for tasks and free devices
    const dispatchTasks = () => {
      // If no tasks remain and no workers are active, we're done
      if (taskQueue.isEmpty() && activeWorkers === 0) {
        return resolve();
      }

      // If tasks remain, grab idle devices and start assigning them
      while (!taskQueue.isEmpty() && deviceManager.hasIdleDevices()) {
        if (activeWorkers >= globalMax) break;

        const device = deviceManager.getAvailableDevice();
        if (!device) break; // sanity check

        const task = taskQueue.getNextTask();
        
        // Mark device as busy
        deviceManager.markDeviceBusy(device.id);
        activeWorkers++;
        
        console.log(`Dispatching Task [${task.id}] on Device [${device.id}]`);
        // Execute the task via child process
        executeTask(configPath, task, device.capability)
          .then((code) => {
            if (code !== 0) hasFailed = true;
          })
          .catch((err) => {
            console.error(`Task ${task.id} crashed:`, err);
            hasFailed = true;
          })
          .finally(() => {
             // Free the worker and try to dispatch another task
             deviceManager.markDeviceIdle(device.id);
             activeWorkers--;
             dispatchTasks(); 
          });
      }
    };

    // Kick off the dispatch loop
    dispatchTasks();
  });
}
