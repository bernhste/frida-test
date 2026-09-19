import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { logger } from "../../src/host/logger.js";

let log: jest.SpiedFunction<typeof console.log>;
let err: jest.SpiedFunction<typeof console.log>;

beforeEach(() => {
  log = jest.spyOn(console, "log").mockImplementation(() => {});
  err = jest.spyOn(console, "error").mockImplementation(() => {});
  logger.setVerbose(false);
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe("logger", () => {
  it("suppresses info unless verbose", () => {
    logger.info("hidden");
    expect(log).not.toHaveBeenCalled();
    logger.setVerbose(true);
    logger.info("shown");
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain("shown");
  });

  it("always writes warn and error to stderr", () => {
    logger.warn("w");
    logger.error("e");
    expect(err).toHaveBeenCalledTimes(2);
    expect(String(err.mock.calls[0][0])).toContain("w");
    expect(String(err.mock.calls[1][0])).toContain("e");
    expect(log).not.toHaveBeenCalled();
  });
});
