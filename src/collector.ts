import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const TEST_FILE_SUFFIX = ".test.ts";

async function findTestFiles(absolutePath: string): Promise<string[]> {
  let fileInfo;
  try {
    fileInfo = await stat(absolutePath);
  } catch (err) {
    throw new Error(`Path does not exist: ${absolutePath}`, { cause: err });
  }

  if (fileInfo.isDirectory()) {
    const entries = await readdir(absolutePath, {
      recursive: true,
      withFileTypes: true,
    });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith(TEST_FILE_SUFFIX)).map((entry) => join(entry.parentPath, entry.name));
  }

  if (absolutePath.endsWith(TEST_FILE_SUFFIX)) {
    return [absolutePath];
  }

  throw new Error(`Not a *${TEST_FILE_SUFFIX} file: ${absolutePath}`);
}

export async function collectTestSuitePaths(srcPaths: string[]): Promise<string[]> {
  const results = await Promise.all(srcPaths.map((p) => findTestFiles(resolve(p))));

  return [...new Set(results.flat())].sort();
}
