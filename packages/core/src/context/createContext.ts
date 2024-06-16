import { type OpenAPIObject } from "openapi3-ts";

import { makeRefObjectResolvers } from "./makeRefObjectResolvers";
import { processObjectSchemas } from "./processObjectSchemas";

export interface Context {
  componentSchemasMap: ReturnType<typeof processObjectSchemas>["componentSchemasMap"];
  openAPIDoc: OpenAPIObject;
  resolveObject: ReturnType<typeof makeRefObjectResolvers>["resolveObject"];
  resolveRef: ReturnType<typeof makeRefObjectResolvers>["resolveRef"];
}

export function createContext(openAPIDoc: OpenAPIObject): Context {
  const { resolveObject, resolveRef } = makeRefObjectResolvers(openAPIDoc);
  const { componentSchemasMap } = processObjectSchemas(openAPIDoc, resolveRef);

  return {
    componentSchemasMap,
    openAPIDoc,
    resolveObject,
    resolveRef,
  };
}
