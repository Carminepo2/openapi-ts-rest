import camelcase from "camelcase";
import type { Context } from "../context";
import type { APIOperationObject } from "../getAPIOperationsObjects";
import { tsChainedMethodCall, tsIdentifier, tsObject, type TsLiteralOrExpression } from "../lib/ts";
import { isReferenceObject, type ParameterObject, type RequestBodyObject } from "openapi3-ts/oas30";
import type { Expression } from "typescript";
import { schemaObjectToAstZodSchema } from "./schemaObjectToAstZodSchema";

type ContractPropertyKey = "method" | "path" | "summary" | "headers" | "query" | "pathParams" | "body" | "contentType";

export function apiOperationToAstTsRestContract(
  operation: APIOperationObject,
  ctx: Context
): [string, TsLiteralOrExpression] {
  const contractProperties: [key: ContractPropertyKey, value: TsLiteralOrExpression][] = [];

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

  if (operation.requestBody) {
    contractProperties.push(...toContractBodyAndContentType(operation.requestBody, ctx));
  }

  return [camelcase(operation.operationId), tsObject(...contractProperties)];
}

function toContractBodyAndContentType(
  body: RequestBodyObject,
  ctx: Context
): [["body", TsLiteralOrExpression]] | [["body", TsLiteralOrExpression], ["contentType", string]] {
  body.content;

  const contentType = getCompatibleMediaType(Object.keys(body.content));

  if (!contentType) {
    throw new Error(`Unsupported media types: ${Object.keys(body.content).join(", ")}`);
  }

  const schema = body.content[contentType].schema;

  if (!schema) {
    throw new Error("Schema is required");
  }

  if (isReferenceObject(schema)) {
    const exported = ctx.schemasToExportMap.get(schema.$ref);
    if (exported) {
      return [
        ["body", tsIdentifier(exported.normalizedIdentifier)],
        ["contentType", contentType],
      ];
    }
  }

  const schemaObject = ctx.resolveSchemaObject(schema);
  const zodSchema = schemaObjectToAstZodSchema(schemaObject, ctx, { isRequired: true });

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

function toContractPath(path: string): string {
  return path.replace(/{/g, ":").replace(/}/g, "");
}

function getCompatibleMediaType(mediaTypes: string[]): string | undefined {
  const compatibleMediaTypes = ["application/json", "multipart/form-data", "application/x-www-form-urlencoded"];
  return mediaTypes.find((c) => compatibleMediaTypes.includes(c));
}
