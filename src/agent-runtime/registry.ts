import { type AgentMessage, type RunSummary, type TestError, type TestResult, type TestStatus, type TestSuiteResult } from "frida-test/protocol.js";

export type TestFn = () => void | Promise<void>;
export type HookFn = () => void | Promise<void>;

type NodeKind = "describe" | "it";

interface TestSuiteNode {
  kind: NodeKind;
  name: string;
  fn: TestFn;
  children?: TestSuiteNode[];
  hooks?: HooksBag;
}

interface HooksBag {
  beforeEach: HookFn[];
  afterEach: HookFn[];
  beforeAll: HookFn[];
  afterAll: HookFn[];
}

interface EachHooks {
  beforeEach: HookFn[];
  afterEach: HookFn[];
}

function createHooksBag(): HooksBag {
  return { beforeEach: [], afterEach: [], beforeAll: [], afterAll: [] };
}

interface Frame {
  children: TestSuiteNode[];
  hooks: HooksBag;
}

export const registry: TestSuiteNode[] = [];
const rootHooks: HooksBag = createHooksBag();
const stack: Frame[] = [{ children: registry, hooks: rootHooks }];

function currentFrame(): Frame {
  return stack[stack.length - 1];
}

function registerNode(kind: NodeKind, name: string, fn: TestFn): void {
  currentFrame().children.push({ kind, name, fn });
}

export const describe = (name: string, fn: TestFn): void => registerNode("describe", name, fn);

export const it = (name: string, fn: TestFn): void => registerNode("it", name, fn);
export const test = it; // alias

export const beforeEach = (fn: HookFn): void => {
  currentFrame().hooks.beforeEach.push(fn);
};

export const afterEach = (fn: HookFn): void => {
  currentFrame().hooks.afterEach.push(fn);
};

export const beforeAll = (fn: HookFn): void => {
  currentFrame().hooks.beforeAll.push(fn);
};

export const afterAll = (fn: HookFn): void => {
  currentFrame().hooks.afterAll.push(fn);
};

function serializeError(err: unknown, verbose: boolean): TestError {
  if (err instanceof Error) {
    return { message: err.message, stack: verbose ? err.stack : undefined };
  }
  return { message: String(err) };
}

// Setup hooks (beforeEach/beforeAll): stop at the first failure since later hooks may depend on earlier ones.
async function runSetupHooks(hooks: HookFn[], verbose: boolean): Promise<TestError | undefined> {
  for (const hook of hooks) {
    try {
      await hook();
    } catch (err) {
      return serializeError(err, verbose);
    }
  }
  return undefined;
}

