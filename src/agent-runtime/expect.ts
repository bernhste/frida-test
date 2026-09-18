import { createExpectMatcher, type Matchers } from "./modifiers.js";

export function expect<T>(actual: T): Matchers<T> {
  return createExpectMatcher(actual);
}
