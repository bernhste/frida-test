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
    -D, --device <id>               Connect to device with the given ID
    -U, --usb                       Connect to USB device
    -R, --remote                    Connect to remote frida-server
    -H, --host <host>               Connect to remote frida-server on HOST
    --certificate <cert>            Speak TLS with HOST, expecting CERTIFICATE
    --origin <origin>               Connect to remote server with "Origin" header set to ORIGIN
    --token <token>                 Authenticate with HOST using TOKEN
    --keepalive-interval <interval> Set keepalive interval in seconds, or 0 to disable (defaults to -1)
    -f, --file <target>             Spawn FILE
    -F, --attach-frontmost          Attach to frontmost application
    -n, --attach-name <name>        Attach to NAME
    -N, --attach-identifier <id>    Attach to IDENTIFIER
    -p, --attach-pid <pid>          Attach to PID
    -o, --out <path>                Path of the output file for JSON reporter (default: disabled)
    -t, --timeout <s>               Abort the run after this many seconds (default: 600, 0 disables)
    -d, --delay <s>                 Start running the test suites after this many seconds (default: 0)
    -k, --keep                      Keep the generated agent in .frida-test/agent.js
    -v, --verbose                   Enable verbose logging
    -h, --help                      Show this help message

  Examples:
    frida-test -U -f org.owasp.mastestapp ./test -o ./testing/reports/out.json
    frida-test -H 192.168.1.10:27042 --token secret -p 4926 ./src/hooks.test.ts
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

function parseKeepaliveInterval(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < -1) {
    throw new Error("keepalive-interval must be an integer >= -1");
  }
  return n;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      // Device options
      device: { type: "string", short: "D" },
      usb: { type: "boolean", short: "U", default: false },
      remote: { type: "boolean", short: "R", default: false },
      host: { type: "string", short: "H" },
      certificate: { type: "string" },
      origin: { type: "string" },
      token: { type: "string" },
      "keepalive-interval": { type: "string" },

      // Target options
      file: { type: "string", short: "f" },
      "attach-frontmost": { type: "boolean", short: "F", default: false },
      "attach-name": { type: "string", short: "n" },
      "attach-identifier": { type: "string", short: "N" },
      "attach-pid": { type: "string", short: "p" },

      // Test runner options
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

  const primaryDeviceFlags = [values.device !== undefined, values.usb, values.remote, values.host !== undefined].filter(Boolean).length;

  if (primaryDeviceFlags > 1) {
    fail("Cannot specify multiple primary device options (-D, -U, -R, -H)");
  }

  const hasRemoteParams =
    values.certificate !== undefined || values.origin !== undefined || values.token !== undefined || values["keepalive-interval"] !== undefined;

  if (hasRemoteParams && (values.device !== undefined || values.usb)) {
    fail("Remote connection options (--certificate, --origin, --token, --keepalive-interval) cannot be used with -D or -U");
  }

  let deviceSelector: DeviceSelector;
  if (values.device !== undefined) {
    deviceSelector = { id: values.device };
  } else if (values.usb) {
    deviceSelector = "usb";
  } else if (values.host !== undefined || values.remote || hasRemoteParams) {
    const keepaliveInterval = values["keepalive-interval"] !== undefined ? parseKeepaliveInterval(values["keepalive-interval"]) : undefined;

    deviceSelector = {
      host: values.host ?? "127.0.0.1:27042",
      ...(values.certificate && { certificate: values.certificate }),
      ...(values.origin && { origin: values.origin }),
      ...(values.token && { token: values.token }),
      ...(keepaliveInterval !== undefined && { keepaliveInterval }),
    };
  } else {
    deviceSelector = "local";
  }

  const targetFlags = [
    values.file !== undefined ? "file" : null,
    values["attach-frontmost"] ? "attach-frontmost" : null,
    values["attach-name"] !== undefined ? "attach-name" : null,
    values["attach-identifier"] !== undefined ? "attach-identifier" : null,
    values["attach-pid"] !== undefined ? "attach-pid" : null,
  ].filter(Boolean);

  if (targetFlags.length === 0) {
    fail("Must provide a target option: -f, -F, -n, -N, or -p");
  }

  if (targetFlags.length > 1) {
    fail("Must provide only one target option (-f, -F, -n, -N, or -p)");
  }

  let targetDef: TargetDef;
  if (values.file !== undefined) {
    targetDef = { file: values.file };
  } else if (values["attach-frontmost"]) {
    targetDef = { frontmost: true };
  } else if (values["attach-name"] !== undefined) {
    targetDef = { name: values["attach-name"] };
  } else if (values["attach-identifier"] !== undefined) {
    targetDef = { identifier: values["attach-identifier"] };
  } else {
    const parsedPid = parseNonNegativeInt(values["attach-pid"], "attach-pid");
    if (parsedPid === 0) fail("Invalid pid: must be greater than 0");
    targetDef = { pid: parsedPid };
  }

  const delay = parseNonNegativeInt(values.delay, "delay");
  const timeout = parseNonNegativeInt(values.timeout, "timeout");

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
