/// <reference types="../src/agent-runtime/globals.d.ts" />
describe("Basic Matcher", () => {
  describe("toBe", () => {
    it("should pass when values are strictly equal", () => {
      expect(1).toBe(1);
      expect("hello").toBe("hello");
    });
    it("should fail when values are not strictly equal", () => {
      expect(() => {
        expect(1).toBe(2);
      }).toThrow();
      expect(() => {
        expect({ a: 1 }).toBe({ a: 1 });
      }).toThrow();
    });
  });

  describe("toEqual", () => {
    it("should pass when values are deeply equal", () => {
      expect({ a: 1 }).toEqual({ a: 1 });
      expect([1, 2, 3]).toEqual([1, 2, 3]);
    });
    it("should fail when values are not deeply equal", () => {
      expect(() => {
        expect({ a: 1 }).toEqual({ a: 2 });
      }).toThrow();
      expect(() => {
        expect([1, 2]).toEqual([1, 2, 3]);
      }).toThrow();
    });
    it("should treat NaN as equal within nested structures", () => {
      expect({ value: NaN }).toEqual({ value: NaN });
    });
    it("should compare Date instances by their time value", () => {
      expect(new Date("2020-01-01T00:00:00Z")).toEqual(new Date("2020-01-01T00:00:00Z"));
      expect(() => {
        expect(new Date("2020-01-01T00:00:00Z")).toEqual(new Date("2021-01-01T00:00:00Z"));
      }).toThrow();
    });
    it("should compare RegExp instances by source and flags", () => {
      expect(/abc/gi).toEqual(/abc/gi);
      expect(() => {
        expect(/abc/g).toEqual(/abc/i);
      }).toThrow();
    });
    it("should compare Map instances by entries", () => {
      expect(
        new Map([
          ["a", 1],
          ["b", 2],
        ]),
      ).toEqual(
        new Map([
          ["a", 1],
          ["b", 2],
        ]),
      );
      expect(() => {
        expect(new Map([["a", 1]])).toEqual(new Map([["a", 2]]));
      }).toThrow();
    });
    it("should compare Set instances by membership regardless of order", () => {
      expect(new Set([1, 2, 3])).toEqual(new Set([3, 2, 1]));
      expect(() => {
        expect(new Set([1, 2])).toEqual(new Set([1, 2, 3]));
      }).toThrow();
    });
    it("should not let one element in the expected Set satisfy two different elements in the actual Set", () => {
      // Regression test: a naive "every element of A has some match in B" comparison can let a
      // single element of B be reused to satisfy two distinct (but deep-equal-shaped) elements of
      // A, wrongly reporting two structurally different Sets as equal.
      expect(() => {
        expect(new Set([{ x: 1 }, { x: 1 }])).toEqual(new Set([{ x: 1 }, { x: 2 }]));
      }).toThrow();
    });
    it("should still pass when a Set genuinely has repeated deep-equal-shaped elements", () => {
      expect(new Set([{ x: 1 }, { x: 1 }])).toEqual(new Set([{ x: 1 }, { x: 1 }]));
    });
  });

  describe("toBeTruthy", () => {
    it("should pass for truthy values", () => {
      expect(true).toBeTruthy();
      expect(1).toBeTruthy();
      expect("non-empty").toBeTruthy();
    });
    it("should fail for falsy values", () => {
      expect(() => {
        expect(false).toBeTruthy();
      }).toThrow();
      expect(() => {
        expect(0).toBeTruthy();
      }).toThrow();
      expect(() => {
        expect("").toBeTruthy();
      }).toThrow();
    });
  });

  describe("toBeFalsy", () => {
    it("should pass for falsy values", () => {
      expect(false).toBeFalsy();
      expect(0).toBeFalsy();
      expect(null).toBeFalsy();
      expect(undefined).toBeFalsy();
    });
    it("should fail for truthy values", () => {
      expect(() => {
        expect(true).toBeFalsy();
      }).toThrow();
      expect(() => {
        expect(1).toBeFalsy();
      }).toThrow();
      expect(() => {
        expect("hi").toBeFalsy();
      }).toThrow();
    });
  });

  describe("toBeNull", () => {
    it("should pass when value is strictly null", () => {
      expect(null).toBeNull();
    });
    it("should fail when value is not strictly null", () => {
      expect(() => {
        expect(undefined).toBeNull();
      }).toThrow();
      expect(() => {
        expect(0).toBeNull();
      }).toThrow();
      expect(() => {
        expect(false).toBeNull();
      }).toThrow();
    });
  });

  describe("toBeDefined", () => {
    it("should pass when value is defined", () => {
      expect(1).toBeDefined();
      expect("hello").toBeDefined();
      expect(null).toBeDefined();
      expect(false).toBeDefined();
    });
    it("should fail when value is undefined", () => {
      expect(() => {
        expect(undefined).toBeDefined();
      }).toThrow();
    });
  });

  describe("toBeUndefined", () => {
    it("should pass when value is undefined", () => {
      expect(undefined).toBeUndefined();
    });
    it("should fail when value is defined", () => {
      expect(() => {
        expect(null).toBeUndefined();
      }).toThrow();
      expect(() => {
        expect(0).toBeUndefined();
      }).toThrow();
    });
  });

  describe("toBeGreaterThan", () => {
    it("should pass when actual is greater than expected", () => {
      expect(5).toBeGreaterThan(3);
    });
    it("should fail when actual is not greater than expected", () => {
      expect(() => {
        expect(3).toBeGreaterThan(5);
      }).toThrow();
      expect(() => {
        expect(3).toBeGreaterThan(3);
      }).toThrow();
    });
    it("should reject non-numeric operands", () => {
      expect(() => {
        expect("5" as unknown as number).toBeGreaterThan(3);
      }).toThrow();
    });
  });

  describe("toBeLessThan", () => {
    it("should pass when actual is less than expected", () => {
      expect(3).toBeLessThan(5);
    });
    it("should fail when actual is not less than expected", () => {
      expect(() => {
        expect(5).toBeLessThan(3);
      }).toThrow();
      expect(() => {
        expect(3).toBeLessThan(3);
      }).toThrow();
    });
  });

  describe("toContain", () => {
    it("should pass when an array contains the expected item", () => {
      expect([1, 2, 3]).toContain(2);
    });
    it("should use strict equality, not deep equality, for object items", () => {
      // Matches Jest: toContain checks array items with ===; a structurally-equal but
      // distinct object does not count. toContainEqual below is the deep-equality version.
      expect(() => {
        expect([{ a: 1 }, { b: 2 }]).toContain({ a: 1 });
      }).toThrow();
    });
    it("should pass when a string contains the expected substring", () => {
      expect("hello world").toContain("world");
    });
    it("should pass when a Set contains the expected item", () => {
      expect(new Set([1, 2, 3])).toContain(2);
    });
    it("should fail when the item is absent", () => {
      expect(() => {
        expect([1, 2, 3]).toContain(4);
      }).toThrow();
      expect(() => {
        expect("hello world").toContain("bye");
      }).toThrow();
    });
  });

  describe("toContainEqual", () => {
    it("should pass using deep equality for object items", () => {
      expect([{ a: 1 }, { b: 2 }]).toContainEqual({ a: 1 });
    });
    it("should fail when no item deeply equals the expected value", () => {
      expect(() => {
        expect([{ a: 1 }, { b: 2 }]).toContainEqual({ a: 2 });
      }).toThrow();
    });
  });

  describe("not", () => {
    it("should invert the result of a matcher properly", () => {
      expect(2 + 2).not.toBe(5);
      expect("hello").not.toBe("bye");
    });
    it("should invert numeric and containment matchers", () => {
      expect(3).not.toBeGreaterThan(5);
      expect([1, 2, 3]).not.toContain(9);
    });
    it("should invert toHaveBeenCalled", () => {
      const target = { ping: () => undefined };
      const spy = fridaTest.spyOn(target, "ping");
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
    it("should fail when the underlying condition actually holds", () => {
      expect(() => {
        expect(2 + 2).not.toBe(4);
      }).toThrow();
    });
  });
});

export {};
