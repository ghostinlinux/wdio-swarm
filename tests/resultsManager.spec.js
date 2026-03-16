import { describe, it, expect, vi, afterEach } from 'vitest';
import { ResultsManager } from '../src/resultsManager.js';
import fs from 'fs';

// Mock the fs module
vi.mock('fs');

describe('ResultsManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleTask = {
    specPath: 'test/login.js',
    dataIndex: 0,
    data: { role: 'admin' },
  };

  it('should initialize empty without outputPath', () => {
    const rm = new ResultsManager();
    expect(rm.results.length).toBe(0);
  });

  it('should record task results correctly', () => {
    const rm = new ResultsManager();
    rm.record(sampleTask, 'passed', 1);

    expect(rm.results.length).toBe(1);
    expect(rm.results[0]).toEqual({
      status: 'passed',
      attempts: 1,
      spec: 'test/login.js',
      dataIndex: 0,
      data: { role: 'admin' }
    });
  });

  it('should save results to the specified path', () => {
    const rm = new ResultsManager('output.json');
    rm.record(sampleTask, 'failed', 2, 'Crash error');
    
    rm.save();
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      rm.outputPath,
      JSON.stringify(rm.results, null, 2),
      'utf-8'
    );
  });

  it('should skip save if outputPath is missing', () => {
    const rm = new ResultsManager();
    rm.record(sampleTask, 'passed', 1);
    
    rm.save();
    
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
