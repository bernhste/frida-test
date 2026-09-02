export type TestStatus = "passed" | "failed" | "skipped";

export interface TestError {
  message: string;
  stack?: string;
}

export interface TestResult {
  name: string;
  status: TestStatus;
  durationMs: number;
  error?: TestError;
  children?: TestResult[];
}

export interface TestSuiteResult {
  name: string;
  status: TestStatus;
  testResult?: TestResult;
}

export type AgentMessage =
  | { type: "agent-ready" }
  | { type: "test-suite-started"; name: string }
  | { type: "test-suite-finished"; name: string; result: TestSuiteResult }
  | { type: "run-finished" };

export function isAgentMessage(value: unknown): value is AgentMessage {
  if (typeof value !== "object" || value === null) return false;
  const { type } = value as { type?: unknown };
  return type === "agent-ready" || type === "test-suite-started" || type === "test-suite-finished" || type === "run-finished";
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  testSuitesResults: TestSuiteResult[];
}
