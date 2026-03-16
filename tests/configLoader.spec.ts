import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/configLoader.js';

describe('configLoader', () => {
  it('should throw an error if the config file does not exist', async () => {
    await expect(loadConfig('/invalid/path/does_not_exist.js')).rejects.toThrow();
  });
});
