import fs from 'fs';
import path from 'path';
import type { Task } from './taskQueue.js';

export interface TestResult {
  status: 'passed' | 'failed' | 'skipped';
  attempts: number;
  spec: string;
  dataIndex: number;
  data: any;
  error?: string;
}

/**
 * ResultsManager
 *
 * Tracks outcomes and persists them to JSON for re-run support.
 */
export class ResultsManager {
  private outputPath: string | null;
  public results: TestResult[];

  constructor(outputPath?: string | null) {
    this.outputPath = outputPath ? path.resolve(process.cwd(), outputPath) : null;
    this.results = [];
  }

  /**
   * Records the result of a task execution.
   */
  public record(
    task: Task,
    status: 'passed' | 'failed' | 'skipped',
    attempts: number = 1,
    error?: string,
  ): void {
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
   * Persists recorded results to a JSON file if an output path was provided.
   */
  public save(): void {
    if (!this.outputPath) return;
    try {
      fs.writeFileSync(this.outputPath, JSON.stringify(this.results, null, 2), 'utf-8');
      console.log(`\n📄 Results saved to: ${this.outputPath}`);

      const passed = this.results.filter((r) => r.status === 'passed').length;
      const failed = this.results.filter((r) => r.status === 'failed').length;
      console.log(`   ✅ Passed: ${passed} | ❌ Failed: ${failed} | Total: ${this.results.length}`);

      if (failed > 0) {
        console.log(
          `   💡 Re-run failures: wdio-swarm --config <path> --rerun-failed ${this.outputPath}`,
        );
      }
    } catch (err: any) {
      console.error(`Error saving results to ${this.outputPath}:`, err.message);
    }
  }

  /**
   * Static utility to load failed/skipped tasks from a results JSON file.
   */
  public static loadFailedTasks(filePath: string): TestResult[] {
    const absolutePath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(absolutePath)) return [];

    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      const results: TestResult[] = JSON.parse(content);
      return results.filter((r) => r.status === 'failed' || r.status === 'skipped');
    } catch (err) {
      return [];
    }
  }

  public getResults(): TestResult[] {
    return this.results;
  }
}
