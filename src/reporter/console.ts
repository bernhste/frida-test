import { logger } from "../logger.js";
import { type TestResult, type TestStatus, type TestSuiteResult } from "../protocol.js";

export const STATUS_SYMBOLS: Record<TestStatus, string> = {
  passed: "✅",
  failed: "❌",
  skipped: "➖",
};

function printTestResult(node: TestResult, depth: number = 0): void {
  const indent = "  ".repeat(depth);
  const symbol = STATUS_SYMBOLS[node.status] || "?";

  console.log(`${indent}${symbol} ${node.name} (${node.durationMs}ms)`);

  if (node.error) {
    const errorIndent = "  ".repeat(depth + 1);
    console.error(`${errorIndent}Error: ${node.error.message}`);
    if (node.error.stack) {
      console.error(`${errorIndent}${node.error.stack.replace(/\n/g, `\n${errorIndent}`)}`);
    }
  }

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      printTestResult(child, depth + 1);
    }
  }
}

export function printTestSuiteResult(suite: TestSuiteResult): void {
  const symbol = STATUS_SYMBOLS[suite.status] || "?";
  console.log(`${symbol} Test suite "${suite.name}" ${suite.status}:`);

  if (suite.testResult) {
    printTestResult(suite.testResult, 1);
  } else if (suite.status !== "skipped") {
    logger.warn(`No results for test suite "${suite.name}".`);
  }
}
