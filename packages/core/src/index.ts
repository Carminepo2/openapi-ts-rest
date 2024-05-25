import { apiOperationToAstTsRestContract } from "./converters/apiOperationToAstTsRestContract.js";
import { generateContext } from "./context.js";
import { getAPIOperationsObjects } from "./getAPIOperationsObjects.js";
import { prettify } from "./lib/prettier.js";
import {
  tsVariableDeclaration,
  tsFunctionCall,
  tsNamedImport,
  tsNewLine,
  tsObject,
  tsChainedMethodCall,
} from "./lib/ts.js";
import { AstTsWriter } from "./lib/utils.js";
import { schemaObjectToAstZodSchema } from "./converters/schemaObjectToAstZodSchema.js";
import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPIObject } from "openapi3-ts/oas30";

interface GenerateTsRestContractFromOpenAPIOptions {
  input: string;
}

/**
 * Generates a ts-rest contract from an OpenAPI schema.
 * @param {GenerateTsRestContractFromOpenAPIOptions} options - The options for the generation.
 */
export async function generateTsRestContractFromOpenAPI({
  input,
}: GenerateTsRestContractFromOpenAPIOptions): Promise<string> {
  const openApiSchema = (await SwaggerParser.bundle(input)) as OpenAPIObject;

  const ctx = generateContext(openApiSchema);

  const ast = new AstTsWriter();

  ast
    // import { initContract } from "@ts-rest/core";
    .add(tsNamedImport({ import_: ["initContract"], from: "@ts-rest/core" }))
    // import { z } from "zod";
    .add(tsNamedImport({ import_: ["z"], from: "zod" }))
    .add(tsNewLine())
    // const c = initContract();
    .add(tsVariableDeclaration("const", "c", { eq: tsFunctionCall("initContract") }))
    .add(tsNewLine());

  // Generates the Zod schemas for each component schema.
  for (const { normalizedIdentifier, schema } of ctx.topologicallySortedSchemas) {
    // const [identifier] = z.object({ ... }) | z.string() | z.number() | ...
    ast.add(tsVariableDeclaration("const", normalizedIdentifier, { eq: schemaObjectToAstZodSchema(schema, ctx) }));
  }

  ast.add(tsNewLine());

  const schemaIdentifiersToExport = ctx.topologicallySortedSchemas
    .filter(({ ref }) => ctx.schemasToExportMap.has(ref))
    .map(({ normalizedIdentifier }) => [normalizedIdentifier] satisfies [string]);

  if (schemaIdentifiersToExport.length > 0) {
    // export const schemas = { schema1, schema2, ... };
    ast
      .add(tsVariableDeclaration("const", "schemas", { eq: tsObject(...schemaIdentifiersToExport), export_: true }))
      .add(tsNewLine());
  }

  // Gets the API operations objects from the OpenAPI schema, which are used to generate each contract.
  const operationObjects = getAPIOperationsObjects(ctx);

  const tsRestAstContracts = operationObjects.map((operationObject) => {
    return apiOperationToAstTsRestContract(operationObject, ctx);
  });

  // export const contract = c.router({ ... });
  ast.add(
    tsVariableDeclaration("const", "contract", {
      eq: tsChainedMethodCall("c", ["router", tsObject(...tsRestAstContracts)]),
      export_: true,
    })
  );

  return await prettify(ast.toString());
}
