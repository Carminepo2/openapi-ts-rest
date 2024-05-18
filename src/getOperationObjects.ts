import camelcase from "camelcase";
import { Method } from "./types.js";
import {} from "openapi-types";
import { OperationObject, ReferenceObject, ParameterObject, PathsObject } from "openapi3-ts/oas30";

export interface ExtendedOperationObject extends OperationObject {
  path: string;
  method: Uppercase<Method>;
  parameters: (ReferenceObject | ParameterObject)[];
}

export function getOperationObjects(pathsObject: PathsObject): ExtendedOperationObject[] {
  const paths = Object.entries(pathsObject);
  const operationObjects: Array<ExtendedOperationObject> = [];

  for (const [path, pathItem] of paths) {
    if (!pathItem) continue;

    if ("$ref" in pathItem) {
      console.log("TODO: Resolve $ref in pathItem");
      continue;
    }

    const methods: Array<Method> = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
    for (const method of methods) {
      if (!(method in pathItem)) continue;
      const pathOperation = pathItem[method];

      const operationId = pathOperation?.operationId;

      if (!operationId) {
        console.log(`Operation ID not found for ${method.toUpperCase()} ${path}, skipping...`);
        continue;
      }

      const pathItemParams = pathItem.parameters ?? [];
      const pathOperationParams = pathOperation.parameters ?? [];

      const operationObject = {
        description: pathOperation.description,
        method: method.toUpperCase() as Uppercase<Method>,
        path,
        operationId: camelcase(operationId),
        parameters: pathItemParams.concat(pathOperationParams),
        responses: pathOperation.responses,
        requestBody: pathOperation.requestBody,
      } as ExtendedOperationObject;

      operationObjects.push(operationObject);
    }
  }

  return operationObjects;
}
