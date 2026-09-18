type Matchers<T> = import("./modifiers.js").Matchers<T>;
type Mock = import("./mock.js").Mock;
type AnyFn = import("./mock.js").AnyFn;
type FridaTest = import("./fridaTest.js").FridaTest;
type TestFn = import("./registry.js").TestFn;
type HookFn = import("./registry.js").HookFn;

declare function describe(name: string, fn: TestFn): void;
declare function it(name: string, fn: TestFn): void;
declare function test(name: string, fn: TestFn): void;
declare function beforeEach(fn: HookFn): void;
declare function afterEach(fn: HookFn): void;
declare function beforeAll(fn: HookFn): void;
declare function afterAll(fn: HookFn): void;
declare function expect<T>(actual: T): Matchers<T>;
declare function spyOn<T extends object, K extends keyof T>(target: T, key: K): Mock;
declare function fn(implementation?: AnyFn): Mock;
declare var fridaTest: FridaTest;
