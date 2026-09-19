/// <reference types="../../src/agent-runtime/globals.d.ts" />
describe("Hooks", () => {
  describe("beforeEach / afterEach", () => {
    let counter = 0;
    const seenAtStart: number[] = [];

    beforeEach(() => {
      counter++;
    });

    afterEach(() => {
      counter--;
    });

    it("runs beforeEach before the first test", () => {
      seenAtStart.push(counter);
      expect(counter).toBe(1);
    });

    it("runs afterEach after the previous test and beforeEach before this one", () => {
      seenAtStart.push(counter);
      expect(counter).toBe(1);
      expect(seenAtStart).toEqual([1, 1]);
    });
  });

  describe("beforeAll / afterAll", () => {
    let setupCalls = 0;

    beforeAll(() => {
      setupCalls++;
    });

    it("runs beforeAll once before any test", () => {
      expect(setupCalls).toBe(1);
    });

    it("does not run beforeAll again for the second test", () => {
      expect(setupCalls).toBe(1);
    });
  });

  describe("ordering across nested suites", () => {
    const log: string[] = [];

    beforeAll(() => {
      log.push("outer:beforeAll");
    });
    afterAll(() => {
      log.push("outer:afterAll");
    });
    beforeEach(() => {
      log.push("outer:beforeEach");
    });
    afterEach(() => {
      log.push("outer:afterEach");
    });

    it("first test", () => {
      log.push("outer:test1");
    });

    describe("nested", () => {
      beforeAll(() => {
        log.push("inner:beforeAll");
      });
      afterAll(() => {
        log.push("inner:afterAll");
      });
      beforeEach(() => {
        log.push("inner:beforeEach");
      });
      afterEach(() => {
        log.push("inner:afterEach");
      });

      it("nested test", () => {
        log.push("inner:test");
      });
    });

    it("last test - verifies order", () => {
      log.push("outer:test2");
      expect(log).toEqual([
        "outer:beforeAll",
        "outer:beforeEach",
        "outer:test1",
        "outer:afterEach",
        "inner:beforeAll",
        "outer:beforeEach",
        "inner:beforeEach",
        "inner:test",
        "inner:afterEach",
        "outer:afterEach",
        "inner:afterAll",
        "outer:beforeEach",
        "outer:test2",
      ]);
    });
  });
});

export {};
