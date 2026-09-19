import { describe, expect, it } from "@jest/globals";
import { isAgentMessage } from "../../src/host/protocol.js";

describe("isAgentMessage", () => {
  it.each(["agent-ready", "test-suite-started", "test-suite-finished", "run-finished"])("accepts type %s", (type) => {
    expect(isAgentMessage({ type })).toBe(true);
  });

  it.each([null, undefined, 42, "agent-ready", [], {}, { type: 1 }, { type: "nope" }, { type: "toString" }, { type: "constructor" }])(
    "rejects %p",
    (value) => {
      expect(isAgentMessage(value)).toBe(false);
    },
  );
});
