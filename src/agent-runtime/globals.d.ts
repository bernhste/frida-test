type Matcher<T> = import("./matchers.js").Matcher<T>;
type Spy = import("./matchers.js").Spy;
type TestFn = import("./registry.js").TestFn;
type HookFn = import("./registry.js").HookFn;

declare function describe(name: string, fn: TestFn): void;
declare function it(name: string, fn: TestFn): void;
declare function test(name: string, fn: TestFn): void;
declare function beforeEach(fn: HookFn): void;
declare function afterEach(fn: HookFn): void;
declare function beforeAll(fn: HookFn): void;
declare function afterAll(fn: HookFn): void;
declare function expect<T>(actual: T): Matcher<T>;
declare function spyOn<T extends object, K extends keyof T>(target: T, key: K): Spy;
