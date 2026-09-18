import { isMock, type Mock } from "./mock.js";

export type Containable<T> = T extends readonly (infer U)[] ? U : T extends string ? string : never;
export type Numeric<T> = T extends number ? number : never;

export interface Assertions<T> {
  toBe(expected: T): void;
  toEqual(expected: T): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeNull(): void;
  toBeDefined(): void;
  toBeUndefined(): void;
  toBeGreaterThan(expected: Numeric<T>): void;
  toBeLessThan(expected: Numeric<T>): void;
  toContain(expected: Containable<T>): void;
  toThrow(errorMatch?: string | Error): void;
  toHaveBeenCalled(): void;
  toHaveBeenCalledTimes(expected: number): void;
  toHaveBeenCalledWith(...expected: unknown[]): void;
  toHaveBeenLastCalledWith(...expected: unknown[]): void;
  toHaveBeenNthCalledWith(n: number, ...expected: unknown[]): void;
}

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

const deepEqual = (a: unknown, b: unknown, seen: Array<[unknown, unknown]> = []): boolean => {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;

  const tagA = Object.prototype.toString.call(a);
  const tagB = Object.prototype.toString.call(b);
  if (tagA !== tagB) return false;

  if (a instanceof Date) return a.getTime() === (b as Date).getTime();
  if (a instanceof RegExp) return a.source === (b as RegExp).source && a.flags === (b as RegExp).flags;

  if (seen.some(([sa, sb]) => sa === a && sb === b)) return true;
  const nextSeen: Array<[unknown, unknown]> = [...seen, [a, b]];

  if (a instanceof Map) {
    const bm = b as Map<unknown, unknown>;
    if (a.size !== bm.size) return false;
    for (const [key, val] of a) {
      if (!bm.has(key) || !deepEqual(val, bm.get(key), nextSeen)) return false;
    }
    return true;
  }

  if (a instanceof Set) {
    // Match each element of `a` against a distinct, not-yet-consumed element of
    // `b` (rather than `some`), so a value appearing twice in `a` can't both be
    // satisfied by the same single matching element in `b`.
    const remaining = [...(b as Set<unknown>)];
    if (a.size !== remaining.length) return false;
    for (const val of a) {
      const index = remaining.findIndex((other) => deepEqual(val, other, nextSeen));
      if (index === -1) return false;
      remaining.splice(index, 1);
    }
    return true;
  }

  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keysA = Object.keys(ra).filter((k) => ra[k] !== undefined);
  const keysB = Object.keys(rb).filter((k) => rb[k] !== undefined);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => deepEqual(ra[k], rb[k], nextSeen));
};

function assertIsNumber(value: unknown, label: string): asserts value is number {
  assert(typeof value === "number", `Expected ${label} to be a number`);
}

// Shared with modifiers.ts so `.rejects.toThrow(errorMatch)` matches an already-caught rejection
// reason using the exact same rule as the synchronous `toThrow(errorMatch)`.
export function matchesThrown(caught: unknown, errorMatch: string | Error): boolean {
  if (typeof errorMatch === "string") {
    const message = caught instanceof Error ? caught.message : String(caught);
    return message.includes(errorMatch);
  }
  return caught instanceof Error && caught instanceof errorMatch.constructor && caught.message === errorMatch.message;
}

export function describeCaught(caught: unknown): string {
  return caught instanceof Error ? `${caught.constructor.name}: "${caught.message}"` : JSON.stringify(caught);
}

function describeErrorMatch(errorMatch: string | Error): string {
  return typeof errorMatch === "string" ? `a message including "${errorMatch}"` : `${errorMatch.constructor.name}: "${errorMatch.message}"`;
}

