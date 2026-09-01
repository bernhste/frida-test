import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { logger } from "./logger.js";

const IMPORT_MARKER = "/// IMPORT TESTS SUITES ///";
const execFileAsync = promisify(execFile);

const AGENT_ENTRYPOINT_FILENAME = "agentRuntime.ts";
const AGENT_ENTRYPOINT_BASENAME = path.basename(AGENT_ENTRYPOINT_FILENAME, path.extname(AGENT_ENTRYPOINT_FILENAME));
const AGENT_BUNDLE_FILENAME = `${AGENT_ENTRYPOINT_BASENAME}.bundle.js`;

function resolveProjectRoot(startDir: string = process.cwd()): string {
  let dir = startDir;
  while (true) {
    if (existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

function resolveAgentRuntimePath(projectRoot: string): string {
  return path.join(projectRoot, "src", "agent-runtime");
}

function resolveFridaCompileBin(projectRoot: string): string {
  const binName = process.platform === "win32" ? "frida-compile.cmd" : "frida-compile";
  return path.join(projectRoot, "node_modules", ".bin", binName);
}

let cachedProjectRoot: string | undefined;
let cachedAgentRuntimeSrcDir: string | undefined;
let cachedFridaCompileBin: { path: string; useLocal: boolean } | undefined;

function getProjectRoot(): string {
  cachedProjectRoot ??= resolveProjectRoot();
  return cachedProjectRoot;
}

function getAgentRuntimeSrcDir(projectRoot: string): string {
  if (!cachedAgentRuntimeSrcDir) {
    const dir = resolveAgentRuntimePath(projectRoot);
    if (!existsSync(dir)) {
      throw new Error(`Agent runtime source directory not found at "${dir}".`);
    }
    cachedAgentRuntimeSrcDir = dir;
  }
  return cachedAgentRuntimeSrcDir;
}

function getFridaCompileBin(projectRoot: string): { path: string; useLocal: boolean } {
  if (!cachedFridaCompileBin) {
    const localBin = resolveFridaCompileBin(projectRoot);
    cachedFridaCompileBin = existsSync(localBin) ? { path: localBin, useLocal: true } : { path: "npx", useLocal: false };
  }
  return cachedFridaCompileBin;
}

async function createWorkDir(projectRoot: string): Promise<string> {
  const cacheRoot = path.join(projectRoot, ".frida-test-cache");
  await mkdir(cacheRoot, { recursive: true });

  const gitignorePath = path.join(cacheRoot, ".gitignore");
  if (!existsSync(gitignorePath)) {
    await writeFile(gitignorePath, "*\n", "utf8");
  }

  return mkdtemp(cacheRoot + path.sep);
}

async function deleteWorkDir(workDir: string): Promise<void> {
  try {
    return await rm(workDir, { recursive: true, force: true });
  } catch (err) {
    logger.warn(`Failed to remove temporary work dir "${workDir}": ${(err as Error).message}`);
  }
}

async function copyDirRecursive(srcDir: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        await copyDirRecursive(srcPath, destPath);
        return;
      }

      await copyFile(srcPath, destPath);
    }),
  );
}

export async function bundleAgent(testSuitePaths: string[], keep: boolean = false): Promise<string> {
  if (testSuitePaths.length === 0) {
    throw new Error("bundleAgent requires at least one test suite path.");
  }

  const projectRoot = getProjectRoot();
  const workDir = await createWorkDir(projectRoot);

  try {
    const agentRuntimeSrcDir = getAgentRuntimeSrcDir(projectRoot);
    await copyDirRecursive(agentRuntimeSrcDir, workDir);

    const entrypointPath = path.join(workDir, AGENT_ENTRYPOINT_FILENAME);

    const agentSource = await readFile(entrypointPath, "utf8");
    if (!agentSource.includes(IMPORT_MARKER)) {
      throw new Error(`Marker "${IMPORT_MARKER}" not found in ${entrypointPath}`);
    }

    const importStatements = testSuitePaths
      .map((suitePath) => {
        const absolute = path.resolve(suitePath).replace(/\\/g, "/");
        const specifier = absolute.replace(/\.tsx?$/, "");
        return `import ${JSON.stringify(specifier)};`;
      })
      .join("\n");

    await rm(entrypointPath, { force: true });
    await writeFile(entrypointPath, agentSource.replace(IMPORT_MARKER, importStatements), "utf8");

    const outfilePath = path.join(workDir, AGENT_BUNDLE_FILENAME);
    const fridaCompile = getFridaCompileBin(projectRoot);

    let stdout: string;
    let stderr: string;
    try {
      const args = fridaCompile.useLocal ? [entrypointPath, "-o", outfilePath] : ["frida-compile", entrypointPath, "-o", outfilePath];

      ({ stdout, stderr } = await execFileAsync(fridaCompile.path, args, {
        cwd: projectRoot,
        shell: process.platform === "win32",
      }));
    } catch (err) {
      throw new Error(
        `frida-compile failed for entrypoint "${entrypointPath}" with suites [${testSuitePaths.join(", ")}]: ${(err as Error).message}`,
        { cause: err },
      );
    }

    if (stdout.trim()) logger.log(`[frida-compile] ${stdout.trim()}`);
    if (stderr.trim()) logger.warn(`[frida-compile] ${stderr.trim()}`);

    return await readFile(outfilePath, "utf8");
  } finally {
    if (!keep) {
      await deleteWorkDir(workDir);
    }
  }
}
