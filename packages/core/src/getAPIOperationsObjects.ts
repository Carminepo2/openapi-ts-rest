import type {
  ParameterObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
} from "openapi3-ts/oas30";

import camelcase from "camelcase";
import isEqual from "lodash/isEqual";

import type { Context } from "./context";

import { validateOpenAPIHttpMethod, validateOpenAPIStatusCode } from "./domain/validators";

export interface APIOperationObject {
  description: string | undefined;
  method: string;
  operationId: string;
  parameters: ParameterObject[];
  path: string;
  requestBody: RequestBodyObject | undefined;
  responses: Record<string, ResponseObject>;
  summary: string | undefined;
}

export function getAPIOperationsObjects(ctx: Context): APIOperationObject[] {
  const pathsObject = ctx.openAPIDoc.paths;
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
        .map((param) => ctx.resolveParameterObject(param));

      const requestBody = pathOperation.requestBody
        ? ctx.resolveRequestBodyObject(pathOperation.requestBody)
        : undefined;

      const responsesEntries = Object.entries(pathOperation.responses) as Array<
        [string, ReferenceObject | ResponseObject]
      >;

      const responses = responsesEntries.reduce<APIOperationObject["responses"]>(
        (acc, [statusCode, response]) => {
          validateOpenAPIStatusCode({ method, path, statusCode });
          return { ...acc, [statusCode]: ctx.resolveResponseObject(response) };
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

/**
 * Converts a path to a variable name.
 * It replaces all slashes, dots, and curly braces with dashes and camelcases the result.
 *
 * @param path - The path to convert.
 * @returns The variable name.
 *
 * @example
 * ```typescript
 * pathToVariableName("/path/to/{id}") // "pathToId"
 * pathToVariableName("/path/to/resource") // "pathToResource"
 * pathToVariableName("/robots.txt") // "robotsTxt"
 * ```
 */
const convertPathToVariableName = (path: string): string =>
  camelcase(path.replaceAll(/(\/|\.|{)/g, "-").replaceAll("}", ""));
