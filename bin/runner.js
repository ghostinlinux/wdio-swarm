#!/usr/bin/env node

import { program } from 'commander';
import path from 'path';
import fs from 'fs';
import xlsxModule from 'xlsx';
const xlsx = xlsxModule.default ? xlsxModule.default : xlsxModule;
import { parse as parseCsv } from 'csv-parse/sync';
import { executeRunner } from '../src/index.js';

// --- Helper: resolve from env variable with optional default ---
function resolveEnv(key, defaultVal) {
  return process.env[key] || defaultVal || undefined;
}

// --- Helper: load WDR_FILTER env var as array ---
function resolveEnvFilters() {
  const envVal = process.env['WDR_FILTER'];
  return envVal ? [envVal] : [];
}

// --- Helper: accumulate --filter flags ---
function collectFilters(value, previous) {
  return previous.concat([value]);
}

// --- Helper: apply column=value filters (AND logic) ---
function applyFilters(data, filters) {
  if (!filters || filters.length === 0) return data;
  return data.filter(row => {
    return filters.every(f => {
      const eqIdx = f.indexOf('=');
      if (eqIdx === -1) {
        console.warn(`Warning: Invalid filter "${f}". Expected "Column=Value".`);
        return true;
      }
      const col = f.slice(0, eqIdx).trim();
      const val = f.slice(eqIdx + 1).trim();
      return String(row[col] ?? '').trim() === val;
    });
  });
}

program
  .name('wdio-swarm')
  .description('Data-driven parallel test runner for WebdriverIO.\nUnleash a swarm of workers from Excel, CSV, or JSON files.\nCLI flags override WDR_* env variables, which override defaults.')
  .requiredOption('-c, --config <path>', 'Path to WebdriverIO configuration file')
  .option('-d, --data <path>', 'Path to data file (.xlsx, .xls, .csv, .json)', resolveEnv('WDR_DATA'))
  .option('-s, --spec <path>', 'Specific spec file to run (default: all specs from config)', resolveEnv('WDR_SPEC'))
  .option('--strategy <type>', 'Queue strategy: "spec-first" | "user-first"', resolveEnv('WDR_STRATEGY', 'spec-first'))
  .option('--limit <number>', 'Process only the first N data rows', resolveEnv('WDR_LIMIT'))
  .option('--skip <number>', 'Skip the first N data rows (default: 0)', resolveEnv('WDR_SKIP', '0'))
  .option('--filter <Column=Value>', 'Filter rows by column value (repeatable for AND logic)', collectFilters, resolveEnvFilters())
  .option('--retries <number>', 'Retry a failed task N times (default: 0)', resolveEnv('WDR_RETRIES', '0'))
  .option('--task-timeout <seconds>', 'Kill a worker exceeding N seconds',  resolveEnv('WDR_TASK_TIMEOUT'))
  .option('--output <path>', 'Save run results JSON for re-run support', resolveEnv('WDR_OUTPUT'))
  .option('--rerun-failed <path>', 'Re-run only failed tasks from a previous results JSON file')
  .parse(process.argv);

const options = program.opts();

async function main() {
  const configPath = path.resolve(process.cwd(), options.config);

  if (!fs.existsSync(configPath)) {
    console.error(`Error: Config file not found at ${configPath}`);
    process.exit(1);
  }

  try {
    let testData;

    // ── Re-run mode ─────────────────────────────────────────────────────────
    if (options.rerunFailed) {
      const rerunPath = path.resolve(process.cwd(), options.rerunFailed);
      if (!fs.existsSync(rerunPath)) {
        console.error(`Error: Results file not found at ${rerunPath}`);
        process.exit(1);
      }
      const results = JSON.parse(fs.readFileSync(rerunPath, 'utf-8'));
      const failedTasks = results.filter(r => r.status === 'failed');
      if (failedTasks.length === 0) {
        console.log('✅ No failed tasks found. Nothing to re-run.');
        process.exit(0);
      }
      console.log(`🔁 Re-run mode: ${failedTasks.length} failed task(s) found.`);
      // Set isRerun=true so executeRunner builds tasks directly from
      // each record's own spec+data (no cross-product with config specs)
      options.isRerun = true;
      await executeRunner(configPath, failedTasks, options);
      console.log('Re-run completed.');
      process.exit(0);
    }

    // ── Normal mode ─────────────────────────────────────────────────────────
    if (!options.data) {
      console.error('Error: --data is required (or set WDR_DATA in your .env).');
      process.exit(1);
    }

    const dataPath = path.resolve(process.cwd(), options.data);
    if (!fs.existsSync(dataPath)) {
      console.error(`Error: Data file not found at ${dataPath}`);
      process.exit(1);
    }

    if (dataPath.toLowerCase().endsWith('.xlsx') || dataPath.toLowerCase().endsWith('.xls')) {
      // Excel
      const workbook = xlsx.readFile(dataPath);
      const sheetName = workbook.SheetNames[0];
      testData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    } else if (dataPath.toLowerCase().endsWith('.csv')) {
      // CSV
      testData = parseCsv(fs.readFileSync(dataPath, 'utf-8'), {
        columns: true, skip_empty_lines: true, trim: true,
      });
    } else {
      // JSON
      testData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    }

    if (!Array.isArray(testData)) {
      console.error('Error: Data file must contain a JSON array of objects.');
      process.exit(1);
    }

    // Feature 2: Filter
    testData = applyFilters(testData, options.filter);

    // Feature 1: Skip & Limit
    const skip  = parseInt(options.skip)  || 0;
    const limit = parseInt(options.limit) || undefined;
    testData = testData.slice(skip, limit ? skip + limit : undefined);

    if (testData.length === 0) {
      console.warn('⚠️  No data rows remain after applying filters/limit/skip. Nothing to run.');
      process.exit(0);
    }

    console.log(`Loaded ${testData.length} record(s). Beginning parallel execution...`);
    await executeRunner(configPath, testData, options);
    console.log('✅ Test execution completed successfully across all data variations.');
    process.exit(0);

  } catch (error) {
    console.error('Execution Failed:', error);
    process.exit(1);
  }
}

main();
