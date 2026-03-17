/**
 * testDataResolver.ts
 *
 * Centralized utility exported by the `wdio-swarm` package.
 * Allows any spec file to resolve test data values without knowing
 * whether the runner is active or not.
 */

/**
 * Checks if the WDIO Swarm runner is currently active by examining the environment.
 * @returns {boolean} True if the runner is orchestrating the current execution.
 */
const getIsDataRunnerActive = (): boolean => process.env.WDR_ACTIVE === 'true';

/**
 * Resolves a value either from the data runner's injected row (Excel/JSON column)
 * or from the standard .env fallback key.
 *
 * @param {string} dataColumn  - The property/column name injected by the runner (e.g., 'Username')
 * @param {string} envFallback - The .env key to use when NOT in data runner mode
 * @returns {string | undefined} The resolved value or undefined if not found.
 */
export function resolveData(dataColumn: string, envFallback: string): string | undefined {
  if (getIsDataRunnerActive()) {
    return process.env[dataColumn];
  }
  return process.env[envFallback];
}

/**
 * Public API to check if the WDIO Swarm runner is currently orchestrating this execution.
 * @returns {boolean} True if swarm mode is active.
 */
export function isRunnerActive(): boolean {
  return getIsDataRunnerActive();
}
