import type { Expression } from "typescript";

import camelcase from "camelcase";
import {
  type ContentObject,
  type ParameterObject,
  type RequestBodyObject,
  type ResponseObject,
  isReferenceObject,
} from "openapi3-ts";
import { match } from "ts-pattern";

import type { Context } from "../context";
import type { APIOperationObject } from "../domain/types";

import {
  APPLICATION_JSON,
  POSSIBLE_STATUS_CODES_TS_REST_OUTPUT,
  TS_REST_RESPONSE_BODY_SUPPORTED_CONTENT_TYPES,
} from "../domain/constants";
import {
  invalidStatusCodeError,
  missingSchemaInParameterObjectError,
  unsupportedRequestBodyContentTypeError,
} from "../domain/errors";
import { type TsLiteralOrExpression, tsChainedMethodCall, tsIdentifier, tsObject } from "../lib/ts";
import { convertPathToVariableName } from "../lib/utils";
import { schemaObjectToAstZodSchema } from "./schemaObjectToAstZodSchema";

type ContractPropertyKey =
  | "body"
  | "contentType"
  | "headers"
  | "method"
  | "path"
  | "pathParams"
  | "query"
  | "responses"
  | "summary";

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

  const paramTypes = [
    ["header", "headers"],
    ["query", "query"],
    ["path", "pathParams"],
  ] as const;
  paramTypes.forEach(([openApiParamType, tsContractParamType]) => {
    const params = operation.parameters.filter((param) => param.in === openApiParamType);
    if (params.length > 0) {
      contractProperties.push([
        tsContractParamType,
        toContractParameters(params, tsContractParamType, operation, ctx),
      ]);
    }
  });

  if (operation.requestBody || operation.method !== "get") {
    contractProperties.push(...toContractBodyAndContentType(operation.requestBody, operation, ctx));
  }

  contractProperties.push([
    "responses",
    tsObject(...toContractResponses(operation.responses, operation, ctx)),
  ]);

  const contractOperationName = operation.operationId
    ? camelcase(operation.operationId)
    : convertPathToVariableName(operation.path);

  return [contractOperationName, tsObject(...contractProperties)];
}

function toContractResponses(
  responses: Record<string, ResponseObject>,
  apiOperation: APIOperationObject,
  ctx: Context
): Array<[string, TsLiteralOrExpression]> {
  const responsesResult: Array<[string, TsLiteralOrExpression | undefined]> = [];

  for (const [statusCode, response] of Object.entries(responses)) {
    const contentObject = response.content;

    function buildResponse(
      statusCode: string,
      contentType: string,
      zodSchema: Expression
    ): [string, TsLiteralOrExpression] {
      if (contentType === APPLICATION_JSON) {
        return [statusCode, zodSchema];
      }
      return [
        statusCode,
        tsChainedMethodCall("c", [
          "otherResponse",
          tsObject(["contentType", contentType], ["body", zodSchema]),
        ]),
      ];
    }

    match(statusCode.toLowerCase())
      // If the status code is a valid HTTP status code...
      .when(
        (statusCode) => /^[1-5][0-9][0-9]$/.test(statusCode),
        () => {
          const { contentType, zodSchema } = getZodSchemaAndContentTypeFromContentObject(
            contentObject,
            ctx
          );
          responsesResult.push(buildResponse(statusCode, contentType, zodSchema));
        }
      )
      // ...or a range of status codes (1XX, 2XX, 3XX etc...)
      .when(
        (statusCode) => /^[1-5]xx$/.test(statusCode),
        () => {
          // If there is already a 2XX status code, we don't need to add the other success status codes
          if (statusCode === "2xx" && responsesResult.some(([r]) => r.startsWith("2"))) return;

          const statusCodes = POSSIBLE_STATUS_CODES_TS_REST_OUTPUT.filter(
            (c) => c.startsWith(statusCode[0]) && !Object.keys(responses).includes(c)
          );
          const { contentType, zodSchema } = getZodSchemaAndContentTypeFromContentObject(
            contentObject,
            ctx
          );
          statusCodes.forEach((c) =>
            responsesResult.push(buildResponse(c, contentType, zodSchema))
          );
        }
      )
      // ...or the default status code
      .with("default", () => {
        const statusCodes = POSSIBLE_STATUS_CODES_TS_REST_OUTPUT
          // Filter out the status codes that are already handled
          .filter((c) => !responsesResult.find(([r]) => r === c))
          // Filter out all the success status codes (2XX) if there is already a 2XX status code
          .filter((c) => !(responsesResult.some(([r]) => r.startsWith("2")) && c.startsWith("2")));

        const { contentType, zodSchema } = getZodSchemaAndContentTypeFromContentObject(
          contentObject,
          ctx
        );
        statusCodes.forEach((c) => responsesResult.push(buildResponse(c, contentType, zodSchema)));
      })
      .otherwise(() => {
        throw invalidStatusCodeError({
          method: apiOperation.method,
          path: apiOperation.path,
          statusCode,
        });
      });
  }

  return responsesResult.filter(([, value]) => value !== undefined) as Array<
    [string, TsLiteralOrExpression]
  >;
}

