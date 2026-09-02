import { writeFile } from "node:fs/promises";
import { logger } from "../logger.js";
import type { RunSummary } from "../protocol/protocol.js";

export async function writeRunSummaryJson(result: RunSummary, outPath: string): Promise<void> {
  await writeFile(outPath, JSON.stringify(result, null, 2), "utf-8");
  logger.info(`JSON report saved to ${outPath}`);
}
