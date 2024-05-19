import type { APIOperationObject } from "./getAPIOperationsObjects";
import { tsObject, type TsLiteralOrExpression } from "./lib/ts";

export function apiOperationToAstTsRestContract(operation: APIOperationObject): [string, TsLiteralOrExpression] {
  const contractProperties: [key: string, value: TsLiteralOrExpression][] = [];

  contractProperties.push(["method", operation.method]);
  contractProperties.push(["path", operation.path]);

  if (operation.description) {
    contractProperties.push(["summary", operation.description]);
  }

  return [operation.operationId, tsObject(...contractProperties)];
}

// const c = initContract();

// const PostSchema = z.object({
//   id: z.string(),
//   title: z.string(),
//   body: z.string(),
// });

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
