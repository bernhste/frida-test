// `any` (not `unknown`) so a concretely-typed function - e.g. `fn((a: number, b: number) => a + b)` -
// is assignable here; with `unknown` parameters, strict function-parameter variance would reject it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFn = (...args: any[]) => any;

export interface MockResult {
  readonly type: "return" | "throw";
  readonly value: unknown;
}

export interface MockContext {
  readonly calls: readonly unknown[][];
  readonly results: readonly MockResult[];
  readonly instances: readonly unknown[];
  readonly contexts: readonly unknown[];
  readonly lastCall: readonly unknown[] | undefined;
}

export interface Mock {
  (...args: unknown[]): unknown;
  readonly mock: MockContext;
  mockClear(): Mock;
  mockReset(): Mock;
  mockRestore(): void;
  mockImplementation(implementation: AnyFn): Mock;
  mockImplementationOnce(implementation: AnyFn): Mock;
  mockReturnValue(value: unknown): Mock;
  mockReturnValueOnce(value: unknown): Mock;
  mockResolvedValue(value: unknown): Mock;
  mockResolvedValueOnce(value: unknown): Mock;
  mockRejectedValue(value: unknown): Mock;
  mockRejectedValueOnce(value: unknown): Mock;
  mockReturnThis(): Mock;
  mockName(name: string): Mock;
  getMockName(): string;
}

export const isMock = (value: unknown): value is Mock => typeof value === "function" && Array.isArray((value as Partial<Mock>).mock?.calls);

export function createMockFunction(defaultImplementation: AnyFn | undefined, name: string): Mock {
  const calls: unknown[][] = [];
  const results: MockResult[] = [];
  const instances: unknown[] = [];
  const contexts: unknown[] = [];
  const onceQueue: AnyFn[] = [];
  let persistentImplementation: AnyFn | undefined = defaultImplementation;
  let mockedName = name;

  function invoke(this: unknown, ...args: unknown[]): unknown {
    calls.push(args);
    contexts.push(this);
    if (new.target !== undefined) instances.push(this);

    const impl = onceQueue.shift() ?? persistentImplementation ?? ((): undefined => undefined);
    try {
      const value = impl.apply(this, args);
      results.push({ type: "return", value });
      return value;
    } catch (error) {
      results.push({ type: "throw", value: error });
      throw error;
    }
  }

  const mock = invoke as unknown as Mock;

  Object.defineProperty(mock, "mock", {
    enumerable: true,
    get(): MockContext {
      return {
        calls,
        results,
        instances,
        contexts,
        lastCall: calls.length > 0 ? calls[calls.length - 1] : undefined,
      };
    },
  });

  mock.mockClear = (): Mock => {
    calls.length = 0;
    results.length = 0;
    instances.length = 0;
    contexts.length = 0;
    return mock;
  };

  mock.mockReset = (): Mock => {
    mock.mockClear();
    onceQueue.length = 0;
    persistentImplementation = undefined;
    return mock;
  };

  mock.mockRestore = (): void => {
    mock.mockReset();
  };

  mock.mockImplementation = (implementation: AnyFn): Mock => {
    persistentImplementation = implementation;
    return mock;
  };

  mock.mockImplementationOnce = (implementation: AnyFn): Mock => {
    onceQueue.push(implementation);
    return mock;
  };

  mock.mockReturnValue = (value: unknown): Mock => mock.mockImplementation((): unknown => value);
  mock.mockReturnValueOnce = (value: unknown): Mock => mock.mockImplementationOnce((): unknown => value);
  mock.mockResolvedValue = (value: unknown): Mock => mock.mockImplementation((): Promise<unknown> => Promise.resolve(value));
  mock.mockResolvedValueOnce = (value: unknown): Mock => mock.mockImplementationOnce((): Promise<unknown> => Promise.resolve(value));
  mock.mockRejectedValue = (value: unknown): Mock => mock.mockImplementation((): Promise<unknown> => Promise.reject(value));
  mock.mockRejectedValueOnce = (value: unknown): Mock => mock.mockImplementationOnce((): Promise<unknown> => Promise.reject(value));
  mock.mockReturnThis = (): Mock =>
    mock.mockImplementation(function (this: unknown): unknown {
      return this;
    });

  mock.mockName = (newName: string): Mock => {
    mockedName = newName;
    return mock;
  };
  mock.getMockName = (): string => mockedName;

  return mock;
}

export function fn(implementation?: AnyFn): Mock {
  return createMockFunction(implementation, "fn()");
}
