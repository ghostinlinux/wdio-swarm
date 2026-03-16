import path from 'path';

/**
 * Loads a WebdriverIO configuration file dynamically.
 * 
 * @param {string} configPath - Relative or absolute path to the wdio.conf.js file.
 * @returns {Promise<any>} The parsed configuration object.
 */
export async function loadConfig(configPath: string): Promise<any> {
    const absolutePath = path.resolve(process.cwd(), configPath);
    try {
        const module = await import(absolutePath);
        return module.config || module.default?.config || module;
    } catch (err: any) {
        console.error(`Failed to load WebdriverIO configuration from ${absolutePath}`);
        throw err;
    }
}
