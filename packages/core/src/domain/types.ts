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
  description?: string;
  method: string;
  operationId?: string;
  parameters: ParameterObject[];
  path: string;
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  summary?: string;
}

export interface ObjectSchemaMeta {
  identifier: string;
  normalizedIdentifier: string;
  ref: string;
  schema: SchemaObject;
}
