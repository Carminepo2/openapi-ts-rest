import type { ParameterObject, RequestBodyObject, ResponseObject, ReferenceObject } from "openapi3-ts/oas30";
import type { Context } from "./context";
import { isEqual } from "lodash";
import camelcase from "camelcase";
import { validateOpenAPIHttpMethod, validateOpenAPIStatusCode } from "./domain/validators";

export interface APIOperationObject {
  description: string | undefined;
  summary: string | undefined;
  operationId: string;
  path: string;
  method: string;
  parameters: ParameterObject[];
  requestBody: RequestBodyObject | undefined;
  responses: Record<string, ResponseObject>;
}

export function getAPIOperationsObjects(ctx: Context): APIOperationObject[] {
  const pathsObject = ctx.openAPIDoc.paths;
  const paths = Object.entries(pathsObject);
  const operationObjects: APIOperationObject[] = [];

  for (const [path, pathItem] of paths) {
    Object.entries(pathItem).forEach(([method, pathOperation]) => {
      validateOpenAPIHttpMethod({ path, method });

      const operationId = pathOperation.operationId ?? convertPathToVariableName(path);

      const parameters = (pathItem.parameters ?? [])
        .concat(pathOperation.parameters ?? [])
        .reduce<(ParameterObject | ReferenceObject)[]>((acc, param) => {
          if (acc.some((p) => isEqual(p, param))) return acc;
          return [...acc, param];
        }, [])
        .map((param) => ctx.resolveParameterObject(param));

      const requestBody = pathOperation.requestBody
        ? ctx.resolveRequestBodyObject(pathOperation.requestBody)
        : undefined;

      const responsesEntries = Object.entries(pathOperation.responses) as [string, ResponseObject | ReferenceObject][];
      const responses = responsesEntries.reduce<APIOperationObject["responses"]>((acc, [statusCode, response]) => {
        validateOpenAPIStatusCode({ statusCode, path, method });
        return { ...acc, [statusCode]: ctx.resolveResponseObject(response) };
      }, {});

      operationObjects.push({
        description: pathOperation.description,
        summary: pathOperation.summary,
        method,
        path,
        operationId,
        parameters,
        responses,
        requestBody,
      });
    });
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
