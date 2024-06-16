import type {
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  ReferenceObject,
  ResponseObject,
} from "openapi3-ts";

import isEqual from "lodash/isEqual.js";

import type { APIOperationObject, OpenAPIObjectComponent } from "../domain/types";

import { validateOpenAPIHttpMethod, validateOpenAPIStatusCode } from "../domain/validators";

/**
 * Parses and extracts the API operation objects from the OpenAPI document, resolving all the references.
 *
 * It validates the HTTP methods and status codes and deduplicates the parameters from the path and operation.
 *
 * @param ctx - The context object.
 * @returns The API operation objects.
 */
export function processApiOperationObjects(
  openAPIDoc: OpenAPIObject,
  resolveObject: <TObjectComponent extends OpenAPIObjectComponent>(
    pathItemRefOrObj: ReferenceObject | TObjectComponent
  ) => TObjectComponent
): APIOperationObject[] {
  const pathsObject = openAPIDoc.paths;
  const operationObjects: APIOperationObject[] = [];

  if (!pathsObject) return [];

  // ["/path", { get: { ... }, post: { ... } }]
  for (const [path, pathItemOrRef] of Object.entries(pathsObject)) {
    if (!pathItemOrRef) continue;

    const pathItem = resolveObject<PathItemObject>(pathItemOrRef);

    // Filter out the non-operation properties
    const pathOperations = Object.entries(pathItem).filter(
      ([property]) => !["description", "parameters", "servers", "summary"].includes(property)
    );

    // ["get", { ... }]
    for (const [method, pathOperation] of pathOperations as Array<[string, OperationObject]>) {
      validateOpenAPIHttpMethod({ method, path });

      if (!pathOperation || !pathOperation?.responses) continue;

      // Merge parameters from path and operation
      const parameters = (pathItem.parameters ?? [])
        .concat(pathOperation.parameters ?? [])
        // Remove duplicate parameters
        .reduce<Array<ParameterObject | ReferenceObject>>((acc, param) => {
          if (acc.some((p) => isEqual(p, param))) return acc;
          return [...acc, param];
        }, [])
        .map(resolveObject);

      const requestBody = pathOperation.requestBody
        ? resolveObject(pathOperation.requestBody)
        : undefined;

      const responsesEntries = Object.entries(pathOperation.responses) as Array<
        [string, ReferenceObject | ResponseObject]
      >;

      const responses = responsesEntries.reduce<APIOperationObject["responses"]>(
        (acc, [statusCode, response]) => {
          const resolvedResponse = resolveObject(response);
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
