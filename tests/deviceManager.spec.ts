import { describe, it, expect } from 'vitest';
import { DeviceManager } from '../src/deviceManager.js';

describe('DeviceManager', () => {
  const mockCapabilities = [
    { browserName: 'chrome', browserVersion: 'latest' },
    { browserName: 'firefox' },
  ];

  it('should initialize with ID-assigned capabilities', () => {
    const dm = new DeviceManager(mockCapabilities);
    expect(dm.devices.length).toBe(2);
    expect(dm.devices[0].id).toBe('device_0');
    expect(dm.devices[1].id).toBe('device_1');
  });

  it('should track device availability correctly', () => {
    const dm = new DeviceManager([{ platformName: 'iOS' }]);

    expect(dm.hasIdleDevices()).toBe(true);

    const device = dm.getAvailableDevice();
    expect(device).not.toBeNull();
    expect(device?.id).toBe('device_0');

    // Mark busy
    if (device) dm.markDeviceBusy(device.id);
    expect(dm.devices[0].isIdle).toBe(false);
    expect(dm.hasIdleDevices()).toBe(false);
    expect(dm.getAvailableDevice()).toBeNull();

    // Mark idle
    if (device) dm.markDeviceIdle(device.id);
    expect(dm.devices[0].isIdle).toBe(true);
    expect(dm.hasIdleDevices()).toBe(true);
  });

  it('should fail silently if marking an unknown device', () => {
    const dm = new DeviceManager([{ platformName: 'iOS' }]);
    expect(() => dm.markDeviceBusy('device_99')).not.toThrow();
    expect(() => dm.markDeviceIdle('device_99')).not.toThrow();
  });
});
