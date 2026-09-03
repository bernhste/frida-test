/// <reference types="../src/agent-runtime/globals.d.ts" />
describe("Test suites with nested tests", () => {
  it("should test it() at level 0", () => {
    expect(true).toBeTruthy();
  });
  describe("Nested 1", () => {
    it("should test it() at level 1", () => {
      expect(true).toBeTruthy();
    });
    describe("Nested 2", () => {
      it("should test it() at level 2 - 0", () => {
        expect(true).toBeTruthy();
      });
      it("should test it() at level 2 - 1", () => {
        expect(true).toBeTruthy();
      });
    });
  });
});

export {};
