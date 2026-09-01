import { returnOne } from "./import.js";

describe("Test suites with imports", () => {
  it("should import an external module properly", () => {
    expect(returnOne()).toBe(1);
  });
});
export {};
