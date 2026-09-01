import chalk from "chalk";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import { bundleAgent } from "./bundler.js";
import { collectTestSuitePaths } from "./collector.js";
import { resolveDevice, resolveTarget, type DeviceSelector, type TargetDef } from "./device.js";
import { logger } from "./logger.js";
import { writeRunSummaryJson } from "./reporter/json.js";
import { printSummary } from "./reporter/summary.js";
import { TestRunner } from "./runner.js";

const usage = `
  Usage: frida-test [options] <src_path>...

  Options:
    -i, --id <id>                   Bundle/package id or app name (spawns the app)
    -p, --pid <id>                  Attach to a running process instead
    -U, --usb                       Use the USB device
    -D, --device <id>               Use a specific device by id
    -o, --out <path>                Path of the output file for JSON reporter (default: disabled)
    -t, --timeout <s>               Abort the run after this many seconds (default: 600, 0 disables)
    -d, --delay <s>                 Start running the test suites after this many seconds (default: 0)
    -k, --keep                      Keep the generated agent in .frida-test/agent.js
    -v, --verbose                   Enable verbose logging
    -h, --help                      Show this help message

  Examples:
    frida-test -U -i org.owasp.mastestapp ./test -r json -o ./testing/reports/out.json
    frida-test -U --pid 4926 ./src/hooks.test.ts ./lib/utils
`;

class CliError extends Error {}

function fail(message: string): never {
  throw new CliError(message);
}

function parseNonNegativeInt(value: unknown, name: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return n;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      id: { type: "string", short: "i" },
      pid: { type: "string", short: "p" },
      usb: { type: "boolean", short: "U", default: false },
      device: { type: "string", short: "D" },
      out: { type: "string", short: "o" },
      delay: { type: "string", short: "d", default: "0" },
      timeout: { type: "string", short: "t", default: "600" },
      keep: { type: "boolean", short: "k", default: false },
      verbose: { type: "boolean", short: "v", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(usage);
    return;
  }

  logger.setVerbose(values.verbose);

  if (positionals.length === 0) {
    fail("Missing required argument <src_path>...");
  }

  if (Boolean(values.id) === Boolean(values.pid)) {
    fail("Must provide either --id (-i) or --pid (-p), but not both");
  }

  let targetDef: TargetDef;
  if (values.id) {
    targetDef = { id: values.id };
  } else {
    const parsedPid = parseNonNegativeInt(values.pid, "pid");
    if (parsedPid === 0) fail("Invalid pid: must be greater than 0");
    targetDef = { pid: parsedPid };
  }

  const delay = parseNonNegativeInt(values.delay, "delay");
  const timeout = parseNonNegativeInt(values.timeout, "timeout");

  const deviceSelector: DeviceSelector = values.device !== undefined ? { id: values.device } : values.usb ? "usb" : "local";

  logger.info(`Collecting tests from ${positionals.join(", ")}...`);
  const testSuitePaths = await collectTestSuitePaths(positionals);

  logger.info(`Bundling testSuites with frida-test agent...`);
  const agentBundle = await bundleAgent(testSuitePaths, values.keep);

  logger.info(`Resolving devices...`);
  const device = await resolveDevice(deviceSelector);

  logger.info(`Resolving target...`);
  const target = await resolveTarget(device, targetDef);

  const runner = new TestRunner(device, target, agentBundle, values.verbose);

  try {
    logger.info(`Starting frida-test agent on the remote device...`);
    await runner.initialize();

    if (delay > 0) {
      logger.info(`Waiting ${delay} second(s) before starting tests...`);
      await sleep(delay * 1000);
    }

    let timerId: ReturnType<typeof globalThis.setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      if (timeout > 0) {
        timerId = globalThis.setTimeout(() => {
          reject(new Error(`Test execution timed out after ${timeout} second(s)`));
        }, timeout * 1000);
      }
    });

    let runSummary;
    try {
      runSummary = await Promise.race([runner.runTests(), timeoutPromise]);
    } finally {
      if (timerId) globalThis.clearTimeout(timerId);
    }

    if (values.out) {
      await writeRunSummaryJson(runSummary, values.out);
    }

    printSummary(runSummary);
  } finally {
    await runner.dispose();
  }
}

main().catch((error: unknown) => {
  if (error instanceof CliError) {
    logger.error(error.message);
    console.log(chalk.dim(usage));
  } else {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Fatal error: ${msg}`);
  }
  process.exitCode = 1;
});
