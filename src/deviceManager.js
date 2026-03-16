export class DeviceManager {
  constructor(capabilities) {
    this.devices = capabilities.map((cap, index) => ({
      id: `device_${index}`,
      capability: cap,
      isIdle: true,
    }));
  }

  hasIdleDevices() {
    return this.devices.some((device) => device.isIdle);
  }

  getAvailableDevice() {
    return this.devices.find((device) => device.isIdle) || null;
  }

  markDeviceBusy(id) {
    const device = this.devices.find((d) => d.id === id);
    if (device) device.isIdle = false;
  }

  markDeviceIdle(id) {
    const device = this.devices.find((d) => d.id === id);
    if (device) device.isIdle = true;
  }
}
