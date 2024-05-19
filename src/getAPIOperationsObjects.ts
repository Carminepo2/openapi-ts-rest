import camelcase from "camelcase";
import type { Method } from "./types.js";
import type {
  ParameterObject,
  OpenAPIObject,
  RequestBodyObject,
  ResponseObject,
  ReferenceObject,
} from "openapi3-ts/oas30";
import { resolveOpenAPIComponent } from "./resolveOpenAPIComponent.js";

export interface APIOperationObject {
  description: string | undefined;
  operationId: string;
  path: string;
  method: Uppercase<Method>;
  parameters: ParameterObject[];
  requestBody: RequestBodyObject | undefined;
  responses: Record<string, ResponseObject>;
}

export function getAPIOperationsObjects(doc: OpenAPIObject): APIOperationObject[] {
  const pathsObject = doc.paths;
  const paths = Object.entries(pathsObject);
  const operationObjects: APIOperationObject[] = [];

  for (const [path, pathItem] of paths) {
    const methods: Method[] = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

    for (const method of methods) {
      if (!(method in pathItem)) continue;
      const pathOperation = pathItem[method];

      const operationId = pathOperation?.operationId;

      if (!operationId) {
        console.warn(`Operation ID not found for ${method.toUpperCase()} ${path}, skipping...`);
        continue;
      }

      const parameters = (pathItem.parameters ?? [])
        .concat(pathOperation.parameters ?? [])
        .map((param) => resolveOpenAPIComponent(doc, param));

      const requestBody = pathOperation.requestBody
        ? resolveOpenAPIComponent(doc, pathOperation.requestBody)
        : undefined;

      const responsesEntries = Object.entries(pathOperation.responses) as [string, ResponseObject | ReferenceObject][];
      const responses = responsesEntries.reduce<APIOperationObject["responses"]>((acc, [key, value]) => {
        return { ...acc, [key]: resolveOpenAPIComponent(doc, value) };
      }, {});

      const operationObject: APIOperationObject = {
        description: pathOperation.description,
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
