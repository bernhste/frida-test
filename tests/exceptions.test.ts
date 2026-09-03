/// <reference types="../src/agent-runtime/globals.d.ts" />
describe("Exception", () => {
  describe("toThrow", () => {
    it("should pass when function throws with matching Error instance", () => {
      expect(() => {
        throw new Error("boom");
      }).toThrow(new Error("boom"));
    });

    it("should pass when function throws with matching sub-message", () => {
      expect(() => {
        throw new Error("zapp boom zoink");
      }).toThrow("boom");
    });

    it("should pass when function throws any error without matcher", () => {
      expect(() => {
        throw new Error("anything");
      }).toThrow();
    });

    it("should reject when message does not match", () => {
      expect(() => {
        expect(() => {
          throw new Error("cholula");
        }).toThrow("chipotle");
      }).toThrow();
    });

    it("should reject when error type does not match", () => {
      expect(() => {
        expect(() => {
          throw new Error("boom");
        }).toThrow(new TypeError("boom"));
      }).toThrow();
    });

    it("should reject when function does not throw", () => {
      expect(() => {
        expect(() => {
          return 42;
        }).toThrow();
      }).toThrow();
    });

    it("should match a thrown non-Error primitive against a string matcher", () => {
      expect(() => {
        throw 1337;
      }).toThrow("1337");
    });

    it("should reject a non-Error thrown value matched against an Error instance", () => {
      expect(() => {
        expect(() => {
          throw "just a string";
        }).toThrow(new Error("just a string"));
      }).toThrow();
    });

    it("should reject when async function is passed instead of sync", () => {
      expect(() => {
        expect(async () => {
          throw new Error("boom");
        }).toThrow();
      }).toThrow("toReject");
    });
  });
});

export {};
