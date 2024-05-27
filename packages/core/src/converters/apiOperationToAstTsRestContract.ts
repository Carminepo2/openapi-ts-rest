import camelcase from "camelcase";
import {
  isReferenceObject,
  type ContentObject,
  type ParameterObject,
  type RequestBodyObject,
  type ResponseObject,
} from "openapi3-ts/oas30";
import type { Expression } from "typescript";
import type { Context } from "../context";
import type { APIOperationObject } from "../getAPIOperationsObjects";
import { tsChainedMethodCall, tsIdentifier, tsObject, type TsLiteralOrExpression } from "../lib/ts";
import { schemaObjectToAstZodSchema } from "./schemaObjectToAstZodSchema";

type ContractPropertyKey =
  | "method"
  | "path"
  | "summary"
  | "headers"
  | "query"
  | "pathParams"
  | "body"
  | "contentType"
  | "responses";

export function apiOperationToAstTsRestContract(
  operation: APIOperationObject,
  ctx: Context
): [string, TsLiteralOrExpression] {
  const contractProperties: Array<[key: ContractPropertyKey, value: TsLiteralOrExpression]> = [];

  contractProperties.push(["method", operation.method.toUpperCase()]);
  contractProperties.push(["path", toContractPath(operation.path)]);

  const summary = operation.summary ?? operation.description;

  if (summary) {
    contractProperties.push(["summary", summary]);
  }

  const headerParams = operation.parameters.filter((param) => param.in === "header");
  if (headerParams.length > 0) {
    contractProperties.push(["headers", toContractParameters(headerParams, ctx)]);
  }

  const queryParams = operation.parameters.filter((param) => param.in === "query");
  if (queryParams.length > 0) {
    contractProperties.push(["query", toContractParameters(queryParams, ctx)]);
  }

  const pathParams = operation.parameters.filter((param) => param.in === "path");
  if (pathParams.length > 0) {
    contractProperties.push(["pathParams", toContractParameters(pathParams, ctx)]);
  }
  if (operation.requestBody || operation.method !== "get") {
    contractProperties.push(...toContractBodyAndContentType(operation.requestBody, ctx));
  }

  contractProperties.push([
    "responses",
    tsObject(...toContractResponses(operation.responses, ctx)),
  ]);

  return [camelcase(operation.operationId), tsObject(...contractProperties)];
}

function toContractResponses(
  responses: Record<string, ResponseObject>,
  ctx: Context
): Array<[string, TsLiteralOrExpression]> {
  const responsesResult: Array<[string, TsLiteralOrExpression]> = [];

  for (const [statusCode, response] of Object.entries(responses)) {
    const zodSchema = response.content
      ? getZodSchemaAndContentTypeFromContentObject(response.content, ctx).zodSchema
      : tsChainedMethodCall("z", ["void"]);

    responsesResult.push([statusCode, zodSchema]);
  }

  return responsesResult;
}

function toContractBodyAndContentType(
  body: RequestBodyObject | undefined,
  ctx: Context
): [["body", TsLiteralOrExpression]] | [["body", TsLiteralOrExpression], ["contentType", string]] {
  if (!body) return [["body", tsChainedMethodCall("z", ["void"])]];
  const { contentType, zodSchema } = getZodSchemaAndContentTypeFromContentObject(body.content, ctx);
  return [
    ["body", zodSchema],
    ["contentType", contentType],
  ];
}

function toContractParameters(params: ParameterObject[], ctx: Context): Expression {
  const pathParams = params.map((param): [string, TsLiteralOrExpression] => {
    if (!param.schema) throw new Error("Parameter schema is required");

    const objectSchema = ctx.resolveSchemaObject(param.schema);
    return [param.name, schemaObjectToAstZodSchema(objectSchema, ctx, { isRequired: true })];
  });

  return tsChainedMethodCall("z", ["object", tsObject(...pathParams)]);
}

function getZodSchemaAndContentTypeFromContentObject(
  content: ContentObject,
  ctx: Context
): {
  contentType: string;
  zodSchema: Expression;
} {
  const contentType = getCompatibleMediaType(Object.keys(content));

  if (!contentType) {
    throw new Error(`Unsupported media types: ${Object.keys(content).join(", ")}`);
  }

  const maybeSchemaObject = content[contentType].schema;

  if (!maybeSchemaObject) {
    throw new Error("Schema is required");
  }

  if (isReferenceObject(maybeSchemaObject)) {
    const exported = ctx.schemasToExportMap.get(maybeSchemaObject.$ref);
    if (exported) {
      return { contentType, zodSchema: tsIdentifier(exported.normalizedIdentifier) };
    }
  }

  const schemaObject = ctx.resolveSchemaObject(maybeSchemaObject);
  return {
    contentType,
    zodSchema: schemaObjectToAstZodSchema(schemaObject, ctx, { isRequired: true }),
  };
}

function toContractPath(path: string): string {
  return path.replace(/{/g, ":").replace(/}/g, "");
}

function getCompatibleMediaType(mediaTypes: string[]): string | undefined {
  const compatibleMediaTypes = [
    "application/json",
    "multipart/form-data",
    "application/x-www-form-urlencoded",
  ];
  return mediaTypes.find((c) => compatibleMediaTypes.includes(c));
}
