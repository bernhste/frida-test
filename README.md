# frida-test Documentation

This is a small test framework which runs on the target. It is used to unit test Frida code running on actual devices. It was originally developed to test the Frida agent code used in [frooky](https://github.com/cpholguera/frooky).

The following chapters explain how to write and run tests.

## Installation

```sh
npm install --save-dev frida-test

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

### Test discovery

The framework collects every file matching `*.test.ts` in the directories passed on the command line, recursively.

A good practice is to create test files next to the source code file as shown here:

```text
myProject/
├── android/
│   ├── classLoader.ts
│   └── classLoader.test.ts
├── ios/
│   ├── objcRuntime.ts
│   └── objcRuntime.test.ts
└── shared/
    ├── helper.ts
    └── helper.test.ts

```

## Matchers

`expect(actualValue)` returns a `Matcher` which we can use to test for the expected value. Use the following functions to do that:

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
| `.toContain(value)` | Value (array, string, etc.) contains `value` |
| `.toThrow(errorMatch)` | Exception thrown; optionally matches a string message or `Error` instance |
| `.toReject(errorMatch)` | Returned promise rejects; optionally matches a string message or `Error` instance (must be `await`ed) |
| `.toHaveBeenCalled()` | Spy target function was called at least once |
| `.toHaveBeenCalledWith(...expected)` | Spy target function was called with expected arguments |
| `.not.<matcher>` | Inverts the assertion result |

> [!NOTE]
> `frida-test` test itself. So for examples for all Matches and more, have a look a the `*.test.ts` located in the [test folder](./tests/)

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

## Compile Agent

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
