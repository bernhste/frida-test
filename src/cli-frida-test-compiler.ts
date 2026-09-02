import chalk from "chalk";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { bundleAgent } from "./bundler.js";
import { collectTestSuitePaths } from "./collector.js";
import { logger } from "./logger.js";

const usage = `
  Usage: frida-test-compiler [options] <src_path>...

  Options:
    -o, --out <path>                Path of the output file for JSON reporter (default: disabled)
    -h, --help                      Show this help message
`;

class CliError extends Error {}

function fail(message: string): never {
  throw new CliError(message);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: "string", short: "o" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(usage);
    return;
  }

  if (positionals.length === 0) {
    fail("Missing required argument <src_path>...");
  }

  const testSuitePaths = await collectTestSuitePaths(positionals);

  const bundle = await bundleAgent(testSuitePaths);

  if (values.out) {
    await writeFile(values.out, bundle, "utf8");
  } else {
    console.log(bundle);
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
