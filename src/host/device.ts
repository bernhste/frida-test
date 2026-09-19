import type { Device } from "frida";
import frida from "frida";

export type DeviceSelector =
  | "usb"
  | "local"
  | "remote"
  | { id: string }
  | {
      host: string;
      certificate?: string;
      origin?: string;
      token?: string;
      keepaliveInterval?: number;
    };

export async function resolveDevice(selector: DeviceSelector = "local"): Promise<Device> {
  if (selector === "usb") return frida.getUsbDevice();
  if (selector === "local") return frida.getLocalDevice();
  if (selector === "remote") return frida.getRemoteDevice();
  if ("id" in selector) return frida.getDevice(selector.id);

  // Pass network parameters to addRemoteDevice
  const manager = frida.getDeviceManager();
  return manager.addRemoteDevice(selector.host, {
    certificate: selector.certificate,
    origin: selector.origin,
    token: selector.token,
    keepaliveInterval: selector.keepaliveInterval,
  });
}
