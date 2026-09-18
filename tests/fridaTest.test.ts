/// <reference types="../src/agent-runtime/globals.d.ts" />
describe("fridaTest", () => {
  it("should create a working mock via fridaTest.fn", () => {
    const mock = fridaTest.fn((a: number, b: number) => a + b);
    expect(mock(2, 3)).toBe(5);
    expect(mock).toHaveBeenCalledWith(2, 3);
  });

  it("should create a working spy via fridaTest.spyOn", () => {
    const target = { double: (n: number) => n * 2 };
    const spy = fridaTest.spyOn(target, "double");
    expect(target.double(4)).toBe(8);
    expect(spy).toHaveBeenCalledWith(4);
    spy.mockRestore();
  });

  it("should produce the same Mock type as the bare globals", () => {
    const viaNamespace = fridaTest.fn();
    const viaBareGlobal = fn();
    viaNamespace(1);
    viaBareGlobal(1);
    expect(viaNamespace.mock.calls).toEqual(viaBareGlobal.mock.calls);
  });
});

export {};
