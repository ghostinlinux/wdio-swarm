# wdio-swarm 🐝

[![npm version](https://img.shields.io/npm/v/wdio-swarm.svg?style=flat-square)](https://www.npmjs.com/package/wdio-swarm)
[![npm downloads](https://img.shields.io/npm/dm/wdio-swarm.svg?style=flat-square)](https://www.npmjs.com/package/wdio-swarm)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=flat-square)](https://opensource.org/licenses/ISC)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

**wdio-swarm** is a high-performance, data-driven orchestration layer for WebdriverIO. It enables massive parallelization at the **data level**, allowing you to execute a single specification across hundreds of data rows simultaneously — something native WebdriverIO cannot do out of the box.

---

## 🚀 Key Features

*   **⚡ Data-Level Parallelism**: Distribute Excel/CSV/JSON rows across multiple workers instantly.
*   **🛠 No-Config Integration**: Works with your existing `wdio.conf.js` without any modifications.
*   **🧩 Smart Orchestration**: Advanced task queuing with `spec-first` or `user-first` strategies.
*   **🛡 Enterprise Resiliency**: Built-in retry logic, task timeouts, and selective re-running of failed tasks.
*   **🔍 Runtime Filtering**: Execute specific subsets of data using powerful CLI filters.
*   **📦 Type-Safe**: Written in 100% TypeScript for reliable, type-safe automation.

---

## 📖 Table of Contents
- [Installation](#-installation)
- [How it Works](#-how-it-works)
- [Quick Start](#-quick-start)
- [CLI Reference](#-cli-reference)
- [.env Integration](#-env-integration)

---

## 📥 Installation

```bash
npm install wdio-swarm
```

---

## 🧠 How it Works

Native WebdriverIO parallelizes at the **spec file** level. If you have 1 spec and 100 rows of data, WDIO runs them sequentially. 

**wdio-swarm** modifies this behavior:
1. It parses your data source (Excel, CSV, or JSON).
2. It breaks every row into a unique "Task."
3. It "swarms" your available devices/workers, injecting row data into each process.

> **Result:** 1 Spec + 100 Rows = 100 Parallel Executions (limited only by your `maxInstances`).

---

## ⚡ Quick Start

### 1. Prepare your Data
Create a data file (`data.xlsx`, `data.csv`, or `data.json`). Column headers represent the environment variables injected into your tests.

| Username   | Role  | Region |
|------------|-------|--------|
| user_001   | admin | US     |
| user_002   | basic | EU     |

> **Note:** You can name your data file anything you like (e.g., `members.xlsx` or `prod_data.json`). The filename `data.xlsx` used in these examples is just a placeholder.

### 2. Update your Spec
Use the `resolveData` helper to bridge the gap between local development and swarm execution.

```typescript
import { resolveData } from 'wdio-swarm';

describe('Login Suite', () => {
    it('should login user', async () => {
        // Reads 'Username' from current data file, or 'DEFAULT_USER' from .env
        const user = resolveData('Username', 'DEFAULT_USER');
        
        // ... your test logic
    });
});
```

### 3. Run the Swarm
```bash
npx wdio-swarm --config config/wdio.conf.js --data data.xlsx
```

---

---

## ⚙️ Advanced Usage

### Execution Strategies
*   `spec-first` (Default): Finish all data rows for Spec A, then move to Spec B.
*   `user-first`: Run all applicable specs for User 1, then all for User 2.

```bash
# Run all specs for User 1 before moving to User 2
npx wdio-swarm -c wdio.conf.js -d data.xlsx --strategy user-first
```

### Selective Re-runs
If only a few tasks fail, re-run only the failures without re-reading the original data file.

```bash
# Save results
npx wdio-swarm -c wdio.conf.js -d data.xlsx --output results.json

# Re-run ONLY the failures
npx wdio-swarm -c wdio.conf.js --rerun-failed results.json
```

### Runtime Filtering
Filter your target data dynamically without editing the file.

```bash
# Run only 'admin' users in the 'US' region
npx wdio-swarm -c wdio.conf.js -d data.xlsx --filter "Role=admin" --filter "Region=US"
```

---

## 🛠 CLI Reference

| Option | Description | Environment Variable | Default |
| :--- | :--- | :--- | :--- |
| `-c, --config` | **Required.** Path to your WebdriverIO config. | - | - |
| `-d, --data` | Path to data source (.xlsx, .csv, .json). | `WDR_DATA` | - |
| `-s, --spec` | Run a specific spec file (overrides config). | - | - |
| `--strategy` | Task queuing strategy (`spec-first` \| `user-first`). | `WDR_STRATEGY` | `spec-first` |
| `--limit` | Only process the first N rows of data. | `WDR_LIMIT` | - |
| `--skip` | Skip the first N rows of data. | `WDR_SKIP` | `0` |
| `--filter` | Filter by `Column=Value` (Repeatable). | `WDR_FILTER` | - |
| `--retries` | Number of retries for failed tasks. | `WDR_RETRIES` | `0` |
| `--task-timeout`| Max time in seconds for a single worker. | `WDR_TASK_TIMEOUT` | - |
| `--output` | Path to save JSON results. | `WDR_OUTPUT` | - |
| `--rerun-failed` | Re-run failures from a results file. | - | - |

---

## 🔐 .env Integration

Every CLI flag can be pre-configured in your `.env` file or environment using the `WDR_` prefix.

| Option | .env / Environment Variable |
| :--- | :--- |
| `--data` | `WDR_DATA` |
| `--strategy` | `WDR_STRATEGY` |
| `--limit` | `WDR_LIMIT` |
| `--skip` | `WDR_SKIP` |
| `--filter` | `WDR_FILTER` |
| `--retries` | `WDR_RETRIES` |
| `--task-timeout`| `WDR_TASK_TIMEOUT` |
| `--output` | `WDR_OUTPUT` |

```bash
# Example .env file
WDR_DATA=data/users.xlsx
WDR_STRATEGY=user-first
WDR_RETRIES=2
WDR_TASK_TIMEOUT=300
```

## 📦 NPM Script Usage

You can also configure wdio-swarm as an npm script for easier execution.

Add Script to package.json
```bash
"scripts": {
  "wdio-swarm:run:android": "wdio-swarm --config config/wdio.conf.js"
}
```
Run with Data File [Any CLI options you can choose]
```bash
npm run wdio-swarm:run:android -- --data data.xlsx
```
---

## 📄 License
ISC © [Pratik Kumar](https://github.com/ghostinlinux)
