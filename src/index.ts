import {
  TsLiteralOrExpression,
  tsAssignment,
  tsFunctionCall,
  tsNamedImport,
  tsObject,
  tsPropertyCall,
} from "./lib/ts.js";
import { AstTsWriter } from "./lib/utils.js";
import { APIOperationObject, getAPIOperationsObjects } from "./getAPIOperationsObjects.js";
import { validateAndBundleOpenAPISchema } from "./lib/redoc.js";
import { writeFileSync } from "fs";
import { prettify } from "./lib/prettier.js";

type GenerateTsRestContractFromOpenAPIOptions = {
  input: string;
};

/**
 * Generates a ts-rest contract from an OpenAPI schema.
 * @param {GenerateTsRestContractFromOpenAPIOptions} options - The options for the generation.
 */
async function generateTsRestContractFromOpenAPI({ input }: GenerateTsRestContractFromOpenAPIOptions) {
  try {
    const openApiSchema = await validateAndBundleOpenAPISchema(input);

    const ast = new AstTsWriter();

    ast
      .add(tsNamedImport({ import_: ["initContract"], from: "@ts-rest/core" }))
      .add(tsNamedImport({ import_: ["z"], from: "zod" }))
      .add(tsAssignment("const", "c", { eq: tsFunctionCall("initContract") }));

    const operationObjects = getAPIOperationsObjects(openApiSchema);
    const tsRestRounterAst = tsPropertyCall("c", ["router", tsObject(...operationObjects.map(apiOperationToAst))]);

    ast.add(tsAssignment("const", "contract", { eq: tsRestRounterAst, export_: true }));

    const fileString = await prettify(ast.toString());
    writeFileSync("src/contract.ts", fileString);
  } catch (error) {
    console.error("Error generating TypeScript REST contract:", error);
  }
}

function apiOperationToAst(operation: APIOperationObject): [string, TsLiteralOrExpression] {
  return [operation.operationId, tsObject(["method", operation.method], ["path", operation.path])];
}

generateTsRestContractFromOpenAPI({
  input:
    "https://raw.githubusercontent.com/pagopa/interop-be-monorepo/main/packages/tenant-process/open-api/tenant-service-spec.yml",
});
