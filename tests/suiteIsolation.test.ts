/// <reference types="../src/agent-runtime/globals.d.ts" />
const sharedTarget = { warn: (_msg: string): void => undefined };

describe("Suite isolation: consumer A", () => {
  it("does not see calls caused by another top-level suite's spy", async () => {
    const spy = fridaTest.spyOn(sharedTarget, "warn");
    for (let i = 0; i < 20; i++) {
      await Promise.resolve();
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("Suite isolation: consumer B", () => {
  it("spies on the same shared target as another top-level suite", async () => {
    for (let i = 0; i < 200; i++) {
      const spy = fridaTest.spyOn(sharedTarget, "warn");
      sharedTarget.warn("noise");
      spy.mockRestore();
      await Promise.resolve();
    }
  });
});

export {};
