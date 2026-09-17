#!/usr/bin/env tsx
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
const { readFile, utils } = xlsx;
import { parse as parseCsv } from 'csv-parse/sync';
import { executeRunner } from '../src/index.js';
import { ResultsManager } from '../src/resultsManager.js';

// Resolve wdio-swarm's own package.json by walking up from this file, not the
// consuming project's cwd (which has its own, unrelated package.json).
function findOwnPackageJson(startDir: string): string {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('Could not locate wdio-swarm package.json');
    dir = parent;
  }
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagePath = findOwnPackageJson(__dirname);
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const program = new Command();

program
  .name('wdio-swarm')
  .description('Data-driven parallel test runner for WebdriverIO')
  .version(pkg.version)
  .requiredOption('-c, --config <path>', 'Path to WebdriverIO configuration file')
  .option(
    '-d, --data <path>',
    'Path to test data file (.xlsx, .xls, .csv, .json)',
    process.env.WDR_DATA,
  )
  .option('-s, --spec <path>', 'Specific spec file to run (overrides config)')
  .option(
    '--strategy <type>',
    'Execution strategy: spec-first or user-first',
    process.env.WDR_STRATEGY || 'spec-first',
  )
  .option('--limit <number>', 'Only process the first N rows of data', process.env.WDR_LIMIT)
  .option('--skip <number>', 'Skip the first N rows of data', process.env.WDR_SKIP || '0')
  .option(
    '--filter <Column=Value>',
    'Filter data by column values (can be repeated)',
    (val, memo: string[]) => {
      memo.push(val);
      return memo;
    },
    process.env.WDR_FILTER ? [process.env.WDR_FILTER] : [],
  )
  .option(
    '--retries <number>',
    'Number of retries for failed tasks',
    process.env.WDR_RETRIES || '0',
  )
  .option(
    '--task-timeout <seconds>',
    'Maximum time allowed for a single task',
    process.env.WDR_TASK_TIMEOUT,
  )
  .option('--output <path>', 'Save results to a JSON file', process.env.WDR_OUTPUT)
  .option(
    '--max-workers <number>',
    'Hard cap on concurrent workers, regardless of maxInstances',
    process.env.WDR_MAX_WORKERS,
  )
  .option('--rerun-failed <path>', 'Re-run only failed tasks from a results JSON file')
  .showHelpAfterError();

program.parse();

const options = program.opts();

/**
 * Main execution block
 */
async function main() {
  try {
    const configPath = path.resolve(process.cwd(), options.config);
    if (!fs.existsSync(configPath)) {
      console.error(`Error: WebdriverIO config not found at ${configPath}`);
      process.exit(1);
    }

    let testData: any[] = [];

    // --- CASE A: Re-run mode ---
    if (options.rerunFailed) {
      console.log(`♻️  Re-run mode: loading failures from ${options.rerunFailed}`);
      testData = ResultsManager.loadFailedTasks(options.rerunFailed);

      if (testData.length === 0) {
        console.log('✨ No failed tasks found to re-run. Exiting.');
        process.exit(0);
      }
      console.log(`✅ ${testData.length} failed task(s) found.`);
      await executeRunner(options.config, testData, { ...options, isRerun: true });
      process.exit(0);
    }

    // --- CASE B: Normal mode ---
    if (!options.data) {
      console.error('Error: --data or --rerun-failed is required.');
      process.exit(1);
    }

    const dataPath = path.resolve(process.cwd(), options.data);
    if (!fs.existsSync(dataPath)) {
      console.error(`Error: Data file not found at ${dataPath}`);
      process.exit(1);
    }

    // Load and parse data
    if (dataPath.endsWith('.json')) {
      testData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } else if (dataPath.endsWith('.csv')) {
      testData = parseCsv(fs.readFileSync(dataPath, 'utf8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } else {
      const workbook = readFile(dataPath);
      testData = utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    }

    // 1. Data Filtering
    if (options.filter && options.filter.length > 0) {
      options.filter.forEach((f: string) => {
        const [col, val] = f.split('=');
        if (col && val) {
          testData = testData.filter(
            (row) => String(row[col] || '').toLowerCase() === val.toLowerCase(),
          );
        }
      });
    }

    // 2. Slicing (Skip/Limit)
    const skip = parseInt(options.skip) || 0;
    const limit = parseInt(options.limit);
    testData = testData.slice(skip, limit ? skip + limit : undefined);

    if (testData.length === 0) {
      console.error('Error: No data rows found after filtering/skipping.');
      process.exit(1);
    }

    await executeRunner(options.config, testData, options);
  } catch (err: any) {
    console.error(`\n❌ Runner failed: ${err.message}`);
    process.exit(1);
  }
}

main();
