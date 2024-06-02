import type { OpenAPIObject } from "openapi3-ts";

import { type Context, createContext } from "../src/context";

export function createMockContext(overrides: Partial<OpenAPIObject> = {}): Context {
  return createContext({
    info: {
      title: "test",
      version: "3.0",
    },
    openapi: "3.0",
    ...overrides,
  });
}
