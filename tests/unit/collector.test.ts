import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectTestSuitePaths } from "../../src/host/collector.js";

let root: string;

async function touch(rel: string): Promise<string> {
  const p = join(root, rel);
  await mkdir(join(p, ".."), { recursive: true });
  await writeFile(p, "");
  return p;
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "collector-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("collectTestSuitePaths", () => {
  it("finds *.test.ts files recursively, sorted", async () => {
    const b = await touch("b.test.ts");
    const a = await touch("sub/deep/a.test.ts");
    await touch("plain.ts");
    await touch("x.test.js");
    expect(await collectTestSuitePaths([root])).toEqual([b, a].sort());
  });

  it("skips node_modules and .git", async () => {
    const ok = await touch("ok.test.ts");
    await touch("node_modules/pkg/x.test.ts");
    await touch(".git/y.test.ts");
    expect(await collectTestSuitePaths([root])).toEqual([ok]);
  });

  it("accepts a single test file", async () => {
    const f = await touch("one.test.ts");
    expect(await collectTestSuitePaths([f])).toEqual([f]);
  });

  it("deduplicates overlapping paths", async () => {
    const f = await touch("one.test.ts");
    expect(await collectTestSuitePaths([root, f, f])).toEqual([f]);
  });

  it("returns empty for a directory without tests", async () => {
    await touch("a.ts");
    expect(await collectTestSuitePaths([root])).toEqual([]);
  });

  it("rejects a non-test file", async () => {
    const f = await touch("a.ts");
    await expect(collectTestSuitePaths([f])).rejects.toThrow(/Not a \*\.test\.ts file/);
  });

  it("rejects a missing path", async () => {
    await expect(collectTestSuitePaths([join(root, "missing")])).rejects.toThrow(/Path does not exist/);
  });
});
