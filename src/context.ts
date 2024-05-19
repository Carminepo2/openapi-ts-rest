import type { OpenAPIObject } from "openapi3-ts/oas30";
import { makeOpenAPIComponentResolver } from "./makeOpenAPIComponentResolver";

export interface Context {
  openAPIDoc: OpenAPIObject;
  resolveOpenAPIComponent: ReturnType<typeof makeOpenAPIComponentResolver>;
}

export function generateContext(openAPIDoc: OpenAPIObject): Context {
  return {
    openAPIDoc,
    resolveOpenAPIComponent: makeOpenAPIComponentResolver(openAPIDoc),
  };
}
