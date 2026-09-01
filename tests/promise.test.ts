describe("Promise", () => {
  describe("toResolve", () => {
    it("should pass when a promise resolves", async () => {
      await expect(() => new Promise((resolve) => setTimeout(() => resolve("success"), 10))).toResolve();
    });

    it("should pass when the resolved value matches", async () => {
      await expect(() => new Promise((resolve) => setTimeout(() => resolve(42), 10))).toResolve(42);
    });

    it("should reject a value mismatch", async () => {
      await expect(async () => {
        await expect(() => new Promise((resolve) => setTimeout(() => resolve("foo"), 10))).toResolve("bar");
      }).toReject();
    });

    it("should reject a rejecting promise", async () => {
      await expect(async () => {
        await expect(() => new Promise((_, reject) => setTimeout(() => reject("error"), 10))).toResolve();
      }).toReject();
    });

    it("should match against an object", async () => {
      await expect(() => new Promise((resolve) => setTimeout(() => resolve({ id: 1, name: "test" }), 10))).toResolve({ id: 1, name: "test" });
    });

    it("should reject an object value mismatch", async () => {
      await expect(async () => {
        await expect(() => new Promise((resolve) => setTimeout(() => resolve({ id: 1 }), 10))).toResolve({ id: 2 });
      }).toReject();
    });
  });

  describe("toReject", () => {
    it("should pass when a promise rejects", async () => {
      await expect(() => new Promise((_, reject) => setTimeout(() => reject("error"), 10))).toReject();
    });

    it("should pass when the rejection message matches", async () => {
      await expect(() => new Promise((_, reject) => setTimeout(() => reject("bad pointer dereference"), 10))).toReject("bad pointer");
    });

    it("should reject a message mismatch", async () => {
      await expect(async () => {
        await expect(() => new Promise((_, reject) => setTimeout(() => reject("cholula"), 10))).toReject("chipotle");
      }).toReject();
    });

    it("should reject a non-rejecting promise", async () => {
      await expect(async () => {
        await expect(() => new Promise((resolve) => setTimeout(() => resolve(42), 10))).toReject();
      }).toReject();
    });

    it("should match against a rejection value", async () => {
      await expect(() => new Promise((_, reject) => setTimeout(() => reject("boom"), 10))).toReject("boom");
    });

    it("should reject a value mismatch", async () => {
      await expect(async () => {
        await expect(() => new Promise((_, reject) => setTimeout(() => reject("boom"), 10))).toReject("different");
      }).toReject();
    });
  });
});

export {};
