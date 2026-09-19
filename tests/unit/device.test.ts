import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const manager = { addRemoteDevice: jest.fn(async (..._a: unknown[]) => "remote-added") };
const frida = {
  getUsbDevice: jest.fn(async () => "usb"),
  getLocalDevice: jest.fn(async () => "local"),
  getRemoteDevice: jest.fn(async () => "remote"),
  getDevice: jest.fn(async (id: string) => `id:${id}`),
  getDeviceManager: jest.fn(() => manager),
};
jest.unstable_mockModule("frida", () => ({ default: frida }));

const { resolveDevice } = await import("../../src/host/device.js");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("resolveDevice", () => {
  it("defaults to the local device", async () => {
    expect(await resolveDevice()).toBe("local");
  });

  it.each([
    ["usb", "usb"],
    ["local", "local"],
    ["remote", "remote"],
  ] as const)("resolves %s", async (selector, expected) => {
    expect(await resolveDevice(selector)).toBe(expected);
  });

  it("resolves by id", async () => {
    expect(await resolveDevice({ id: "abc" })).toBe("id:abc");
  });

  it("adds a remote device with network options", async () => {
    const sel = { host: "1.2.3.4:27042", token: "t", origin: "o", certificate: "c", keepaliveInterval: 5 };
    expect(await resolveDevice(sel)).toBe("remote-added");
    expect(manager.addRemoteDevice).toHaveBeenCalledWith("1.2.3.4:27042", {
      certificate: "c",
      origin: "o",
      token: "t",
      keepaliveInterval: 5,
    });
  });
});
