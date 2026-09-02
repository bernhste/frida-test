import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./logger.js";

const IMPORT_MARKER = "/// IMPORT TESTS SUITES ///";
const AGENT_ENTRYPOINT_FILENAME = "agentRuntime.ts";
const AGENT_ENTRYPOINT_BASENAME = path.parse(AGENT_ENTRYPOINT_FILENAME).name;
const AGENT_BUNDLE_FILENAME = `${AGENT_ENTRYPOINT_BASENAME}.bundle.js`;

function getProjectRoot(): string {
  const startDir = process.cwd();
  let dir = startDir;
  while (true) {
    if (existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

function getPackageRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (true) {
    if (existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("Could not locate frida-test's own package.json.");
    }
    dir = parent;
  }
}

function getAgentRuntimeSrcDir(): string {
  const dir = path.join(getPackageRoot(), "src", "agent-runtime");
  if (!existsSync(dir)) {
    throw new Error(`Agent runtime source directory not found at "${dir}".`);
  }
  return dir;
}

function getFridaCompileBin(projectRoot: string): { path: string; useLocal: boolean } {
  const binName = process.platform === "win32" ? "frida-compile.cmd" : "frida-compile";
  const localBin = path.join(projectRoot, "node_modules", ".bin", binName);
  return existsSync(localBin) ? { path: localBin, useLocal: true } : { path: "npx", useLocal: false };
}

async function createWorkDir(projectRoot: string): Promise<string> {
  const workdirRoot = path.join(projectRoot, ".frida-test-cache");
  await mkdir(workdirRoot, { recursive: true });

  const gitignorePath = path.join(workdirRoot, ".gitignore");
  if (!existsSync(gitignorePath)) {
    await writeFile(gitignorePath, "*\n", "utf8");
  }

  const workdir = await mkdtemp(workdirRoot + path.sep);
  logger.info(`Temporary workdir created at ${workdir}`);

  return workdir;
}

async function deleteWorkDir(workDir: string): Promise<void> {
  try {
    return await rm(workDir, { recursive: true, force: true });
  } catch (err) {
    logger.warn(`Failed to remove temporary work dir "${workDir}": ${(err as Error).message}`);
  }
}

export async function bundleAgent(testSuitePaths: string[], keep: boolean = false): Promise<string> {
  if (testSuitePaths.length === 0) {
    throw new Error("bundleAgent requires at least one test suite path.");
  }

  const projectRoot = getProjectRoot();
  const workDir = await createWorkDir(projectRoot);

  try {
    const agentRuntimeSrcDir = getAgentRuntimeSrcDir();
    logger.info(`Agent runtime found in ${agentRuntimeSrcDir}`);
    await cp(agentRuntimeSrcDir, workDir, { recursive: true });

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

    const args = fridaCompile.useLocal ? [entrypointPath, "-o", outfilePath] : ["frida-compile", entrypointPath, "-o", outfilePath];

    try {
      execFileSync(fridaCompile.path, args, {
        cwd: projectRoot,
        shell: process.platform === "win32",
        encoding: "utf8",
      });
    } catch (err) {
      const stderr = (err as { stderr?: Buffer | string }).stderr?.toString().trim();
      throw new Error(
        `frida-compile failed for entrypoint "${entrypointPath}" with suites [${testSuitePaths.join(", ")}]: ${stderr || (err as Error).message}`,
        { cause: err },
      );
    }

    logger.info(`Agent bundle sucessfully created and saved at ${outfilePath}.`);

    return await readFile(outfilePath, "utf8");
  } finally {
    if (!keep) {
      logger.info(`Cleaning up workdir.`);
      await deleteWorkDir(workDir);
    }
  }
}
