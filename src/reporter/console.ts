import { logger } from "../logger.js";
import { type TestResult, type TestStatus, type TestSuiteResult } from "../protocol.js";

const STATUS_SYMBOLS: Record<TestStatus, string> = {
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
  if (suite.status == "failed") {
    logger.warn(`Test suite "${suite.name}" failed:`);
  } else if (suite.status == "passed") {
    logger.success(`Test suite "${suite.name}" passed:`);
  }
  if (suite.testResult) {
    printTestResult(suite.testResult, 1);
  } else {
    logger.warn(`No results for test suite  "${suite.name}".`);
  }
}
