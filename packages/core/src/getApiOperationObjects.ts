import type { ParameterObject, ReferenceObject, ResponseObject } from "openapi3-ts/oas31";

import isEqual from "lodash/isEqual";

import type { Context } from "./context";
import type { APIOperationObject } from "./domain/types";

import { validateOpenAPIHttpMethod, validateOpenAPIStatusCode } from "./domain/validators";

export function getApiOperationObjects(ctx: Context): APIOperationObject[] {
  const pathsObject = ctx.openAPIDoc.paths;
  const operationObjects: APIOperationObject[] = [];

  if (!pathsObject) return [];

  for (const [path, pathItemOrRef] of Object.entries(pathsObject)) {
    if (!pathItemOrRef) continue;
    const pathItem = ctx.resolveObject(pathItemOrRef);

    const pathOperations = Object.entries(pathItem).filter(
      ([property]) => !["description", "parameters", "servers", "summary"].includes(property)
    );

    for (const [method, pathOperation] of pathOperations) {
      validateOpenAPIHttpMethod({ method, path });

      if (!pathOperation || !pathOperation?.responses) continue;

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
          const resolvedResponse = ctx.resolveObject(response);
          validateOpenAPIStatusCode({ method, path, statusCode });

          return { ...acc, [statusCode]: resolvedResponse };
        },
        {}
      );

      const operationObject: APIOperationObject = {
        description: pathOperation.description,
        method,
        operationId: pathOperation.operationId,
        parameters,
        path,
        requestBody,
        responses,
        summary: pathOperation.summary,
      };

      operationObjects.push(operationObject);
    }
  }

  return operationObjects;
}
