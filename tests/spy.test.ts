/// <reference types="../src/agent-runtime/globals.d.ts" />
describe("spyOn", () => {
  it("should call through to the original implementation by default", () => {
    const target = { double: (n: number) => n * 2 };
    const spy = spyOn(target, "double");
    expect(target.double(4)).toBe(8);
    expect(spy).toHaveBeenCalledWith(4);
    spy.restore();
  });

  it("should restore the exact original function reference", () => {
    const original = (n: number) => n * 2;
    const target = { double: original };
    const spy = spyOn(target, "double");
    spy.restore();
    expect(target.double).toBe(original);
  });

  it("should stub a return value with mockReturnValue", () => {
    const target = { readPointer: () => 0 };
    const spy = spyOn(target, "readPointer").mockReturnValue(0x1234);
    expect(target.readPointer()).toBe(0x1234);
    expect(spy).toHaveBeenCalled();
    spy.restore();
  });

  it("should replace the implementation with mockImplementation", () => {
    const target = { add: (a: number, b: number) => a + b };
    const spy = spyOn(target, "add").mockImplementation((...args: unknown[]) => (args[0] as number) + ((args[1] as number) + 1));
    expect(target.add(2, 2)).toBe(5);
    expect(spy).toHaveBeenCalledWith(2, 2);
    spy.restore();
  });

  it("should reject spying on a non-function property", () => {
    const target = { name: "agent" };
    expect(() => {
      spyOn(target as unknown as { greet: () => void }, "greet");
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

    const spy = spyOn(instance, "greet");
    expect(Object.prototype.hasOwnProperty.call(instance, "greet")).toBeTruthy();

    spy.restore();
    expect(Object.prototype.hasOwnProperty.call(instance, "greet")).toBeFalsy();
    expect(instance.greet()).toBe("base");
  });

  describe("toHaveBeenCalled", () => {
    it("should pass once the spy has been invoked", () => {
      const target = { ping: () => undefined };
      const spy = spyOn(target, "ping");
      target.ping();
      expect(spy).toHaveBeenCalled();
      spy.restore();
    });
    it("should fail when the spy was never invoked", () => {
      const target = { ping: () => undefined };
      const spy = spyOn(target, "ping");
      expect(() => {
        expect(spy).toHaveBeenCalled();
      }).toThrow();
      spy.restore();
    });
  });

  describe("toHaveBeenCalledWith", () => {
    it("should pass when a single argument matches", () => {
      const target = { greet: (name: string) => `hi ${name}` };
      const spy = spyOn(target, "greet");
      target.greet("frida");
      expect(spy).toHaveBeenCalledWith("frida");
      spy.restore();
    });
    it("should support multiple positional arguments", () => {
      const target = { add: (a: number, b: number) => a + b };
      const spy = spyOn(target, "add");
      target.add(2, 3);
      expect(spy).toHaveBeenCalledWith(2, 3);
      expect(() => {
        expect(spy).toHaveBeenCalledWith(2, 4);
      }).toThrow();
      spy.restore();
    });
    it("should match arguments using deep equality", () => {
      const target = { save: (record: { id: number }) => record.id };
      const spy = spyOn(target, "save");
      target.save({ id: 42 });
      expect(spy).toHaveBeenCalledWith({ id: 42 });
      spy.restore();
    });
  });
});
export {};
