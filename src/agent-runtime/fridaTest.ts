import { fn, type AnyFn, type Mock } from "./mock.js";
import { spyOn } from "./spy.js";

export interface FridaTest {
  fn(implementation?: AnyFn): Mock;
  spyOn<T extends object, K extends keyof T>(target: T, key: K): Mock;
}

export const fridaTest: FridaTest = { fn, spyOn };
