/// <reference types="../src/agent-runtime/globals.d.ts" />
describe("Promise modifiers", () => {
  describe("resolves", () => {
    it("should pass when the resolved value matches", async () => {
      await expect(new Promise((resolve) => setTimeout(() => resolve(42), 10))).resolves.toBe(42);
    });

    it("should reject a value mismatch", async () => {
      await expect(expect(new Promise((resolve) => setTimeout(() => resolve("foo"), 10))).resolves.toBe("bar")).rejects.toThrow();
    });

    it("should reject when the promise actually rejects", async () => {
      await expect(expect(new Promise((_, reject) => setTimeout(() => reject("error"), 10))).resolves.toBeDefined()).rejects.toThrow();
    });

    it("should match against an object with toEqual", async () => {
      await expect(new Promise((resolve) => setTimeout(() => resolve({ id: 1, name: "test" }), 10))).resolves.toEqual({ id: 1, name: "test" });
    });

    it("should reject an object value mismatch", async () => {
      await expect(expect(new Promise((resolve) => setTimeout(() => resolve({ id: 1 }), 10))).resolves.toEqual({ id: 2 })).rejects.toThrow();
    });

    it("should support .not", async () => {
      await expect(new Promise((resolve) => setTimeout(() => resolve(42), 10))).resolves.not.toBe(43);
    });

    it("should fail clearly when used on a value that is not a Promise", async () => {
      await expect(expect(42).resolves.toBe(42)).rejects.toThrow();
    });
  });

  describe("rejects", () => {
    it("should pass when a promise rejects", async () => {
      await expect(new Promise((_, reject) => setTimeout(() => reject("error"), 10))).rejects.toBeDefined();
    });

    it("should pass when the rejection message matches", async () => {
      await expect(new Promise((_, reject) => setTimeout(() => reject("bad pointer dereference"), 10))).rejects.toThrow("bad pointer");
    });

    it("should reject a message mismatch", async () => {
      await expect(expect(new Promise((_, reject) => setTimeout(() => reject("cholula"), 10))).rejects.toThrow("chipotle")).rejects.toThrow();
    });

    it("should reject a non-rejecting promise", async () => {
      await expect(expect(new Promise((resolve) => setTimeout(() => resolve(42), 10))).rejects.toBeDefined()).rejects.toThrow();
    });

    it("should match against a rejection value", async () => {
      await expect(new Promise((_, reject) => setTimeout(() => reject("boom"), 10))).rejects.toThrow("boom");
    });

    it("should reject a value mismatch", async () => {
      await expect(expect(new Promise((_, reject) => setTimeout(() => reject("boom"), 10))).rejects.toThrow("different")).rejects.toThrow();
    });

    it("should support .not", async () => {
      await expect(new Promise((_, reject) => setTimeout(() => reject("boom"), 10))).rejects.not.toThrow("different");
    });

    it("should fail clearly when used on a value that is not a Promise", async () => {
      await expect(expect(42).rejects.toBeDefined()).rejects.toThrow();
    });
  });
});

export {};
