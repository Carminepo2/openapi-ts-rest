import type {
  OperationObject,
  ParameterObject,
  PathItemObject,
  ReferenceObject,
  ResponseObject,
} from "openapi3-ts/oas30";

import isEqual from "lodash/isEqual";

import type { Context } from "./context";
import type { APIOperationObject } from "./domain/types";

import { validateOpenAPIHttpMethod, validateOpenAPIStatusCode } from "./domain/validators";

export function getApiOperationObjects(ctx: Context): APIOperationObject[] {
  const pathsObject = ctx.openAPIDoc.paths;
  const operationObjects: APIOperationObject[] = [];

  for (const [path, pathItem] of Object.entries(pathsObject)) {
    if (!pathItem) continue;

    for (const [method, pathOperation] of Object.entries(pathItem)) {
      validateOpenAPIHttpMethod({ method, path });

      if (!pathOperation) continue;

      operationObjects.push(generateAPIOperationObject(ctx, path, method, pathItem, pathOperation));
    }
  }

  return operationObjects;
}

function generateAPIOperationObject(
  ctx: Context,
  path: string,
  method: string,
  pathItem: PathItemObject,
  pathOperation: OperationObject
): APIOperationObject {
  const parameters = (pathItem.parameters ?? [])
    .concat(pathOperation.parameters ?? [])
    // Remove duplicate parameters
    .reduce<Array<ParameterObject | ReferenceObject>>((acc, param) => {
      if (acc.some((p) => isEqual(p, param))) return acc;
      return [...acc, param];
    }, [])
    .map((param) => ctx.resolveObject(param));

  const requestBody = pathOperation.requestBody
    ? ctx.resolveObject(pathOperation.requestBody)
    : undefined;

  const responsesEntries = Object.entries(pathOperation.responses) as Array<
    [string, ReferenceObject | ResponseObject]
  >;

  const responses = responsesEntries.reduce<APIOperationObject["responses"]>(
    (acc, [statusCode, response]) => {
      validateOpenAPIStatusCode({ method, path, statusCode });
      return { ...acc, [statusCode]: ctx.resolveObject(response) };
    },
    {}
  );

  return {
    description: pathOperation.description,
    method,
    operationId: pathOperation.operationId,
    parameters,
    path,
    requestBody,
    responses,
    summary: pathOperation.summary,
  };
}
