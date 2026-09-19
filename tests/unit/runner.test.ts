import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Device } from "frida";
import type { RunSummary } from "../../src/host/protocol.js";
import { TestRunner } from "../../src/host/runner.js";

type Handler = (...args: any[]) => void;

function signal() {
  const handlers: Handler[] = [];
  return { connect: (h: Handler) => void handlers.push(h), emit: (...a: unknown[]) => handlers.forEach((h) => h(...a)) };
}

const summary: RunSummary = { total: 1, passed: 1, failed: 0, durationMs: 1, testSuitesResults: [] };

function setup(opts: { wasSpawned?: boolean } = {}) {
  const message = signal();
  const destroyed = signal();
  const script = {
    message,
    destroyed,
    load: jest.fn(async () => {}),
    unload: jest.fn(async () => {}),
    exports: { runTests: jest.fn(async (_v: boolean) => summary) },
  };
  const session = {
    createScript: jest.fn(async (_src: string) => script),
    detach: jest.fn(async () => {}),
  };
  const device = { attach: jest.fn(async (_pid: number) => session), resume: jest.fn(async (_pid: number) => {}) };
  const runner = new TestRunner(device as unknown as Device, { pid: 42, wasSpawned: opts.wasSpawned ?? false }, "BUNDLE", true);
  return { runner, device, session, script, message, destroyed };
}

let log: jest.SpiedFunction<typeof console.log>;
beforeEach(() => {
  log = jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe("TestRunner", () => {
  it("attaches, loads the bundle and does not resume an attached target", async () => {
    const { runner, device, session, script } = setup();
    await runner.initialize();
    expect(device.attach).toHaveBeenCalledWith(42);
    expect(session.createScript).toHaveBeenCalledWith("BUNDLE");
    expect(script.load).toHaveBeenCalled();
    expect(device.resume).not.toHaveBeenCalled();
  });

  it("resumes a spawned target after loading the script", async () => {
    const { runner, device } = setup({ wasSpawned: true });
    await runner.initialize();
    expect(device.resume).toHaveBeenCalledWith(42);
  });

  it("rejects double initialization", async () => {
    const { runner } = setup();
    await runner.initialize();
    await expect(runner.initialize()).rejects.toThrow(/already initialized/);
  });

  it("detaches the session and rethrows if loading fails", async () => {
    const { runner, session, script } = setup();
    script.load.mockRejectedValueOnce(new Error("load failed"));
    await expect(runner.initialize()).rejects.toThrow("load failed");
    expect(session.detach).toHaveBeenCalled();
  });

  it("requires initialize() before runTests()", async () => {
    await expect(setup().runner.runTests()).rejects.toThrow(/not initialized/);
  });

  it("runs tests via the agent export, passing verbose", async () => {
    const { runner, script } = setup();
    await runner.initialize();
    expect(await runner.runTests()).toBe(summary);
    expect(script.exports.runTests).toHaveBeenCalledWith(true);
  });

  it("collects suite results from agent messages and prints them", async () => {
    const { runner, message } = setup();
    await runner.initialize();
    const result = { name: "s", status: "passed" as const };
    message.emit({ type: "send", payload: { type: "test-suite-started", name: "s" } }, null);
    message.emit({ type: "send", payload: { type: "test-suite-finished", name: "s", result } }, null);
    message.emit({ type: "send", payload: { type: "agent-ready" } }, null);
    message.emit({ type: "send", payload: { unrelated: true } }, null);
    expect(runner.suiteResults).toEqual([result]);
    expect(log).toHaveBeenCalled();
  });

  it("throws the agent error after runTests when the script reports an error", async () => {
    const { runner, message } = setup();
    await runner.initialize();
    message.emit({ type: "error", description: "desc", stack: "the stack" }, null);
    await expect(runner.runTests()).rejects.toThrow("the stack");
  });

  it("falls back to description when the error has no stack", async () => {
    const { runner, message } = setup();
    await runner.initialize();
    message.emit({ type: "error", description: "desc" }, null);
    await expect(runner.runTests()).rejects.toThrow("desc");
  });

  it("throws when the script is destroyed unexpectedly", async () => {
    const { runner, destroyed } = setup();
    await runner.initialize();
    destroyed.emit();
    await expect(runner.runTests()).rejects.toThrow(/destroyed unexpectedly/);
  });

  it("dispose unloads and detaches, and allows re-initialization", async () => {
    const { runner, script, session } = setup();
    await runner.initialize();
    await runner.dispose();
    expect(script.unload).toHaveBeenCalled();
    expect(session.detach).toHaveBeenCalled();
    await expect(runner.runTests()).rejects.toThrow(/not initialized/);
    await expect(runner.initialize()).resolves.toBeUndefined();
  });

  it("dispose swallows unload/detach failures with a warning", async () => {
    const { runner, script, session } = setup();
    await runner.initialize();
    script.unload.mockRejectedValueOnce(new Error("u"));
    session.detach.mockRejectedValueOnce(new Error("d"));
    await expect(runner.dispose()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it("dispose is a no-op before initialization", async () => {
    await expect(setup().runner.dispose()).resolves.toBeUndefined();
  });
});
