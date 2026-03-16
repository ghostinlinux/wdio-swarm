import path from 'path';

export async function loadConfig(configPath) {
  try {
    const imported = await import(configPath);
    return imported.config || imported.default || imported;
  } catch (error) {
    console.error(`Failed to load WebdriverIO configuration from ${configPath}`);
    throw error;
  }
}