// Teardown hooks (afterEach/afterAll): run every hook regardless of earlier failures, to give cleanup a chance to run.
async function runTeardownHooks(hooks: HookFn[], verbose: boolean): Promise<TestError | undefined> {
  let firstError: TestError | undefined;
  for (const hook of hooks) {
    try {
      await hook();
    } catch (err) {
      firstError ??= serializeError(err, verbose);
    }
  }
  return firstError;
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

async function expand(node: TestSuiteNode, verbose: boolean): Promise<{ children: TestSuiteNode[]; hooks: HooksBag; error?: TestError }> {
  return withExpandLock(async () => {
    const frame: Frame = { children: [], hooks: createHooksBag() };
    stack.push(frame);
    try {
      await node.fn();
      return { children: frame.children, hooks: frame.hooks };
    } catch (err) {
      return { children: frame.children, hooks: frame.hooks, error: serializeError(err, verbose) };
    } finally {
      stack.pop();
    }
  });
}

async function runTestSuiteNode(node: TestSuiteNode, verbose: boolean, parentHooks: EachHooks): Promise<{ result: TestResult; counts: Counts }> {
  const start = Date.now();

  if (node.kind === "describe") {
    const { children: nodes, hooks, error } = await expand(node, verbose);
    node.children = nodes;
    node.hooks = hooks;

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

    const combinedHooks: EachHooks = {
      beforeEach: [...parentHooks.beforeEach, ...hooks.beforeEach],
      afterEach: [...hooks.afterEach, ...parentHooks.afterEach],
    };

    const beforeAllError = await runSetupHooks(hooks.beforeAll, verbose);
    if (beforeAllError) {
      const children: TestResult[] = nodes.map((child) => ({
        name: child.name,
        status: "failed",
        durationMs: 0,
        error: { message: `parent suite "${node.name}" failed before this test could run` },
      }));
      await runTeardownHooks(hooks.afterAll, verbose);
      const counts: Counts = { total: 1 + children.length, passed: 0, failed: 1 + children.length };
      const result: TestResult = {
        name: node.name,
        status: "failed",
        durationMs: Date.now() - start,
        error: beforeAllError,
        children,
      };
      return { result, counts };
    }

    const children: TestResult[] = [];
    let counts = ZERO_COUNTS;
    for (const child of node.children) {
      const childRun = await runTestSuiteNode(child, verbose, combinedHooks);
      children.push(childRun.result);
      counts = addCounts(counts, childRun.counts);
    }

    const afterAllError = await runTeardownHooks(hooks.afterAll, verbose);
    if (afterAllError) {
      children.push({ name: "afterAll hook", status: "failed", durationMs: 0, error: afterAllError });
      counts = addCounts(counts, { total: 1, passed: 0, failed: 1 });
    }

    const status: TestStatus = counts.failed > 0 ? "failed" : "passed";
    const result: TestResult = { name: node.name, status, durationMs: Date.now() - start, children };
    return { result, counts };
  }

  // Leaf test.
  const beforeEachError = await runSetupHooks(parentHooks.beforeEach, verbose);
  let result: TestResult;
  let counts: Counts;
  if (beforeEachError) {
    result = { name: node.name, status: "failed", durationMs: 0, error: beforeEachError };
    counts = { total: 1, passed: 0, failed: 1 };
  } else {
    try {
      await node.fn();
      result = { name: node.name, status: "passed", durationMs: 0 };
      counts = { total: 1, passed: 1, failed: 0 };
    } catch (err) {
      result = { name: node.name, status: "failed", durationMs: 0, error: serializeError(err, verbose) };
      counts = { total: 1, passed: 0, failed: 1 };
    }
  }

  const afterEachError = await runTeardownHooks(parentHooks.afterEach, verbose);
  if (afterEachError && result.status === "passed") {
    result = { ...result, status: "failed", error: afterEachError };
    counts = { total: 1, passed: 0, failed: 1 };
  }

  return { result: { ...result, durationMs: Date.now() - start }, counts };
}

export async function runTests(nodes: TestSuiteNode[], emit: (message: AgentMessage) => void, verbose: boolean = false): Promise<RunSummary> {
  const start = Date.now();

  const beforeAllError = await runSetupHooks(rootHooks.beforeAll, verbose);
  if (beforeAllError) {
    const testSuitesResults: TestSuiteResult[] = nodes.map((node) => {
      emit({ type: "test-suite-started", name: node.name });
      const testResult: TestResult = { name: node.name, status: "failed", durationMs: 0, error: beforeAllError };
      const suiteResult: TestSuiteResult = { name: node.name, testResult, status: "failed" };
      emit({ type: "test-suite-finished", name: node.name, result: suiteResult });
      return suiteResult;
    });
    await runTeardownHooks(rootHooks.afterAll, verbose);
    return { total: nodes.length, passed: 0, failed: nodes.length, durationMs: Date.now() - start, testSuitesResults };
  }

  const parentHooks: EachHooks = { beforeEach: rootHooks.beforeEach, afterEach: rootHooks.afterEach };

  const settled = await Promise.allSettled(
    nodes.map(async (node) => {
      emit({ type: "test-suite-started", name: node.name });
      const { result: testResult, counts } = await runTestSuiteNode(node, verbose, parentHooks);
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

  const afterAllError = await runTeardownHooks(rootHooks.afterAll, verbose);
  if (afterAllError) {
    testSuitesResults.push({
      name: "afterAll hook",
      status: "failed",
      testResult: { name: "afterAll hook", status: "failed", durationMs: 0, error: afterAllError },
    });
    counts = addCounts(counts, { total: 1, passed: 0, failed: 1 });
  }

  return { ...counts, durationMs: Date.now() - start, testSuitesResults };
}
