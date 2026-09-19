import chalk from "chalk";
import type { RunSummary } from "../protocol.js";
import { STATUS_SYMBOLS } from "./console.js";

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function formatCount(passed: number, failed: number, total: number): string {
  const parts: string[] = [];
  if (passed > 0) parts.push(chalk.green(`${passed} passed`));
  if (failed > 0) parts.push(chalk.red(`${failed} failed`));
  parts.push(`${total} total`);
  return parts.join(", ");
}

export function printSummary(runSummary: RunSummary): void {
  const { total, passed, failed, durationMs, testSuitesResults } = runSummary;
  const suitePassed = testSuitesResults.filter((s) => s.status === "passed").length;
  const suiteFailed = testSuitesResults.filter((s) => s.status === "failed").length;

  console.log();
  console.log("------------------------------------------------------------------------------");
  console.log();
  console.log(chalk.bold("Test Suites"));
  for (const suite of testSuitesResults) {
    const symbol = STATUS_SYMBOLS[suite.status] || "?";
    console.log(`  ${symbol} ${suite.name}`);

    if (suite.status === "failed" && suite.testResult?.error?.message) {
      for (const line of suite.testResult.error.message.split("\n")) {
        console.log(chalk.red(`      ${line}`));
      }
    }
  }

  console.log();
  console.log(chalk.bold("Summary"));
  console.log(`  Suites:   ${formatCount(suitePassed, suiteFailed, testSuitesResults.length)}`);
  console.log(`  Tests:    ${formatCount(passed, failed, total)}`);
  console.log(`  Duration: ${formatDuration(durationMs)}`);
  console.log();

  const badge = failed > 0 ? chalk.bgRed.black.bold(" FAIL ") : chalk.bgGreen.black.bold(" PASS ");
  const tail = failed > 0 ? chalk.red(`${failed} test(s) failed`) : chalk.green("All tests passed");
  console.log(`${badge} ${tail}`);
  console.log();
}
