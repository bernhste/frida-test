import { expect, spyOn, type Matcher, type Spy } from "./matchers.js";
import type { HookFn, TestFn } from "./registry.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, test } from "./registry.js";

declare global {
  function describe(name: string, fn: TestFn): void;
  function it(name: string, fn: TestFn): void;
  function test(name: string, fn: TestFn): void;
  function beforeEach(fn: HookFn): void;
  function afterEach(fn: HookFn): void;
  function beforeAll(fn: HookFn): void;
  function afterAll(fn: HookFn): void;
  function expect<T>(actual: T): Matcher<T>;
  function spyOn<T extends object, K extends keyof T>(target: T, key: K): Spy;
}

Object.assign(globalThis, { describe, it, test, beforeEach, afterEach, beforeAll, afterAll, expect, spyOn });
