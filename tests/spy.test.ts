/// <reference types="../src/agent-runtime/globals.d.ts" />
describe("fridaTest.spyOn", () => {
  it("should call through to the original implementation by default", () => {
    const target = { double: (n: number) => n * 2 };
    const spy = fridaTest.spyOn(target, "double");
    expect(target.double(4)).toBe(8);
    expect(spy).toHaveBeenCalledWith(4);
    spy.mockRestore();
  });

  it("should restore the exact original function reference", () => {
    const original = (n: number) => n * 2;
    const target = { double: original };
    const spy = fridaTest.spyOn(target, "double");
    spy.mockRestore();
    expect(target.double).toBe(original);
  });

  it("should stub a return value with mockReturnValue", () => {
    const target = { readPointer: () => 0 };
    const spy = fridaTest.spyOn(target, "readPointer").mockReturnValue(0x1234);
    expect(target.readPointer()).toBe(0x1234);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should replace the implementation with mockImplementation", () => {
    const target = { add: (a: number, b: number) => a + b };
    const spy = fridaTest.spyOn(target, "add").mockImplementation((...args: unknown[]) => (args[0] as number) + ((args[1] as number) + 1));
    expect(target.add(2, 2)).toBe(5);
    expect(spy).toHaveBeenCalledWith(2, 2);
    spy.mockRestore();
  });

  it("should preserve `this` binding to the spied-on object inside a custom mockImplementation", () => {
    // Regression test: a mock implementation that relies on `this` (a very normal pattern when
    // spying on an object's own method) must see the same `this` the real method would have had.
    const target = {
      state: "original-state",
      getState(): string {
        return this.state;
      },
    };
    const spy = fridaTest.spyOn(target, "getState").mockImplementation(function (this: typeof target): string {
      return this.state;
    });
    expect(target.getState()).toBe("original-state");
    spy.mockRestore();
  });

  it("should be idempotent when called more than once", () => {
    const original = (n: number) => n * 2;
    const target = { double: original };
    const spy = fridaTest.spyOn(target, "double");
    spy.mockRestore();
    spy.mockRestore();
    expect(target.double).toBe(original);
  });

  it("should clear recorded calls when restored", () => {
    const target = { ping: () => undefined };
    const spy = fridaTest.spyOn(target, "ping");
    target.ping();
    spy.mockRestore();
    expect(spy.mock.calls.length).toBe(0);
  });

  it("should reject spying on a non-function property", () => {
    const target = { name: "agent" };
    expect(() => {
      fridaTest.spyOn(target as unknown as { greet: () => void }, "greet");
    }).toThrow();
  });

  it("should remove the added own property on restore when the method was inherited", () => {
    class Base {
      greet(): string {
        return "base";
      }
    }
    const instance = new Base();
    expect(Object.prototype.hasOwnProperty.call(instance, "greet")).toBeFalsy();

    const spy = fridaTest.spyOn(instance, "greet");
    expect(Object.prototype.hasOwnProperty.call(instance, "greet")).toBeTruthy();

    spy.mockRestore();
    expect(Object.prototype.hasOwnProperty.call(instance, "greet")).toBeFalsy();
    expect(instance.greet()).toBe("base");
  });

  describe("toHaveBeenCalled", () => {
    it("should pass once the spy has been invoked", () => {
      const target = { ping: () => undefined };
      const spy = fridaTest.spyOn(target, "ping");
      target.ping();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
    it("should fail when the spy was never invoked", () => {
      const target = { ping: () => undefined };
      const spy = fridaTest.spyOn(target, "ping");
      expect(() => {
        expect(spy).toHaveBeenCalled();
      }).toThrow();
      spy.mockRestore();
    });
  });

  describe("toHaveBeenCalledWith", () => {
    it("should pass when a single argument matches", () => {
      const target = { greet: (name: string) => `hi ${name}` };
      const spy = fridaTest.spyOn(target, "greet");
      target.greet("frida");
      expect(spy).toHaveBeenCalledWith("frida");
      spy.mockRestore();
    });
    it("should support multiple positional arguments", () => {
      const target = { add: (a: number, b: number) => a + b };
      const spy = fridaTest.spyOn(target, "add");
      target.add(2, 3);
      expect(spy).toHaveBeenCalledWith(2, 3);
      expect(() => {
        expect(spy).toHaveBeenCalledWith(2, 4);
      }).toThrow();
      spy.mockRestore();
    });
    it("should match arguments using deep equality", () => {
      const target = { save: (record: { id: number }) => record.id };
      const spy = fridaTest.spyOn(target, "save");
      target.save({ id: 42 });
      expect(spy).toHaveBeenCalledWith({ id: 42 });
      spy.mockRestore();
    });
  });
});
export {};
