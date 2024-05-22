import camelcase from "camelcase";
import type { ParameterObject, RequestBodyObject, ResponseObject, ReferenceObject } from "openapi3-ts/oas30";
import type { Context } from "./context";

const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;
type Method = (typeof METHODS)[number];

export interface APIOperationObject {
  description: string | undefined;
  operationId: string;
  path: string;
  method: Uppercase<Method>;
  parameters: ParameterObject[];
  requestBody: RequestBodyObject | undefined;
  responses: Record<string, ResponseObject>;
}

export function getAPIOperationsObjects(ctx: Context): APIOperationObject[] {
  const pathsObject = ctx.openAPIDoc.paths;
  const paths = Object.entries(pathsObject);
  const operationObjects: APIOperationObject[] = [];

  for (const [path, pathItem] of paths) {
    for (const method of METHODS) {
      if (!(method in pathItem)) continue;
      const pathOperation = pathItem[method];

      const operationId = pathOperation?.operationId;

      if (!operationId) {
        console.warn(`Operation ID not found for ${method.toUpperCase()} ${path}, skipping...`);
        continue;
      }

      const parameters = (pathItem.parameters ?? [])
        .concat(pathOperation.parameters ?? [])
        .map((param) => ctx.resolveParameterObject(param));

      const requestBody = pathOperation.requestBody
        ? ctx.resolveRequestBodyObject(pathOperation.requestBody)
        : undefined;

      const responsesEntries = Object.entries(pathOperation.responses) as [string, ResponseObject | ReferenceObject][];
      const responses = responsesEntries.reduce<APIOperationObject["responses"]>((acc, [key, value]) => {
        return { ...acc, [key]: ctx.resolveResponseObject(value) };
      }, {});

      const operationObject: APIOperationObject = {
        description: pathOperation.summary ?? pathOperation.description,
        method: method.toUpperCase() as Uppercase<Method>,
        path,
        operationId: camelcase(operationId),
        parameters,
        responses,
        requestBody,
      };

      operationObjects.push(operationObject);
    }
  }

  return operationObjects;
}
