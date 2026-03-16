import fs from 'fs';
import path from 'path';

/**
 * Feature 6: ResultsManager
 * Tracks the outcome of each task during a run and optionally persists to a JSON file.
 * The saved file can be passed to --rerun-failed on the next run.
 */
export class ResultsManager {
  constructor(outputPath) {
    this.outputPath = outputPath
      ? path.resolve(process.cwd(), outputPath)
      : null;
    this.results = [];
  }

  /**
   * Record the result of a single task.
   * @param {object} task       - The task object (specPath, data, dataIndex, id)
   * @param {string} status     - 'passed' | 'failed'
   * @param {number} attempts   - How many attempts were made (includes first)
   * @param {string} [error]    - Error message if failed
   */
  record(task, status, attempts = 1, error = undefined) {
    this.results.push({
      status,
      attempts,
      spec: task.specPath,
      dataIndex: task.dataIndex,
      data: task.data,
      ...(error ? { error } : {}),
    });
  }

  /**
   * Write results to the output JSON file (if --output was set).
   */
  save() {
    if (!this.outputPath) return;
    try {
      fs.writeFileSync(this.outputPath, JSON.stringify(this.results, null, 2), 'utf-8');
      console.log(`\n📄 Results saved to: ${this.outputPath}`);

      const passed = this.results.filter(r => r.status === 'passed').length;
      const failed = this.results.filter(r => r.status === 'failed').length;
      console.log(`   ✅ Passed: ${passed} | ❌ Failed: ${failed} | Total: ${this.results.length}`);
      if (failed > 0) {
        console.log(`   💡 Re-run failures: wdio-data-runner --config <path> --rerun-failed ${this.outputPath}`);
      }
    } catch (err) {
      console.error(`Error saving results to ${this.outputPath}:`, err.message);
    }
  }

  /** Returns all recorded results */
  getResults() {
    return this.results;
  }
}
