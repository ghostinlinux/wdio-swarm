import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/configLoader.js';

// Currently configLoader uses dynamic import to load wdio.conf.js which is tightly coupled to the filesystem.
// Instead of complex mocking of dynamic imports, we verify the module API exists and errors handle correctly.

describe('configLoader', () => {
  it('should throw an error if the config file does not exist', async () => {
    // Wait for the rejection using standard async/await try/catch
    await expect(loadConfig('/invalid/path/does_not_exist.js')).rejects.toThrow();
  });

  // Note: testing a successful load requires a real file or complex mocking.
  // In pure module tests, catching the rejection path is the primary unit scope.
});
