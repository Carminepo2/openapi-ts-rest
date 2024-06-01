import type {
  HeadersObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
} from "openapi3-ts/oas30";

export type OpenAPIComponentPath =
  | "headers"
  | "parameters"
  | "requestBodies"
  | "responses"
  | "schemas";

export type OpenAPIObjectComponent =
  | HeadersObject
  | ParameterObject
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
