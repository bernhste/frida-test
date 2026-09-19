import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RunSummary, TestSuiteResult } from "../../src/host/protocol.js";
import { printTestSuiteResult, STATUS_SYMBOLS } from "../../src/host/reporter/console.js";
import { writeRunSummaryJson } from "../../src/host/reporter/json.js";
import { printSummary } from "../../src/host/reporter/summary.js";

let log: jest.SpiedFunction<typeof console.log>;
let err: jest.SpiedFunction<typeof console.log>;
const out = (spy: typeof log) => spy.mock.calls.map((c) => c.join(" ")).join("\n");
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const strip = (s: string) => s.replace(ANSI, "");

beforeEach(() => {
  log = jest.spyOn(console, "log").mockImplementation(() => {});
  err = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe("printTestSuiteResult", () => {
  it("prints nested results with indentation, errors and stacks", () => {
    const suite: TestSuiteResult = {
      name: "s",
      status: "failed",
      testResult: {
        name: "root",
        status: "failed",
        durationMs: 5,
        children: [
          { name: "ok", status: "passed", durationMs: 1 },
          { name: "bad", status: "failed", durationMs: 2, error: { message: "boom", stack: "a\nb" } },
        ],
      },
    };
    printTestSuiteResult(suite);
    const lines = log.mock.calls.map((c) => c[0]);
    expect(lines[0]).toBe(`${STATUS_SYMBOLS.failed} Test suite "s" failed:`);
    expect(lines[1]).toBe(`  ${STATUS_SYMBOLS.failed} root (5ms)`);
    expect(lines).toContain(`    ${STATUS_SYMBOLS.passed} ok (1ms)`);
    expect(lines).toContain(`    ${STATUS_SYMBOLS.failed} bad (2ms)`);
    expect(err.mock.calls.map((c) => c[0])).toEqual(["      Error: boom", "      a\n      b"]);
  });

  it("warns when a non-skipped suite has no results", () => {
    printTestSuiteResult({ name: "empty", status: "passed" });
    expect(strip(out(err))).toContain('No results for test suite "empty".');
  });

  it("does not warn for a skipped suite without results", () => {
    printTestSuiteResult({ name: "skip", status: "skipped" });
    expect(err).not.toHaveBeenCalled();
  });
});

describe("printSummary", () => {
  const base: RunSummary = {
    total: 3,
    passed: 3,
    failed: 0,
    durationMs: 250,
    testSuitesResults: [{ name: "a", status: "passed" }],
  };

  it("reports a passing run", () => {
    printSummary(base);
    const text = strip(out(log));
    expect(text).toContain("Suites:   1 passed, 1 total");
    expect(text).toContain("Tests:    3 passed, 3 total");
    expect(text).toContain("Duration: 250ms");
    expect(text).toContain("PASS");
    expect(text).toContain("All tests passed");
  });

  it("reports failures with error messages and seconds formatting", () => {
    printSummary({
      total: 2,
      passed: 1,
      failed: 1,
      durationMs: 1500,
      testSuitesResults: [
        { name: "a", status: "passed" },
        { name: "b", status: "failed", testResult: { name: "b", status: "failed", durationMs: 1, error: { message: "l1\nl2" } } },
      ],
    });
    const text = strip(out(log));
    expect(text).toContain("Suites:   1 passed, 1 failed, 2 total");
    expect(text).toContain("Duration: 1.50s");
    expect(text).toContain("      l1");
    expect(text).toContain("      l2");
    expect(text).toContain("FAIL");
    expect(text).toContain("1 test(s) failed");
  });
});

describe("writeRunSummaryJson", () => {
  it("writes pretty JSON to the given path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "report-"));
    try {
      const file = join(dir, "r.json");
      const summary: RunSummary = { total: 1, passed: 1, failed: 0, durationMs: 1, testSuitesResults: [] };
      await writeRunSummaryJson(summary, file);
      const text = await readFile(file, "utf-8");
      expect(JSON.parse(text)).toEqual(summary);
      expect(text).toContain("\n  ");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
