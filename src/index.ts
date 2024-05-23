import { writeFileSync } from "node:fs";
import { apiOperationToAstTsRestContract } from "./converters/apiOperationToAstTsRestContract.js";
import { generateContext } from "./context.js";
import { getAPIOperationsObjects } from "./getAPIOperationsObjects.js";
import { prettify } from "./lib/prettier.js";
import { validateAndBundleOpenAPISchema } from "./lib/redocly.js";
import {
  tsVariableDeclaration,
  tsFunctionCall,
  tsNamedImport,
  tsNewLine,
  tsObject,
  tsChainedMethodCall,
  tsNamedExport,
} from "./lib/ts.js";
import { AstTsWriter } from "./lib/utils.js";
import { schemaObjectToAstZodSchema } from "./converters/schemaObjectToAstZodSchema.js";

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
  const openApiSchema = await validateAndBundleOpenAPISchema(input);

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

  // Gets the API operations objects from the OpenAPI schema, which are used to generate each contract.
  const operationObjects = getAPIOperationsObjects(ctx);

  // Generates the Zod schemas for each component schema.
  for (const { normalizedIdentifier, schema } of ctx.topologicallySortedSchemas) {
    // const [identifier] = z.object({ ... }) | z.string() | z.number() | ...
    ast.add(tsVariableDeclaration("const", normalizedIdentifier, { eq: schemaObjectToAstZodSchema(schema, ctx) }));
  }

  ast.add(tsNewLine());

  const schemaIdentifiersToExport = ctx.topologicallySortedSchemas
    .filter(({ ref }) => ctx.schemasToExportMap.has(ref))
    .map(({ normalizedIdentifier }) => normalizedIdentifier);

  // export { schema1, schema2, ... };
  ast.add(tsNamedExport({ export_: schemaIdentifiersToExport }));

  ast.add(tsNewLine());

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

void generateTsRestContractFromOpenAPI({
  input:
    "https://raw.githubusercontent.com/pagopa/interop-be-monorepo/main/packages/tenant-process/open-api/tenant-service-spec.yml",
}).then((s) => {
  writeFileSync("contract.ts", s);
});
