# frida-test Documentation

[![Test frida-test](https://github.com/bernhste/frida-test/actions/workflows/test.yml/badge.svg)](https://github.com/bernhste/frida-test/actions/workflows/test.yml)

This is a small test framework which runs on the target. It is used to unit test Frida code running on actual devices. It was originally developed to test the Frida agent code used in [frooky](https://github.com/cpholguera/frooky).

The following chapters explain how to write and run tests.

## Installation

```sh
npm install --save-dev frida-test
```

After the installation, import the type `frida-test` into your project by adding the following configuration to the `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["frida-test"]
  }
}
```

## Writing Tests

Tests follow the Behavior-Driven Development (BDD) pattern. They use the describe-it-expect structure to describe the expected behavior.

The basic syntax is:

- `describe()`: Defines a test suite or a specific component's behavior.
- `test()` or `it()`: Describes a specific requirement or expected outcome.
- `expect()`: Validates that the actual output matches the expected behavior.

```typescript
describe('Classloader', () => {
  it('should throw an exception if the class is not available.', () => {
    expect(() => {
      ClassLoader.loadSync('badClass')
    }).toThrow(new Error("Class 'badClass' is not available."));
  })
});
```

Tests can be nested to any depth and can be synchronous or asynchronous.

## Matchers

`expect(actualValue)` returns a `Matchers` object which we can use to test for the expected value. Use the following functions to do that:

| Matcher | Description |
| --- | --- |
| `.toBe(value)` | Strict equality (`===`) |
| `.toEqual(value)` | Deep equality |
| `.toBeTruthy()` | Value is truthy |
| `.toBeFalsy()` | Value is falsy |
| `.toBeNull()` | Value is strictly `null` |
| `.toBeDefined()` | Value is not `undefined` |
| `.toBeUndefined()` | Value is `undefined` |
| `.toBeGreaterThan(value)` | Numeric value is greater than `value` |
| `.toBeLessThan(value)` | Numeric value is less than `value` |
| `.toContain(value)` | Array, `Set`, or string contains `value` (array/`Set` items compared with `===`) |
| `.toContainEqual(value)` | Array or `Set` contains an item deeply equal to `value` |
| `.toThrow(errorMatch?)` | Function throws; `errorMatch` can be a substring, a `RegExp` matched against the message, an `Error` instance (message equality only), or an `Error` class (`instanceof` check) |
| `.toHaveBeenCalled()` | Mock/spy was called at least once |
| `.toHaveBeenCalledTimes(count)` | Mock/spy was called exactly `count` times |
| `.toHaveBeenCalledWith(...expected)` | Mock/spy was called (at any point) with the expected arguments |
| `.toHaveBeenLastCalledWith(...expected)` | Mock/spy's most recent call had the expected arguments |
| `.toHaveBeenNthCalledWith(n, ...expected)` | Mock/spy's `n`th call (1-indexed) had the expected arguments |

> [!NOTE]
> `frida-test` tests itself. So for examples of all matchers and more, have a look at the `*.test.ts` files located in the [test folder](./tests/).

### Modifiers

| Modifier | Description |
| --- | --- |
| `.not` | Inverts the assertion result, e.g. `expect(2 + 2).not.toBe(5)` |
| `.resolves` | Unwraps a resolved promise so a matcher applies to its value; the assertion must be `await`ed. The received value must actually be a `Promise` - it fails otherwise |
| `.rejects` | Unwraps a rejected promise so a matcher applies to its reason; the assertion must be `await`ed. The received value must actually be a `Promise` - it fails otherwise |

```typescript
await expect(fetchUser(1)).resolves.toEqual({ id: 1, name: 'Ada' });
await expect(fetchUser(-1)).rejects.toThrow('not found');

// modifiers compose:
await expect(fetchUser(1)).resolves.not.toBeNull();
```

## Mocking

`frida-test` mocks and spies follow the same API shape as Jest's mock functions.

- `fn(implementation?)`: creates a standalone mock function, optionally backed by `implementation`.
- `spyOn(object, methodName)`: replaces `object[methodName]` with a mock that calls through to the original method by default, and can be restored later.

Both are also reachable through `fridaTest`, a global namespace object analogous to [Jest's `jest` object](https://jestjs.io/docs/jest-object) (`fridaTest.fn(...)`, `fridaTest.spyOn(...)`) - it only exposes what's implemented above, not the full Jest object surface (no fake timers or module mocking).

Both forms return the same `Mock` type:

```typescript
const mock = fridaTest.fn((a: number, b: number) => a + b);
mock(1, 2);

expect(mock).toHaveBeenCalledWith(1, 2);
mock.mock.calls;       // [[1, 2]]
mock.mock.results;     // [{ type: "return", value: 3 }]

mock.mockReturnValue(42);       // set a default return value
mock.mockReturnValueOnce(99);   // ...for just the next call
mock.mockResolvedValue(value);  // wraps value in Promise.resolve()
mock.mockRejectedValue(error);  // wraps error in Promise.reject()
mock.mockImplementation(impl);    // replace the implementation
mock.mockImplementationOnce(impl); // ...for just the next call

mock.mockClear();   // reset calls/results, keep the implementation
mock.mockReset();   // reset calls/results and drop the implementation
mock.mockRestore(); // reset like mockReset(); for spyOn(), also restores the original method
```

```typescript
describe('Logger', () => {
  it('should call the underlying console method', () => {
    const spy = fridaTest.spyOn(console, 'log').mockImplementation(() => undefined);
    logMessage('hello');
    expect(spy).toHaveBeenCalledWith('hello');
    spy.mockRestore();
  });
});
```

### Setup and Teardown

Use `beforeEach()` / `afterEach()` and `beforeAll()` / `afterAll()` to run code before or after tests. They can be declared at the top level of a file or inside a `describe()` block:

- `beforeEach()` / `afterEach()`: Run before/after every `it()` in the same and nested `describe()` blocks.
- `beforeAll()` / `afterAll()`: Run once before/after all tests in the same `describe()` block (or, at the top level, once before/after the whole file).

Hooks declared in an outer `describe()` also apply to tests in nested `describe()` blocks. `beforeEach` hooks run outer-to-inner; `afterEach` hooks run inner-to-outer.

```typescript
describe('ClassLoader', () => {
  let loader: ClassLoader;

  beforeAll(() => {
    loader = new ClassLoader();
  });

  beforeEach(() => {
    loader.reset();
  });

  afterEach(() => {
    loader.clearCache();
  });

  afterAll(() => {
    loader.destroy();
  });

  it('should load a known class', () => {
    expect(loader.load('com.example.Foo')).toBeDefined();
  });
});
```

## Running Tests

`frida-test` takes one or more directories, collects every `*.test.ts` file below them, compiles them together with the framework agent, and runs the resulting agent on the target.

```sh
frida-test [options] <dir...>
```

### Options

| Option | Description |
| --- | --- |
| `-D, --device <id>` | Connect to device with the given ID |
| `-U, --usb` | Connect to USB device |
| `-R, --remote` | Connect to remote frida-server |
| `-H, --host <host>` | Connect to remote frida-server on HOST |
| `--certificate <cert>` | Speak TLS with HOST, expecting CERTIFICATE |
| `--origin <origin>` | Connect to remote server with "Origin" header set to ORIGIN |
| `--token <token>` | Authenticate with HOST using TOKEN |
| `--keepalive-interval <interval>` | Set keepalive interval in seconds, or 0 to disable (defaults to -1) |
| `-f, --file <target>` | Spawn FILE |
| `-F, --attach-frontmost` | Attach to frontmost application |
| `-n, --attach-name <name>` | Attach to NAME |
| `-N, --attach-identifier <id>` | Attach to IDENTIFIER |
| `-p, --attach-pid <pid>` | Attach to PID |
| `-o, --out <path>` | Path of the output file for JSON reporter (default: disabled) |
| `-t, --timeout <s>` | Abort the run after this many seconds (default: `600`, `0` disables) |
| `-d, --delay <s>` | Start running the test suites after this many seconds (default: `0`) |
| `-k, --keep` | Keep the generated agent in `.frida-test/agent.js` |
| `-v, --verbose` | Enable verbose logging |
| `-h, --help` | Shows the help message |

### `frida-test` Examples

```sh
# Spawn an Android app on a USB device, tests in ./tests/android and ./tests/shared
frida-test -U -f org.owasp.mastestapp ./tests/android ./tests/shared

# Attach to a running process by PID on a USB device
frida-test -U -p 4926 ./tests/android

# Attach to a running iOS app by identifier
frida-test -U -N org.owasp.mastestapp.MASTestApp-iOS ./tests/ios ./tests/shared

# Connect to a remote frida-server on HOST with authentication
frida-test -H 192.168.1.10:27042 --token secret -p 4926 ./tests/shared
```

## Compiling the Agent

`frida-test` automatically bundles the test suites and compiles them together with the testing framework into a Frida agent.

If you only want to compile this agent, use `frida-test-compile`:

```sh
frida-test-compile [options] <dir...>
```

| Option | Description |
| --- | --- |
| `-o, --out <path>` | Path of the output file for JSON reporter (default: disabled) |
| `-h, --help` | Shows the help message |

### `frida-test-compile` Examples

```sh
# Collects all tests in ./tests, compiles the frida-test agent, and prints it to stdout
frida-test-compile ./tests

# Collects all tests in ./tests, compiles the frida-test agent, and stores it in ./frida-test-agent.js
frida-test-compile ./tests -o ./frida-test-agent.js
```
