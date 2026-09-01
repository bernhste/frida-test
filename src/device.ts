import type { Device } from "frida";
import frida from "frida";

export type DeviceSelector = "usb" | "local" | { id: string };
export type TargetDef = { pid: number } | { id: string };

export async function resolveDevice(selector: DeviceSelector = "local"): Promise<Device> {
  if (selector === "usb") return frida.getUsbDevice();
  if (selector === "local") return frida.getLocalDevice();
  return frida.getDevice(selector.id);
}

export interface Target {
  pid: number;
  wasSpawned: boolean;
}

export async function resolveTarget(device: Device, targetDef: TargetDef): Promise<Target> {
  if ("pid" in targetDef) return { pid: targetDef.pid, wasSpawned: false };

  const { id } = targetDef;
  if (!id.trim()) throw new Error("Target id must not be empty");

  try {
    const pid = await device.spawn(id);
    return { pid, wasSpawned: true };
  } catch (spawnError) {
    const needle = id.toLowerCase();
    const processes = await device.enumerateProcesses();

    const tiers = [
      processes.filter((p) => p.name === id),
      processes.filter((p) => p.name.toLowerCase() === needle),
      processes.filter((p) => p.name.toLowerCase().includes(needle)),
    ];
    const matches = tiers.find((tier) => tier.length > 0) ?? [];

    if (matches.length === 0) {
      const reason = spawnError instanceof Error ? spawnError.message : String(spawnError);
      throw new Error(`Unable to spawn '${id}' and no matching running process was found (spawn failed: ${reason}).`);
    }
    if (matches.length > 1) {
      const names = matches.map((p) => `${p.name} (pid ${p.pid})`).join(", ");
      throw new Error(`Ambiguous target '${id}', matches: ${names}`);
    }
    return { pid: matches[0].pid, wasSpawned: false };
  }
}
