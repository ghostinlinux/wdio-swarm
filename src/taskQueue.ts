/**
 * Interface representing a test task (combination of a spec and a data row).
 */
export interface Task {
  id: string;
  specPath: string;
  data: any;
  dataIndex: number;
}

/**
 * TaskQueue
 *
 * Orquestrates the cross-product of specifications and data rows into a processable queue.
 */
export class TaskQueue {
  public queue: Task[];

  /**
   * @param {string[]} specs     - List of spec file paths.
   * @param {any[]}    testData  - Array of data rows (one per user/record).
   * @param {string}   strategy  - 'spec-first' (default) | 'user-first'.
   */
  constructor(specs: string[], testData: any[], strategy: string = 'spec-first') {
    this.queue = [];
    let taskId = 0;

    if (strategy === 'user-first') {
      // user-first: all specs for user1 queue before any spec for user2
      for (let i = 0; i < testData.length; i++) {
        for (const spec of specs) {
          this.queue.push({
            id: `task_${taskId++}`,
            specPath: spec,
            data: testData[i],
            dataIndex: i,
          });
        }
      }
    } else {
      // spec-first (default): all users for spec1 queue before any user for spec2
      for (const spec of specs) {
        for (let i = 0; i < testData.length; i++) {
          this.queue.push({
            id: `task_${taskId++}`,
            specPath: spec,
            data: testData[i],
            dataIndex: i,
          });
        }
      }
    }
  }

  /**
   * Checks if the queue has no more tasks.
   * @returns {boolean}
   */
  public isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Pulls the next task from the queue for processing.
   * @returns {Task | undefined}
   */
  public getNextTask(): Task | undefined {
    return this.queue.shift();
  }

  /**
   * Returns the current total count of tasks in the queue.
   * @returns {number}
   */
  public getTotalTasks(): number {
    return this.queue.length;
  }
}
