import type {
  OpenAPIObject,
  ParameterObject,
  ReferenceObject,
  ResponseObject,
} from "openapi3-ts/oas30";

import isEqual from "lodash/isEqual";

import type { APIOperationObject, OpenAPIObjectComponent } from "../domain/types";

import { validateOpenAPIHttpMethod, validateOpenAPIStatusCode } from "../domain/validators";
import { convertPathToVariableName } from "../lib/utils";

export function processOperationsObjects(
  openAPIDoc: OpenAPIObject,
  resolveObject: <T extends OpenAPIObjectComponent>(refOrObject: ReferenceObject | T) => T
): APIOperationObject[] {
  const pathsObject = openAPIDoc.paths;
  const operationObjects: APIOperationObject[] = [];

  for (const [path, pathItem] of Object.entries(pathsObject)) {
    if (!pathItem) continue; // Maybe we should throw an error here?

    for (const [method, pathOperation] of Object.entries(pathItem)) {
      validateOpenAPIHttpMethod({ method, path });

      if (!pathOperation) continue; // Maybe we should throw an error here?

      const operationId = pathOperation.operationId ?? convertPathToVariableName(path);

      const parameters = (pathItem.parameters ?? [])
        .concat(pathOperation.parameters ?? [])
        .reduce<Array<ParameterObject | ReferenceObject>>((acc, param) => {
          if (acc.some((p) => isEqual(p, param))) return acc;
          return [...acc, param];
        }, [])
        .map((param) => resolveObject(param));

      const requestBody = pathOperation.requestBody
        ? resolveObject(pathOperation.requestBody)
        : undefined;

      const responsesEntries = Object.entries(pathOperation.responses) as Array<
        [string, ReferenceObject | ResponseObject]
      >;

      const responses = responsesEntries.reduce<APIOperationObject["responses"]>(
        (acc, [statusCode, response]) => {
          validateOpenAPIStatusCode({ method, path, statusCode });
          return { ...acc, [statusCode]: resolveObject(response) };
        },
        {}
      );

      operationObjects.push({
        description: pathOperation.description,
        method,
        operationId,
        parameters,
        path,
        requestBody,
        responses,
        summary: pathOperation.summary,
      });
    }
  }

  return operationObjects;
}
