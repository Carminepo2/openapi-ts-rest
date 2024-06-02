import type {
  HeadersObject,
  ParameterObject,
  PathItemObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
} from "openapi3-ts";

export type OpenAPIComponentPath =
  | "headers"
  | "parameters"
  | "pathItems"
  | "requestBodies"
  | "responses"
  | "schemas";

export type OpenAPIObjectComponent =
  | HeadersObject
  | ParameterObject
  | PathItemObject
  | RequestBodyObject
  | ResponseObject
  | SchemaObject;

export interface APIOperationObject {
  description: string | undefined;
  method: string;
  operationId: string | undefined;
  parameters: ParameterObject[];
  path: string;
  requestBody: RequestBodyObject | undefined;
  responses: Record<string, ResponseObject>;
  summary: string | undefined;
}

export interface ObjectSchemaMeta {
  identifier: string;
  normalizedIdentifier: string;
  ref: string;
  schema: SchemaObject;
}
