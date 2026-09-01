import { expect, spyOn, type Matcher, type Spy } from "./matchers.js";
import type { TestFn } from "./registry.js";
import { describe, it, test } from "./registry.js";

declare global {
  function describe(name: string, fn: TestFn): void;
  function it(name: string, fn: TestFn): void;
  function test(name: string, fn: TestFn): void;
  function expect<T>(actual: T): Matcher<T>;
  function spyOn<T extends object, K extends keyof T>(target: T, key: K): Spy;
}

Object.assign(globalThis, { describe, it, test, expect, spyOn });