export function createMatcher<T>(actual: T, negated = false): Assertions<T> {
  const check = (condition: boolean, message: string): void => assert(negated ? !condition : condition, message);
  const phrase = negated ? "not to" : "to";

  return {
    toBe: (expected) => check(Object.is(actual, expected), `Expected ${String(actual)} ${phrase} be ${String(expected)}`),

    toEqual: (expected) =>
      check(deepEqual(actual, expected), `Expected ${JSON.stringify(actual, null, 2)} ${phrase} equal ${JSON.stringify(expected, null, 2)}`),

    toBeTruthy: () => check(Boolean(actual), `Expected ${String(actual)} ${phrase} be truthy`),
    toBeFalsy: () => check(!actual, `Expected ${String(actual)} ${phrase} be falsy`),
    toBeNull: () => check(actual === null, `Expected ${String(actual)} ${phrase} be null`),
    toBeDefined: () => check(actual !== undefined, `Expected ${String(actual)} ${phrase} be defined`),
    toBeUndefined: () => check(actual === undefined, `Expected ${String(actual)} ${phrase} be undefined`),

    toBeGreaterThan: (expected) => {
      assertIsNumber(actual, "actual");
      assertIsNumber(expected, "expected");
      check(actual > expected, `Expected ${actual} ${phrase} be greater than ${expected}`);
    },

    toBeLessThan: (expected) => {
      assertIsNumber(actual, "actual");
      assertIsNumber(expected, "expected");
      check(actual < expected, `Expected ${actual} ${phrase} be less than ${expected}`);
    },

    toContain: (expected) => {
      assert(typeof actual === "string" || Array.isArray(actual), "Expected an array or string");
      const contains =
        typeof actual === "string" ? actual.includes(expected as string) : (actual as readonly unknown[]).some((item) => deepEqual(item, expected));
      check(contains, `Expected ${JSON.stringify(actual)} ${phrase} contain ${JSON.stringify(expected)}`);
    },

    toThrow: (errorMatch) => {
      assert(typeof actual === "function", "Expected a function");
      let caught: unknown;
      let threw = false;
      let result: unknown;
      try {
        result = (actual as () => unknown)();
      } catch (e) {
        threw = true;
        caught = e;
      }

      if (!threw && result != null && typeof (result as PromiseLike<unknown>).then === "function") {
        // Avoid leaving the caller's promise unhandled while we redirect them to .rejects.
        void Promise.resolve(result as PromiseLike<unknown>).catch(() => {});
        throw new Error("toThrow() received a function returning a Promise; use await expect(fn()).rejects.toThrow(...) instead");
      }

      if (errorMatch === undefined) {
        check(threw, `Expected function ${phrase} throw`);
        return;
      }
      const matches = threw && matchesThrown(caught, errorMatch);
      check(
        matches,
        threw
          ? `Expected function ${phrase} throw ${describeErrorMatch(errorMatch)} but got ${describeCaught(caught)}`
          : `Expected function ${phrase} throw`,
      );
    },

    toHaveBeenCalled: () => {
      assert(isMock(actual), "Expected a mock function created with fn() or spyOn()");
      check((actual as Mock).mock.calls.length > 0, `Expected mock ${phrase} have been called`);
    },

    toHaveBeenCalledTimes: (expected: number) => {
      assert(isMock(actual), "Expected a mock function created with fn() or spyOn()");
      const count = (actual as Mock).mock.calls.length;
      check(count === expected, `Expected mock ${phrase} have been called ${expected} time(s) but it was called ${count} time(s)`);
    },

    toHaveBeenCalledWith: (...expected: unknown[]) => {
      assert(isMock(actual), "Expected a mock function created with fn() or spyOn()");
      const calls = (actual as Mock).mock.calls;
      const match = calls.some((args) => deepEqual(args, expected));
      check(match, `Expected mock ${phrase} have been called with ${JSON.stringify(expected)} but got ${JSON.stringify(calls)}`);
    },

    toHaveBeenLastCalledWith: (...expected: unknown[]) => {
      assert(isMock(actual), "Expected a mock function created with fn() or spyOn()");
      const calls = (actual as Mock).mock.calls;
      const last = calls[calls.length - 1];
      const match = calls.length > 0 && deepEqual(last, expected);
      check(
        match,
        `Expected mock ${phrase} have last been called with ${JSON.stringify(expected)} but got ${calls.length > 0 ? JSON.stringify(last) : "no calls"}`,
      );
    },

    toHaveBeenNthCalledWith: (n: number, ...expected: unknown[]) => {
      assert(isMock(actual), "Expected a mock function created with fn() or spyOn()");
      assert(Number.isInteger(n) && n >= 1, "Expected the call index to be a positive integer");
      const calls = (actual as Mock).mock.calls;
      const call = calls[n - 1];
      const match = call !== undefined && deepEqual(call, expected);
      check(
        match,
        `Expected mock ${phrase} have been called on call ${n} with ${JSON.stringify(expected)} but got ${call !== undefined ? JSON.stringify(call) : "no such call"}`,
      );
    },
  };
}
