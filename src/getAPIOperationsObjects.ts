import camelcase from "camelcase";
import { Method } from "./types.js";
import { ParameterObject, OpenAPIObject, RequestBodyObject, ResponseObject } from "openapi3-ts/oas30";
import { resolveOpenAPIComponent } from "./resolveOpenAPIComponent.js";

export interface APIOperationObject {
  description: string | undefined;
  operationId: string;
  path: string;
  method: Uppercase<Method>;
  parameters: ParameterObject[];
  requestBody: RequestBodyObject | undefined;
  responses: {
    default?: ResponseObject;
    [statusCode: string]: ResponseObject | any;
  };
}

export function getAPIOperationsObjects(doc: OpenAPIObject): APIOperationObject[] {
  const pathsObject = doc.paths;
  const paths = Object.entries(pathsObject);
  const operationObjects: Array<APIOperationObject> = [];

  for (const [path, pathItem] of paths) {
    if (!pathItem) continue;

    const methods: Array<Method> = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

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
        .map((param) => resolveOpenAPIComponent(doc, "parameters", param));

      const requestBody = pathOperation.requestBody
        ? resolveOpenAPIComponent(doc, "requestBodies", pathOperation.requestBody)
        : undefined;

      const responses = Object.entries(pathOperation.responses).reduce((acc, [key, value]) => {
        return { ...acc, [key]: resolveOpenAPIComponent(doc, "responses", value) };
      }, {} as APIOperationObject["responses"]);

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
