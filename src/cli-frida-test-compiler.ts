const usage = `
  Usage: frida-test-compiler [options] <src_path>...

  Options:
    -o, --out <path>                Path of the output file for JSON reporter (default: disabled)
    -h, --help                      Show this help message
`;

import { writeFile } from "node:fs/promises";
import { bundleAgent } from "./bundler.js";
import { collectTestSuitePaths } from "./collector.js";

const args = process.argv.slice(2);

let outPath: string | undefined;
const srcPaths: string[] = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === "-o" || arg === "--out") {
    outPath = args[++i];
  } else if (arg === "-h" || arg === "--help") {
    console.log(usage);
    process.exit(0);
  } else {
    srcPaths.push(arg);
  }
}

if (srcPaths.length === 0) {
  console.error(usage);
  process.exit(1);
}

const testSuitePaths = await collectTestSuitePaths(srcPaths);

const bundle = await bundleAgent(testSuitePaths);

if (outPath) {
  await writeFile(outPath, bundle, "utf8");
} else {
  console.log(bundle);
}
