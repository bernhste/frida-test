export type Containable<T> = T extends readonly (infer U)[] ? U : T extends string ? string : never;
export type Numeric<T> = T extends number ? number : never;

export interface Matcher<T> {
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
  toResolve(valueMatch?: unknown): Promise<void>;
  toReject(errorMatch?: string | Error): Promise<void>;
  toHaveBeenCalled(): void;
  toHaveBeenCalledWith(...expected: unknown[]): void;
  readonly not: Matcher<T>;
}

export interface Spy {
  readonly calls: readonly unknown[][];
  restore(): void;
  mockReturnValue(value: unknown): Spy;
  mockImplementation(fn: (...args: unknown[]) => unknown): Spy;
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
    const bs = [...(b as Set<unknown>)];
    if (a.size !== bs.length) return false;
    for (const val of a) {
      if (!bs.some((other) => deepEqual(val, other, nextSeen))) return false;
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

const isSpy = (value: unknown): value is Spy => typeof value === "object" && value !== null && Array.isArray((value as Spy).calls);

function assertIsNumber(value: unknown, label: string): asserts value is number {
  assert(typeof value === "number", `Expected ${label} to be a number`);
}

function createMatcher<T>(actual: T, negated = false): Matcher<T> {
  const check = (condition: boolean, message: string): void => assert(negated ? !condition : condition, message);
  const phrase = negated ? "not to" : "to";

  const describeCaught = (caught: unknown): string =>
    caught instanceof Error ? `${caught.constructor.name}: "${caught.message}"` : JSON.stringify(caught);

  const checkThrown = (caught: unknown, errorMatch: string | Error): void => {
    if (typeof errorMatch === "string") {
      const message = caught instanceof Error ? caught.message : String(caught);
      assert(message.includes(errorMatch), `Expected message to include "${errorMatch}" but got "${message}"`);
    } else {
      assert(
        caught instanceof Error && caught instanceof errorMatch.constructor && caught.message === errorMatch.message,
        `Expected ${errorMatch.constructor.name}: "${errorMatch.message}" but got ${describeCaught(caught)}`,
      );
    }
  };

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
        throw new Error("toThrow() received a function returning a Promise; use await expect(fn).toReject(...) instead");
      }

      check(threw, `Expected function ${phrase} throw`);
      if (negated || errorMatch === undefined) return;
      checkThrown(caught, errorMatch);
    },

    toResolve: async (expected) => {
      assert(typeof actual === "function", "Expected a function returning a promise");
      let caught: unknown;
      let resolved = false;
      try {
        caught = await (actual as () => Promise<unknown>)();
        resolved = true;
      } catch (e) {
        // promise rejected
      }
      check(resolved, `Expected promise ${phrase} resolve`);
      if (negated || expected === undefined) return;
      assert(deepEqual(caught, expected), `Expected ${JSON.stringify(caught)} to equal ${JSON.stringify(expected)}`);
    },

    toReject: async (errorMatch) => {
      assert(typeof actual === "function", "Expected a function returning a promise");
      let caught: unknown;
      let rejected = false;
      try {
        await (actual as () => Promise<unknown>)();
      } catch (e) {
        rejected = true;
        caught = e;
      }
      check(rejected, `Expected promise ${phrase} reject`);
      if (negated || errorMatch === undefined) return;
      checkThrown(caught, errorMatch);
    },

    toHaveBeenCalled: () => {
      assert(isSpy(actual), "Expected a spy created with spyOn()");
      check((actual as Spy).calls.length > 0, `Expected spy ${phrase} have been called`);
    },

    toHaveBeenCalledWith: (...expected: unknown[]) => {
      assert(isSpy(actual), "Expected a spy created with spyOn()");
      const calls = (actual as Spy).calls;
      const match = calls.some((args) => deepEqual(args, expected));
      check(match, `Expected spy ${phrase} have been called with ${JSON.stringify(expected)} but got ${JSON.stringify(calls)}`);
    },

    get not(): Matcher<T> {
      return createMatcher(actual, !negated);
    },
  };
}

export function expect<T>(actual: T): Matcher<T> {
  return createMatcher(actual);
}

export function spyOn<T extends object, K extends keyof T>(target: T, key: K): Spy {
  const original = target[key];
  assert(typeof original === "function", `${String(key)} is not a function`);

  const descriptor = Object.getOwnPropertyDescriptor(target, key); // fix: capture descriptor for faithful restore
  const calls: unknown[][] = [];
  let impl: (...args: unknown[]) => unknown = (original as (...a: unknown[]) => unknown).bind(target);
  let returnValue: unknown;
  let hasReturnValue = false;
  let restored = false;

  const spy: Spy = {
    calls,
    restore: () => {
      if (restored) return;
      restored = true;
      if (descriptor) {
        Object.defineProperty(target, key, descriptor);
      } else {
        Reflect.deleteProperty(target, key);
      }
    },
    mockReturnValue(value: unknown) {
      hasReturnValue = true;
      returnValue = value;
      return spy;
    },
    mockImplementation(fn: (...args: unknown[]) => unknown) {
      impl = fn;
      hasReturnValue = false;
      return spy;
    },
  };

  target[key] = ((...args: unknown[]) => {
    calls.push(args);
    return hasReturnValue ? returnValue : impl(...args);
  }) as T[K];

  return spy;
}
