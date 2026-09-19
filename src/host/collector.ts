import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const TEST_FILE_SUFFIX = ".test.ts";
const EXCLUDED_DIR_NAMES = new Set(["node_modules", ".git"]);

async function walkDirectory(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });

  const found = await Promise.all(
    entries.map((entry) => {
      if (entry.isDirectory()) {
        return EXCLUDED_DIR_NAMES.has(entry.name) ? [] : walkDirectory(join(dirPath, entry.name));
      }
      if (entry.isFile() && entry.name.endsWith(TEST_FILE_SUFFIX)) {
        return [join(dirPath, entry.name)];
      }
      return [];
    }),
  );

  return found.flat();
}

async function findTestFiles(absolutePath: string): Promise<string[]> {
  let fileInfo;
  try {
    fileInfo = await stat(absolutePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Path does not exist: ${absolutePath}`, { cause: err });
    }
    throw new Error(`Unable to access path "${absolutePath}": ${(err as Error).message}`, { cause: err });
  }

  if (fileInfo.isDirectory()) {
    return walkDirectory(absolutePath);
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
