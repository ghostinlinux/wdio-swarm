/**
 * testDataResolver.js
 * 
 * Centralized utility exported by the `wdio-swarm` package.
 * Allows any spec file to resolve test data values without knowing
 * whether the runner is active or not.
 *
 * Usage in any spec:
 *   import { resolveData } from 'wdio-swarm';
 *   const memberID = resolveData('InsuranceNbr', `${env}_memberIDNationsAndroid`);
 */

const getIsDataRunnerActive = () => process.env.WDR_ACTIVE === 'true';

/**
 * Resolves a value either from the data runner's injected row (Excel/JSON column)
 * or from the standard .env fallback key.
 *
 * @param {string} dataColumn  - Excel/JSON column name injected by the runner (e.g., 'InsuranceNbr')
 * @param {string} envFallback - The .env key to use when NOT in data runner mode
 * @returns {string|undefined}
 */
export function resolveData(dataColumn, envFallback) {
  if (getIsDataRunnerActive()) {
    return process.env[dataColumn];
  }
  return process.env[envFallback];
}

/**
 * Returns true if the WDIO Data Runner is currently orchestrating this execution.
 */
export function isRunnerActive() {
  return getIsDataRunnerActive();
}