function toContractBodyAndContentType(
  body: RequestBodyObject | undefined,
  apiOperation: APIOperationObject,
  ctx: Context
): [["body", TsLiteralOrExpression], ["contentType", string]] | [["body", TsLiteralOrExpression]] {
  if (!body) return [["body", tsChainedMethodCall("z", ["void"])]];

  const { contentType, zodSchema } = getZodSchemaAndContentTypeFromContentObject(body.content, ctx);

  const bodyContentType = contentType.includes("json") ? APPLICATION_JSON : contentType;

  if (!TS_REST_RESPONSE_BODY_SUPPORTED_CONTENT_TYPES.find((r) => r === bodyContentType)) {
    throw unsupportedRequestBodyContentTypeError({
      contentType,
      method: apiOperation.method,
      path: apiOperation.path,
    });
  }

  return [
    ["body", zodSchema],
    ["contentType", bodyContentType],
  ];
}

function toContractParameters(
  params: ParameterObject[],
  paramType: "headers" | "pathParams" | "query",
  apiOperation: APIOperationObject,
  ctx: Context
): Expression {
  const pathParams = params.map((param): [string, TsLiteralOrExpression] => {
    if (!param.schema) {
      throw missingSchemaInParameterObjectError({
        method: apiOperation.method,
        paramType,
        path: apiOperation.path,
      });
    }

    // pathParams (/get-post/:id) are always required
    const isRequired = paramType === "pathParams" || param.required === true;

    const objectSchema = ctx.resolveObject(param.schema);
    return [param.name, schemaObjectToAstZodSchema(objectSchema, ctx, { isRequired })];
  });

  return tsChainedMethodCall("z", ["object", tsObject(...pathParams)]);
}

function getZodSchemaAndContentTypeFromContentObject(
  content: ContentObject | undefined,
  ctx: Context
): {
  contentType: string;
  zodSchema: Expression;
} {
  const defaultReturn = {
    contentType: APPLICATION_JSON,
    zodSchema: tsChainedMethodCall("z", ["void"]),
  };

  if (!content) {
    return defaultReturn;
  }

  const contentType = Object.keys(content)[0];
  const maybeSchemaObject = content[contentType]?.schema;

  if (!contentType || !maybeSchemaObject) {
    return defaultReturn;
  }

  const exported =
    isReferenceObject(maybeSchemaObject) &&
    ctx.exportedComponentSchemasMap.get(maybeSchemaObject.$ref);

  const zodSchema = exported
    ? tsIdentifier(exported.normalizedIdentifier)
    : schemaObjectToAstZodSchema(ctx.resolveObject(maybeSchemaObject), ctx, { isRequired: true });

  return { contentType, zodSchema };
}

/**
 * ts-rest contracts uses a different path format than OpenAPI.
 * ts-rest specifies path parameters using a colon (:) instead of curly braces ({})
 * @param path
 * @returns the path with the correct format
 */
function toContractPath(path: string): string {
  return path.replace(/{/g, ":").replace(/}/g, "");
}
