import type { OpenAPIObject } from "openapi3-ts";

import { type Context, createContext } from "../src/context";

export function createMockOpenApiObject(overrides: Partial<OpenAPIObject> = {}): OpenAPIObject {
  return {
    info: {
      title: "test",
      version: "3.0",
    },
    openapi: "3.0",
    paths: {},
    ...overrides,
  };
}

export function createMockContext(overrides: Partial<OpenAPIObject> = {}): Context {
  return createContext(createMockOpenApiObject(overrides));
}
