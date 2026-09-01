type Matcher<T> = import("./matchers.js").Matcher<T>;
type Spy = import("./matchers.js").Spy;
type TestFn = import("./registry.js").TestFn;

declare function describe(name: string, fn: TestFn): void;
declare function it(name: string, fn: TestFn): void;
declare function test(name: string, fn: TestFn): void;
declare function expect<T>(actual: T): Matcher<T>;
declare function spyOn<T extends object, K extends keyof T>(target: T, key: K): Spy;
