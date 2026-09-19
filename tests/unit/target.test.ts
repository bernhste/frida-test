import { describe, expect, it, jest } from "@jest/globals";
import type { Device } from "frida";
import { resolveTarget } from "../../src/host/target.js";

function makeDevice(overrides: Record<string, unknown> = {}): Device {
  return {
    spawn: jest.fn(async () => 111),
    getFrontmostApplication: jest.fn(async () => ({ pid: 222 })),
    enumerateProcesses: jest.fn(async () => []),
    enumerateApplications: jest.fn(async () => []),
    ...overrides,
  } as unknown as Device;
}

const procs = (...list: Array<[string, number]>) => async () => list.map(([name, pid]) => ({ name, pid }));

describe("resolveTarget", () => {
  it("spawns a file", async () => {
    const device = makeDevice();
    expect(await resolveTarget(device, { file: " /bin/app " })).toEqual({ pid: 111, wasSpawned: true });
    expect(device.spawn).toHaveBeenCalledWith("/bin/app");
  });

  it("rejects an empty file", async () => {
    await expect(resolveTarget(makeDevice(), { file: "  " })).rejects.toThrow(/must not be empty/);
  });

  it("attaches by pid without spawning", async () => {
    expect(await resolveTarget(makeDevice(), { pid: 7 })).toEqual({ pid: 7, wasSpawned: false });
  });

  it("attaches to the frontmost app", async () => {
    expect(await resolveTarget(makeDevice(), { frontmost: true })).toEqual({ pid: 222, wasSpawned: false });
  });

  it("errors when there is no frontmost app", async () => {
    const device = makeDevice({ getFrontmostApplication: async () => null });
    await expect(resolveTarget(device, { frontmost: true })).rejects.toThrow(/No frontmost application/);
  });

  describe("by name", () => {
    it("prefers an exact match over looser ones", async () => {
      const device = makeDevice({ enumerateProcesses: procs(["chrome", 1], ["Chrome", 2], ["chromedriver", 3]) });
      expect(await resolveTarget(device, { name: "chrome" })).toEqual({ pid: 1, wasSpawned: false });
    });

    it("falls back to case-insensitive, then substring", async () => {
      let device = makeDevice({ enumerateProcesses: procs(["Chrome", 2], ["chromedriver", 3]) });
      expect((await resolveTarget(device, { name: "chrome" })).pid).toBe(2);
      device = makeDevice({ enumerateProcesses: procs(["com.foo.dialer", 9], ["other", 4]) });
      expect((await resolveTarget(device, { name: "DIALER" })).pid).toBe(9);
    });

    it("errors when nothing matches", async () => {
      const device = makeDevice({ enumerateProcesses: procs(["a", 1]) });
      await expect(resolveTarget(device, { name: "zzz" })).rejects.toThrow(/No running process matching 'zzz'/);
    });

    it("errors on ambiguous matches", async () => {
      const device = makeDevice({ enumerateProcesses: procs(["fooA", 1], ["fooB", 2]) });
      await expect(resolveTarget(device, { name: "foo" })).rejects.toThrow(/Ambiguous.*fooA \(pid 1\), fooB \(pid 2\)/);
    });

    it("rejects an empty name", async () => {
      await expect(resolveTarget(makeDevice(), { name: " " })).rejects.toThrow(/must not be empty/);
    });
  });

  describe("by identifier", () => {
    it("returns the pid of a running app", async () => {
      const device = makeDevice({ enumerateApplications: async () => [{ identifier: "com.a", pid: 0 }, { identifier: "com.b", pid: 55 }] });
      expect(await resolveTarget(device, { identifier: " com.b " })).toEqual({ pid: 55, wasSpawned: false });
    });

    it("errors when the app is unknown or not running", async () => {
      const device = makeDevice({ enumerateApplications: async () => [{ identifier: "com.a", pid: 0 }] });
      await expect(resolveTarget(device, { identifier: "com.a" })).rejects.toThrow(/not currently running/);
      await expect(resolveTarget(device, { identifier: "com.x" })).rejects.toThrow(/not currently running/);
    });

    it("rejects an empty identifier", async () => {
      await expect(resolveTarget(makeDevice(), { identifier: "" })).rejects.toThrow(/must not be empty/);
    });
  });
});
