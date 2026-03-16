# wdio-swarm 🐝

> **Data-driven parallel test runner for WebdriverIO.**  
> Unleash a swarm of workers from Excel, CSV, or JSON — no code changes needed in your config.

[![npm](https://img.shields.io/npm/v/wdio-swarm)](https://www.npmjs.com/package/wdio-swarm)
[![license](https://img.shields.io/npm/l/wdio-swarm)](LICENSE)

---

## Why wdio-swarm?

Native WebdriverIO parallelizes at the **file** level. If you have 1 spec and 100 users in an Excel sheet, WDIO runs them **sequentially** on 1 device — no matter how many devices you have.

`wdio-swarm` parallelizes at the **data** level:

```
1 spec + 100 Excel rows  →  100 parallel workers, each with a unique user payload
```

---

## Getting Started

### Step 1 — Install

```bash
npm install wdio-swarm
```

---

### Step 2 — Prepare your data file

Your data file can be **Excel, CSV, or JSON**. Each row becomes one parallel test execution.

**Excel / CSV** — each column header becomes an environment variable for the worker:

| Username   | Role  | Region |
|------------|-------|--------|
| user_001   | admin | US     |
| user_002   | basic | EU     |

**JSON** — an array of objects:
```json
[
  { "Username": "user_001", "Role": "admin", "Region": "US" },
  { "Username": "user_002", "Role": "basic", "Region": "EU" }
]
```

---

### Step 3 — Update your spec file

Use `resolveData` to make your spec work in **both normal WDIO mode and swarm mode**:

```javascript
import { resolveData } from 'wdio-swarm';

// ✅ In swarm mode  → reads 'Username' column from the current Excel/JSON row
// ✅ In normal mode → reads 'MY_ENV_USERNAME' from your local .env file
const testUser = resolveData('Username', 'MY_ENV_USERNAME');
```

> **Note:** If your test does **not** use external data and always reads from `.env`, you can skip this step entirely.

---

### Step 4 — Add a script to `package.json`

```json
{
  "scripts": {
    "test:swarm": "wdio-swarm --config config/wdio.conf.js"
  }
}
```

---

### Step 5 — Run it

```bash
npm run test:swarm -- --data users.xlsx
```

The runner will:
1. Load all rows from `users.xlsx`
2. Read specs and `maxInstances` from your `wdio.conf.js`
3. Build a task queue (`spec × data row` combinations)
4. Dispatch parallel workers — keeping your devices fully utilized until all rows are processed

---

## All Features & Commands

### Execution Strategy

Control the order in which spec × data tasks are queued.

```bash
# spec-first (default) — complete all users through Spec 1, then Spec 2...
npm run test:swarm -- --data users.xlsx --strategy spec-first

# user-first — run all specs for User 1, then all specs for User 2...
npm run test:swarm -- --data users.xlsx --strategy user-first
```

---

### Row Limit & Skip

Process a subset of rows — useful for debugging or splitting across CI machines.

```bash
# Run only the first 10 rows
npm run test:swarm -- --data users.xlsx --limit 10

# Skip the first 20 rows, run all remaining
npm run test:swarm -- --data users.xlsx --skip 20

# Process rows 21–30 only
npm run test:swarm -- --data users.xlsx --skip 20 --limit 10
```

---

### Data Filtering

Filter rows by column value at runtime. Multiple `--filter` flags use **AND** logic.

```bash
# Only admin users
npm run test:swarm -- --data users.xlsx --filter "Role=admin"

# Only admin users in the US region
npm run test:swarm -- --data users.xlsx --filter "Role=admin" --filter "Region=US"
```

---

### Retry on Failure

Automatically retry a failed worker up to N times before marking it as failed.

```bash
npm run test:swarm -- --data users.xlsx --retries 2
```

---

### Task Timeout

Kill any worker that runs longer than N seconds (prevents hung devices from blocking the queue).

```bash
npm run test:swarm -- --data users.xlsx --task-timeout 300
```

---

### Save Results & Re-run Failures

Save every task's outcome to a JSON file. On the next run, replay only the failures — without re-reading the original data file.

```bash
# Run 1 — saves results to run1.json
npm run test:swarm -- --data users.xlsx --output run1.json

# Run 2 — re-runs only the tasks that failed in Run 1
npm run test:swarm -- --rerun-failed run1.json
```

**Output file format:**
```json
[
  {
    "status": "failed",
    "spec": "test/specs/login.test.js",
    "data": { "Username": "user_001", "Role": "admin", "Region": "US" }
  },
  {
    "status": "passed",
    "spec": "test/specs/login.test.js",
    "data": { "Username": "user_002", "Role": "basic", "Region": "EU" }
  }
]
```

---

### Run a Specific Spec

Override the specs in your config and target a single file.

```bash
npm run test:swarm -- --data users.xlsx --spec test/specs/login.test.js
```

---

### Combining Multiple Features

```bash
npm run test:swarm -- \
  --data users.xlsx \
  --filter "Role=admin" \
  --skip 10 \
  --limit 50 \
  --retries 2 \
  --task-timeout 300 \
  --strategy user-first \
  --output results.json
```

---

## .env Support

Every CLI flag has a `WDR_*` environment variable equivalent.  
**Priority:** `CLI flag > .env variable > default value`

```env
# .env — set once, no need to pass on every command
WDR_DATA=data/users.xlsx
WDR_STRATEGY=user-first
WDR_RETRIES=2
WDR_TASK_TIMEOUT=300
WDR_LIMIT=50
WDR_SKIP=0
WDR_FILTER=Role=admin
WDR_OUTPUT=results.json
```

---

## CLI Reference

```
Usage: wdio-swarm [options]

Options:
  -c, --config <path>         Path to WebdriverIO configuration file  [required]
  -d, --data <path>           Path to data file (.xlsx, .xls, .csv, .json)
  -s, --spec <path>           Specific spec file to run
  --strategy <type>           spec-first | user-first  (default: spec-first)
  --limit <number>            Process only the first N rows
  --skip <number>             Skip the first N rows  (default: 0)
  --filter <Column=Value>     Filter rows by column (repeatable)
  --retries <number>          Retry a failed task N times  (default: 0)
  --task-timeout <seconds>    Kill a worker exceeding N seconds
  --output <path>             Save run results to a JSON file
  --rerun-failed <path>       Re-run only failures from a previous results file
  -h, --help                  Show help
```

---

## How It Works Internally

```
wdio-swarm --config wdio.conf.js --data users.xlsx
     │
     ├─ 1. Reads all rows from users.xlsx → [ {row1}, {row2}, ... ]
     ├─ 2. Reads wdio.conf.js → specs[], maxInstances, capabilities[]
     ├─ 3. Applies --filter / --skip / --limit
     ├─ 4. Builds task queue using strategy (spec × data row combinations)
     └─ 5. Dispatches up to maxInstances parallel WDIO child processes
              │
              ├─ Worker 1: npx wdio run wdio.conf.js --spec login.js  (row 1 injected via env)
              ├─ Worker 2: npx wdio run wdio.conf.js --spec login.js  (row 2 injected via env)
              └─ Worker 3: npx wdio run wdio.conf.js --spec login.js  (row 3 injected via env)
```

Each worker receives its data row as environment variables (`process.env`), which your spec reads via `resolveData()`.

---

## License

ISC
