export class TaskQueue {
  /**
   * @param {string[]} specs     - List of spec file paths
   * @param {object[]} testData  - Array of data rows (one per user/record)
   * @param {string}   strategy  - 'spec-first' (default) | 'user-first'
   */
  constructor(specs, testData, strategy = 'spec-first') {
    this.queue = [];
    let taskId = 0;

    if (strategy === 'user-first') {
      // user-first: all specs for user1 queue before any spec for user2
      // Result: spec1+u1, spec2+u1, spec3+u1 ... spec5+u1, spec1+u2, spec2+u2 ...
      for (let i = 0; i < testData.length; i++) {
        for (const spec of specs) {
          this.queue.push({ id: `task_${taskId++}`, specPath: spec, data: testData[i], dataIndex: i });
        }
      }
    } else {
      // spec-first (default): all users for spec1 queue before any user for spec2
      // Result: spec1+u1, spec1+u2 ... spec1+u50, spec2+u1, spec2+u2 ...
      for (const spec of specs) {
        for (let i = 0; i < testData.length; i++) {
          this.queue.push({ id: `task_${taskId++}`, specPath: spec, data: testData[i], dataIndex: i });
        }
      }
    }
  }

  isEmpty() {
    return this.queue.length === 0;
  }

  getNextTask() {
    return this.queue.shift(); // FIFO order processing
  }

  getTotalTasks() {
    return this.queue.length;
  }
}
