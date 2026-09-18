import { createMatcher, describeCaught, matchesThrown, type Assertions } from "./matchers.js";

export interface Matchers<T> extends Assertions<T> {
  readonly not: Matchers<T>;
  readonly resolves: AsyncMatcher<Awaited<T>>;
  readonly rejects: AsyncMatcher<unknown>;
}

type Promisify<M> = {
  [K in keyof M]: M[K] extends (...args: infer A) => void ? (...args: A) => Promise<void> : never;
};

export interface AsyncMatcher<T> extends Promisify<Assertions<T>> {
  readonly not: AsyncMatcher<T>;
}

type SyncMethodName = keyof Assertions<unknown>;

type Settled = { ok: true; value: unknown } | { ok: false; value: unknown };

async function settle(awaited: unknown): Promise<Settled> {
  try {
    return { ok: true, value: await awaited };
  } catch (error) {
    return { ok: false, value: error };
  }
}

function createAsyncMatcher<T>(awaited: unknown, mode: "resolves" | "rejects", negated: boolean): AsyncMatcher<T> {
  async function invoke(method: SyncMethodName, args: unknown[]): Promise<void> {
    const result = await settle(awaited);

    if (mode === "resolves") {
      if (!result.ok) {
        throw new Error(`Expected promise to resolve but it rejected with ${describeCaught(result.value)}`);
      }
      const sync = createMatcher(result.value, negated) as unknown as Record<SyncMethodName, (...a: unknown[]) => void>;
      sync[method](...args);
      return;
    }

    // mode === "rejects"
    if (result.ok) {
      throw new Error(`Expected promise to reject but it resolved with ${JSON.stringify(result.value)}`);
    }

    if (method === "toThrow") {
      const [errorMatch] = args as [string | Error | undefined];
      const matches = errorMatch === undefined || matchesThrown(result.value, errorMatch);
      const passed = negated ? !matches : matches;
      if (!passed) {
        const phrase = negated ? "not to" : "to";
        throw new Error(
          errorMatch === undefined
            ? `Expected promise ${phrase} reject`
            : `Expected promise ${phrase} reject with a matching error but got ${describeCaught(result.value)}`,
        );
      }
      return;
    }

    const sync = createMatcher(result.value, negated) as unknown as Record<SyncMethodName, (...a: unknown[]) => void>;
    sync[method](...args);
  }

  return new Proxy({} as AsyncMatcher<T>, {
    get(_target, prop: string | symbol): unknown {
      if (prop === "not") return createAsyncMatcher(awaited, mode, !negated);
      return (...args: unknown[]): Promise<void> => invoke(prop as SyncMethodName, args);
    },
  });
}

export function createResolvesMatcher<T>(awaited: unknown, negated = false): AsyncMatcher<T> {
  return createAsyncMatcher<T>(awaited, "resolves", negated);
}

export function createRejectsMatcher<T>(awaited: unknown, negated = false): AsyncMatcher<T> {
  return createAsyncMatcher<T>(awaited, "rejects", negated);
}

export function createExpectMatcher<T>(actual: T, negated = false): Matchers<T> {
  return {
    ...createMatcher(actual, negated),
    get not(): Matchers<T> {
      return createExpectMatcher(actual, !negated);
    },
    get resolves(): AsyncMatcher<Awaited<T>> {
      return createResolvesMatcher(actual, negated);
    },
    get rejects(): AsyncMatcher<unknown> {
      return createRejectsMatcher(actual, negated);
    },
  };
}
