import camelcase from "camelcase";
import type { Context } from "../context";
import type { APIOperationObject } from "../getAPIOperationsObjects";
import { tsObject, type TsLiteralOrExpression } from "../lib/ts";

export function apiOperationToAstTsRestContract(
  operation: APIOperationObject,
  _ctx: Context
): [string, TsLiteralOrExpression] {
  const contractProperties: [key: string, value: TsLiteralOrExpression][] = [];

  contractProperties.push(["method", operation.method.toUpperCase()]);
  contractProperties.push(["path", toContractPath(operation.path)]);

  const summary = operation.summary ?? operation.description;
  if (summary) {
    contractProperties.push(["summary", summary]);
  }

  const headerParams = operation.parameters.filter((param) => param.in === "header");
  const pathParams = operation.parameters.filter((param) => param.in === "path");
  const cookieParams = operation.parameters.filter((param) => param.in === "cookie");
  const queryParams = operation.parameters.filter((param) => param.in === "query");

  console.log({ pathParams, headerParams, cookieParams, queryParams });

  return [camelcase(operation.operationId), tsObject(...contractProperties)];
}

function toContractPath(path: string): string {
  return path.replace(/{/g, ":").replace(/}/g, "");
}

// export const contract = c.router({
//   createPost: {
//     method: "POST",
//     path: "/posts",
//     responses: {
//       201: PostSchema,
//     },
//     body: z.object({
//       title: z.string(),
//       body: z.string(),
//     }),
//   },
//   getPost: {
//     method: "GET",
//     path: `/posts/:id`,
//     responses: {
//       200: PostSchema.nullable(),
//     },
//     summary: "Get a post by id",
//   },
// });
