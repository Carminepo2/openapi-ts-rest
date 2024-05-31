import { type OpenAPIObject } from "openapi3-ts/oas30";

import { makeRefObjectResolvers } from "./makeRefObjectResolvers";
import { processObjectSchemas } from "./processObjectSchemas";
import { processOperationsObjects } from "./processOperationsObjects";

export interface Context {
  openAPIDoc: OpenAPIObject;
  operationObjects: ReturnType<typeof processOperationsObjects>;
  resolveObject: ReturnType<typeof makeRefObjectResolvers>["resolveObject"];
  resolveRef: ReturnType<typeof makeRefObjectResolvers>["resolveRef"];
  schemasToExportMap: ReturnType<typeof processObjectSchemas>["schemasToExportMap"];
  topologicallySortedSchemas: ReturnType<typeof processObjectSchemas>["topologicallySortedSchemas"];
}

export function generateContext(openAPIDoc: OpenAPIObject): Context {
  const { resolveObject, resolveRef } = makeRefObjectResolvers(openAPIDoc);
  const operationObjects = processOperationsObjects(openAPIDoc, resolveObject);
  const { schemasToExportMap, topologicallySortedSchemas } = processObjectSchemas(
    openAPIDoc,
    resolveRef
  );

  return {
    openAPIDoc,
    operationObjects,
    resolveObject,
    resolveRef,
    schemasToExportMap,
    topologicallySortedSchemas,
  };
}
