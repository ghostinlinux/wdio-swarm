/**
 * Interface representing a managed device/worker in the pool.
 */
export interface Device {
  id: string;
  capability: any;
  isIdle: boolean;
}

/**
 * DeviceManager
 * 
 * Manages the pool of available capabilities (devices) and tracks their busy/idle state.
 */
export class DeviceManager {
  public devices: Device[];

  /**
   * @param {any[]} capabilities - List of raw WebdriverIO capabilities.
   */
  constructor(capabilities: any[]) {
    this.devices = capabilities.map((cap, index) => ({
      id: `device_${index}`,
      capability: cap,
      isIdle: true,
    }));
  }

  /**
   * Checks if there are any idle devices available in the pool.
   * @returns {boolean}
   */
  public hasIdleDevices(): boolean {
    return this.devices.some((device) => device.isIdle);
  }

  /**
   * Retrieves the first available idle device.
   * @returns {Device | null}
   */
  public getAvailableDevice(): Device | null {
    return this.devices.find((device) => device.isIdle) || null;
  }

  /**
   * Marks a specific device as busy so it won't be picked for other tasks.
   * @param {string} id - The unique ID of the device.
   */
  public markDeviceBusy(id: string): void {
    const device = this.devices.find((d) => d.id === id);
    if (device) device.isIdle = false;
  }

  /**
   * Marks a specific device as idle, allowing it to be reused.
   * @param {string} id - The unique ID of the device.
   */
  public markDeviceIdle(id: string): void {
    const device = this.devices.find((d) => d.id === id);
    if (device) device.isIdle = true;
  }
}
