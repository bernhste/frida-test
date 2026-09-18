import { createMockFunction, type AnyFn, type Mock } from "./mock.js";

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export function spyOn<T extends object, K extends keyof T>(target: T, key: K): Mock {
  const original = target[key];
  assert(typeof original === "function", `${String(key)} is not a function`);

  // Capture the descriptor so restore can put things back exactly as they were, including
  // whether the method was an own property or inherited from the prototype chain.
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  const mock = createMockFunction(original as unknown as AnyFn, String(key));
  let restored = false;

  mock.mockRestore = (): void => {
    if (restored) return;
    restored = true;
    mock.mockReset();
    if (descriptor) {
      Object.defineProperty(target, key, descriptor);
    } else {
      Reflect.deleteProperty(target, key);
    }
  };

  target[key] = mock as unknown as T[K];
  return mock;
}
