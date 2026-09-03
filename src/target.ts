import type { Device } from "frida";

export interface Target {
  pid: number;
  wasSpawned: boolean;
}
export type TargetDef = { file: string } | { frontmost: true } | { name: string } | { identifier: string } | { pid: number };

export async function resolveTarget(device: Device, targetDef: TargetDef): Promise<Target> {
  // Spawn target binary or app (-f, --file)
  if ("file" in targetDef) {
    const file = targetDef.file.trim();
    if (!file) throw new Error("Target file/program must not be empty");
    const pid = await device.spawn(file);
    return { pid, wasSpawned: true };
  }

  // Attach by PID (-p, --attach-pid)
  if ("pid" in targetDef) {
    return { pid: targetDef.pid, wasSpawned: false };
  }

  // Attach to frontmost application (-F, --attach-frontmost)
  if ("frontmost" in targetDef) {
    const app = await device.getFrontmostApplication();
    if (!app) {
      throw new Error("No frontmost application found on the target device");
    }
    return { pid: app.pid, wasSpawned: false };
  }

  // Attach by process name (-n, --attach-name)
  if ("name" in targetDef) {
    const targetName = targetDef.name.trim();
    if (!targetName) throw new Error("Target process name must not be empty");

    const processes = await device.enumerateProcesses();
    const needle = targetName.toLowerCase();

    const tiers = [
      processes.filter((p) => p.name === targetName),
      processes.filter((p) => p.name.toLowerCase() === needle),
      processes.filter((p) => p.name.toLowerCase().includes(needle)),
    ];
    const matches = tiers.find((tier) => tier.length > 0) ?? [];

    if (matches.length === 0) {
      throw new Error(`No running process matching '${targetName}' was found.`);
    }
    if (matches.length > 1) {
      const names = matches.map((p) => `${p.name} (pid ${p.pid})`).join(", ");
      throw new Error(`Ambiguous process target '${targetName}', matches: ${names}`);
    }
    return { pid: matches[0].pid, wasSpawned: false };
  }

  // Attach to running application by identifier (-N, --attach-identifier) without spawning
  const identifier = targetDef.identifier.trim();
  if (!identifier) throw new Error("Target identifier must not be empty");

  const apps = await device.enumerateApplications();
  const matchedApp = apps.find((a) => a.identifier === identifier);

  if (!matchedApp || !matchedApp.pid || matchedApp.pid === 0) {
    throw new Error(`Application '${identifier}' is not currently running.`);
  }

  return { pid: matchedApp.pid, wasSpawned: false };
}
