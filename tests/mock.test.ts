/// <reference types="../src/agent-runtime/globals.d.ts" />
describe("fn", () => {
  it("should track calls without an implementation", () => {
    const mock = fn();
    mock(1, "a");
    expect(mock).toHaveBeenCalledWith(1, "a");
    expect(mock.mock.calls.length).toBe(1);
  });

  it("should use the given implementation by default", () => {
    const mock = fn((a: number, b: number) => a + b);
    expect(mock(2, 3)).toBe(5);
  });

  it("should stub a return value with mockReturnValue", () => {
    const mock = fn().mockReturnValue(42);
    expect(mock()).toBe(42);
    expect(mock()).toBe(42);
  });

  it("should only apply mockReturnValueOnce for the next call", () => {
    const mock = fn().mockReturnValue(1).mockReturnValueOnce(99);
    expect(mock()).toBe(99);
    expect(mock()).toBe(1);
    expect(mock()).toBe(1);
  });

  it("should resolve with mockResolvedValue", async () => {
    const mock = fn().mockResolvedValue("done");
    await expect(mock()).resolves.toBe("done");
  });

  it("should reject with mockRejectedValue", async () => {
    const mock = fn().mockRejectedValue(new Error("boom"));
    await expect(mock()).rejects.toThrow("boom");
  });

  it("should return `this` with mockReturnThis", () => {
    const target = { mock: fn() };
    target.mock.mockReturnThis();
    expect(target.mock()).toBe(target);
  });

  it("should clear call history with mockClear but keep the implementation", () => {
    const mock = fn().mockReturnValue(7);
    mock();
    mock.mockClear();
    expect(mock.mock.calls.length).toBe(0);
    expect(mock()).toBe(7);
  });

  it("should drop the implementation with mockReset", () => {
    const mock = fn(() => 1);
    mock();
    mock.mockReset();
    expect(mock.mock.calls.length).toBe(0);
    expect(mock()).toBeUndefined();
  });

  it("should name the mock with mockName/getMockName", () => {
    const mock = fn().mockName("myMock");
    expect(mock.getMockName()).toBe("myMock");
  });
});

describe("toHaveBeenCalledTimes", () => {
  it("should count the number of calls", () => {
    const mock = fn();
    mock();
    mock();
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock).not.toHaveBeenCalledTimes(1);
  });
});

describe("toHaveBeenLastCalledWith", () => {
  it("should match only the most recent call", () => {
    const mock = fn();
    mock(1);
    mock(2);
    expect(mock).toHaveBeenLastCalledWith(2);
    expect(mock).not.toHaveBeenLastCalledWith(1);
  });
});

describe("toHaveBeenNthCalledWith", () => {
  it("should match the call at the given position", () => {
    const mock = fn();
    mock("a");
    mock("b");
    expect(mock).toHaveBeenNthCalledWith(1, "a");
    expect(mock).toHaveBeenNthCalledWith(2, "b");
  });
});
export {};
