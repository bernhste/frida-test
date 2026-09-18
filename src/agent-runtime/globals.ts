import { expect } from "./expect.js";
import { fridaTest, type FridaTest } from "./fridaTest.js";
import { fn, type AnyFn, type Mock } from "./mock.js";
import type { Matchers } from "./modifiers.js";
import type { HookFn, TestFn } from "./registry.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, test } from "./registry.js";
import { spyOn } from "./spy.js";

declare global {
  function describe(name: string, fn: TestFn): void;
  function it(name: string, fn: TestFn): void;
  function test(name: string, fn: TestFn): void;
  function beforeEach(fn: HookFn): void;
  function afterEach(fn: HookFn): void;
  function beforeAll(fn: HookFn): void;
  function afterAll(fn: HookFn): void;
  function expect<T>(actual: T): Matchers<T>;
  function spyOn<T extends object, K extends keyof T>(target: T, key: K): Mock;
  function fn(implementation?: AnyFn): Mock;
  var fridaTest: FridaTest;
}

Object.assign(globalThis, { describe, it, test, beforeEach, afterEach, beforeAll, afterAll, expect, spyOn, fn, fridaTest });
