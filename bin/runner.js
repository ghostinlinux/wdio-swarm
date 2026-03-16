#!/usr/bin/env node

import { program } from 'commander';
import path from 'path';
import fs from 'fs';
import xlsxModule from 'xlsx';
const xlsx = xlsxModule.default ? xlsxModule.default : xlsxModule;
import { parse as parseCsv } from 'csv-parse/sync';
import { executeRunner } from '../src/index.js';

program
  .name('wdio-data-runner')
  .description('Run WebdriverIO tests in parallel driven by external data')
  .requiredOption('-c, --config <path>', 'Path to WebdriverIO configuration file')
  .requiredOption('-d, --data <path>', 'Path to JSON data file containing an array of data objects')
  .option('-s, --spec <path>', 'Path to the specific spec file to run')
  .option(
    '--strategy <type>',
    'Execution strategy: "spec-first" (all users per spec) or "user-first" (all specs per user)',
    'spec-first'
  )
  .parse(process.argv);

const options = program.opts();

async function main() {
  const configPath = path.resolve(process.cwd(), options.config);
  const dataPath = path.resolve(process.cwd(), options.data);

  if (!fs.existsSync(configPath)) {
    console.error(`Error: Config file not found at ${configPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(dataPath)) {
    console.error(`Error: Data file not found at ${dataPath}`);
    process.exit(1);
  }

  try {
    let testData;

    if (dataPath.toLowerCase().endsWith('.xlsx') || dataPath.toLowerCase().endsWith('.xls')) {
      // --- Excel ---
      const workbook = xlsx.readFile(dataPath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      testData = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
    } else if (dataPath.toLowerCase().endsWith('.csv')) {
      // --- CSV ---
      const rawCsv = fs.readFileSync(dataPath, 'utf-8');
      testData = parseCsv(rawCsv, {
        columns: true,       // First row = column headers (same as Excel behaviour)
        skip_empty_lines: true,
        trim: true,          // Trim whitespace from values
      });
    } else {
      // --- JSON ---
      const rawData = fs.readFileSync(dataPath, 'utf-8');
      testData = JSON.parse(rawData);
    }

    if (!Array.isArray(testData)) {
       console.error(`Error: Data file must contain a JSON array of objects.`);
       process.exit(1);
    }
    
    console.log(`Loaded ${testData.length} records. Beginning parallel execution...`);
    await executeRunner(configPath, testData, options.spec, options.strategy);
    console.log('Test execution completed successfully across all data variations.');
    process.exit(0);

  } catch (error) {
    console.error('Execution Failed:', error);
    process.exit(1);
  }
}

main();
