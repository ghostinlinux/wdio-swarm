import { describe, it, expect } from 'vitest';
import { TaskQueue, type Task } from '../src/taskQueue.js';

describe('TaskQueue', () => {
  const sampleSpecs = ['spec1.js', 'spec2.js'];
  const sampleData = [
    { id: 1, name: 'alice', role: 'admin' },
    { id: 2, name: 'bob', role: 'user' },
    { id: 3, name: 'charlie', role: 'admin' },
  ];

  describe('Core queue building', () => {
    it('should build spec-first queues correctly', () => {
      const queue = new TaskQueue(sampleSpecs, sampleData, 'spec-first');
      const tasks: Task[] = queue.queue; 
      expect(tasks.length).toBe(6); // 2 specs * 3 users
      
      // Spec first: all users do spec1, then all users do spec2
      expect(tasks[0].specPath).toBe('spec1.js');
      expect(tasks[0].dataIndex).toBe(0);
      expect(tasks[2].specPath).toBe('spec1.js');
      expect(tasks[2].dataIndex).toBe(2);
      expect(tasks[3].specPath).toBe('spec2.js');
      expect(tasks[3].dataIndex).toBe(0);
    });

    it('should build user-first queues correctly', () => {
      const queue = new TaskQueue(sampleSpecs, sampleData, 'user-first');
      const tasks: Task[] = queue.queue;
      expect(tasks.length).toBe(6);
      
      // User first: user1 does all specs, then user2 does all specs
      expect(tasks[0].specPath).toBe('spec1.js');
      expect(tasks[0].dataIndex).toBe(0);
      expect(tasks[1].specPath).toBe('spec2.js');
      expect(tasks[1].dataIndex).toBe(0);
      expect(tasks[2].specPath).toBe('spec1.js');
      expect(tasks[2].dataIndex).toBe(1);
    });
  });

  describe('Queue Management', () => {
    it('should dispense tasks properly', () => {
      const queue = new TaskQueue(['s1'], [{ id: 1 }], 'spec-first');
      expect(queue.isEmpty()).toBe(false);
      expect(queue.getTotalTasks()).toBe(1);
      
      const task = queue.getNextTask();
      expect(task).toBeDefined();
      expect(task?.specPath).toBe('s1');
      expect(task?.dataIndex).toBe(0);

      expect(queue.isEmpty()).toBe(true);
      expect(queue.getTotalTasks()).toBe(0);
      expect(queue.getNextTask()).toBeUndefined();
    });
  });
});
