import { type AgentMessage, type RunSummary, type TestError, type TestResult, type TestStatus, type TestSuiteResult } from "../../src/protocol.js";

export type TestFn = () => void | Promise<void>;

type NodeKind = "describe" | "it";

interface TestSuiteNode {
  kind: NodeKind;
  name: string;
  fn: TestFn;
  children?: TestSuiteNode[];
}

export const registry: TestSuiteNode[] = [];
const stack: TestSuiteNode[][] = [];

function registerNode(kind: NodeKind, name: string, fn: TestFn): void {
  (stack.at(-1) ?? registry).push({ kind, name, fn });
}

export const describe = (name: string, fn: TestFn): void => registerNode("describe", name, fn);

export const it = (name: string, fn: TestFn): void => registerNode("it", name, fn);
export const test = it; // alias

function serializeError(err: unknown, verbose: boolean): TestError {
  if (err instanceof Error) {
    return { message: err.message, stack: verbose ? err.stack : undefined };
  }
  return { message: String(err) };
}

interface Counts {
  total: number;
  passed: number;
  failed: number;
}

const ZERO_COUNTS: Counts = { total: 0, passed: 0, failed: 0 };

function addCounts(a: Counts, b: Counts): Counts {
  return { total: a.total + b.total, passed: a.passed + b.passed, failed: a.failed + b.failed };
}

let expandLock: Promise<void> = Promise.resolve();

function withExpandLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = expandLock.then(fn, fn);
  expandLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function expand(node: TestSuiteNode, verbose: boolean): Promise<{ children: TestSuiteNode[]; error?: TestError }> {
  return withExpandLock(async () => {
    const children: TestSuiteNode[] = [];
    stack.push(children);
    try {
      await node.fn();
      return { children };
    } catch (err) {
      return { children, error: serializeError(err, verbose) };
    } finally {
      stack.pop();
    }
  });
}

async function runTestSuiteNode(node: TestSuiteNode, verbose: boolean): Promise<{ result: TestResult; counts: Counts }> {
  const start = Date.now();

  if (node.kind === "describe") {
    const { children: nodes, error } = await expand(node, verbose);
    node.children = nodes;

    if (error) {
      const children: TestResult[] = nodes.map((child) => ({
        name: child.name,
        status: "failed",
        durationMs: 0,
        error: { message: `parent suite "${node.name}" failed before this test could run` },
      }));
      const counts: Counts = { total: 1 + children.length, passed: 0, failed: 1 + children.length };
      const result: TestResult = {
        name: node.name,
        status: "failed",
        durationMs: Date.now() - start,
        error,
        children,
      };
      return { result, counts };
    }

    const children: TestResult[] = [];
    let counts = ZERO_COUNTS;
    for (const child of node.children) {
      const childRun = await runTestSuiteNode(child, verbose);
      children.push(childRun.result);
      counts = addCounts(counts, childRun.counts);
    }

    const status: TestStatus = counts.failed > 0 ? "failed" : "passed";
    const result: TestResult = { name: node.name, status, durationMs: Date.now() - start, children };
    return { result, counts };
  }

  // Leaf test.
  try {
    await node.fn();
    const result: TestResult = { name: node.name, status: "passed", durationMs: Date.now() - start };
    return { result, counts: { total: 1, passed: 1, failed: 0 } };
  } catch (err) {
    const result: TestResult = {
      name: node.name,
      status: "failed",
      durationMs: Date.now() - start,
      error: serializeError(err, verbose),
    };
    return { result, counts: { total: 1, passed: 0, failed: 1 } };
  }
}

export async function runTests(nodes: TestSuiteNode[], emit: (message: AgentMessage) => void, verbose: boolean = false): Promise<RunSummary> {
  const start = Date.now();

  const settled = await Promise.allSettled(
    nodes.map(async (node) => {
      emit({ type: "test-suite-started", name: node.name });
      const { result: testResult, counts } = await runTestSuiteNode(node, verbose);
      const suiteResult: TestSuiteResult = { name: node.name, testResult, status: testResult.status };
      emit({ type: "test-suite-finished", name: node.name, result: suiteResult });
      return { suiteResult, counts };
    }),
  );

  const testSuitesResults: TestSuiteResult[] = [];
  let counts = ZERO_COUNTS;

  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      testSuitesResults.push(outcome.value.suiteResult);
      counts = addCounts(counts, outcome.value.counts);
      return;
    }

    const error = serializeError(outcome.reason, verbose);
    const testSuiteResult: TestSuiteResult = {
      name: nodes[i].name,
      testResult: { name: nodes[i].name, status: "failed", durationMs: 0, error },
      status: "failed",
    };
    testSuitesResults.push(testSuiteResult);
    counts = addCounts(counts, { total: 1, passed: 0, failed: 1 });
  });

  return { ...counts, durationMs: Date.now() - start, testSuitesResults };
}
