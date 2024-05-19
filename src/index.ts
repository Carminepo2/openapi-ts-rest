import {
  type TsLiteralOrExpression,
  tsAssignment,
  tsFunctionCall,
  tsNamedImport,
  tsObject,
  tsPropertyCall,
} from "./lib/ts.js";
import { AstTsWriter } from "./lib/utils.js";
import { type APIOperationObject, getAPIOperationsObjects } from "./getAPIOperationsObjects.js";
import { validateAndBundleOpenAPISchema } from "./lib/redocly.js";
import { writeFileSync } from "fs";
import { prettify } from "./lib/prettier.js";

interface GenerateTsRestContractFromOpenAPIOptions {
  input: string;
}

/**
 * Generates a ts-rest contract from an OpenAPI schema.
 * @param {GenerateTsRestContractFromOpenAPIOptions} options - The options for the generation.
 */
async function generateTsRestContractFromOpenAPI({ input }: GenerateTsRestContractFromOpenAPIOptions) {
  try {
    const openApiSchema = await validateAndBundleOpenAPISchema(input);

    const ast = new AstTsWriter();

    ast
      // import { initContract } from "@ts-rest/core";
      .add(tsNamedImport({ import_: ["initContract"], from: "@ts-rest/core" }))
      // import { z } from "zod";
      .add(tsNamedImport({ import_: ["z"], from: "zod" }))
      // const c = initContract();
      .add(tsAssignment("const", "c", { eq: tsFunctionCall("initContract") }));

    const operationObjects = getAPIOperationsObjects(openApiSchema);

    // export const contract = c.router({ ... });
    const tsRestRounterAst = tsPropertyCall("c", [
      "router",
      tsObject(...operationObjects.map(apiOperationToAstTsRestContract)),
    ]);
    ast.add(tsAssignment("const", "contract", { eq: tsRestRounterAst, export_: true }));

    const fileString = await prettify(ast.toString());
    writeFileSync("src/contract.ts", fileString);
  } catch (error) {
    console.error("Error generating TypeScript REST contract:", error);
  }
}

function apiOperationToAstTsRestContract(operation: APIOperationObject): [string, TsLiteralOrExpression] {
  return [operation.operationId, tsObject(["method", operation.method], ["path", operation.path])];
}

void generateTsRestContractFromOpenAPI({
  input:
    "https://raw.githubusercontent.com/pagopa/interop-be-monorepo/main/packages/tenant-process/open-api/tenant-service-spec.yml",
});
