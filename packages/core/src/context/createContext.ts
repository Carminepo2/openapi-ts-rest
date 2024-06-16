import { type OpenAPIObject } from "openapi3-ts";

import { makeRefObjectResolvers } from "./makeRefObjectResolvers";
import { processApiOperationObjects } from "./processApiOperationObjects";
import { processComponentObjectSchemas } from "./processObjectSchemas";

export interface Context {
  apiOperationObjects: ReturnType<typeof processApiOperationObjects>;
  componentSchemasMap: ReturnType<typeof processComponentObjectSchemas>["componentSchemasMap"];
  openAPIDoc: OpenAPIObject;
  resolveObject: ReturnType<typeof makeRefObjectResolvers>["resolveObject"];
  resolveRef: ReturnType<typeof makeRefObjectResolvers>["resolveRef"];
  topologicallySortedSchemas: ReturnType<
    typeof processComponentObjectSchemas
  >["topologicallySortedSchemas"];
}

export function createContext(openAPIDoc: OpenAPIObject): Context {
  const { resolveObject, resolveRef } = makeRefObjectResolvers(openAPIDoc);
  const { componentSchemasMap, topologicallySortedSchemas } = processComponentObjectSchemas(
    openAPIDoc,
    resolveRef
  );
  const apiOperationObjects = processApiOperationObjects(openAPIDoc, resolveObject);

  return {
    apiOperationObjects,
    componentSchemasMap,
    openAPIDoc,
    resolveObject,
    resolveRef,
    topologicallySortedSchemas,
  };
}
