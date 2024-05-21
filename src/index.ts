import { apiOperationToAstTsRestContract } from "./apiOperationToAstTsRestContract.js";
import { generateContext } from "./context.js";
import { getAPIOperationsObjects } from "./getAPIOperationsObjects.js";
import { prettify } from "./lib/prettier.js";
import { validateAndBundleOpenAPISchema } from "./lib/redocly.js";
import { tsVariableDeclaration, tsFunctionCall, tsNamedImport, tsNewLine, tsObject, tsPropertyCall } from "./lib/ts.js";
import { AstTsWriter } from "./lib/utils.js";
import { schemaObjectToAstZodSchema } from "./schemaObjectToAstZodSchema.js";

interface GenerateTsRestContractFromOpenAPIOptions {
  input: string;
}

/**
 * Generates a ts-rest contract from an OpenAPI schema.
 * @param {GenerateTsRestContractFromOpenAPIOptions} options - The options for the generation.
 */
export async function generateTsRestContractFromOpenAPI({ input }: GenerateTsRestContractFromOpenAPIOptions) {
  try {
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
    const componentSchemas = Object.entries(openApiSchema.components?.schemas ?? []);
    for (const [identifier, schemaObjectOrRef] of componentSchemas) {
      const schemaObject = ctx.resolveOpenAPIComponent(schemaObjectOrRef);
      const schemaObjectZodAst = schemaObjectToAstZodSchema(schemaObject, ctx);

      // const [identifier] = z.object({ ... }) | z.string() | z.number() | ...
      ast.add(tsVariableDeclaration("const", identifier, { eq: schemaObjectZodAst }));
    }

    ast.add(tsNewLine());

    // export const contract = c.router({ ... });
    ast.add(
      tsVariableDeclaration("const", "contract", {
        eq: tsPropertyCall("c", ["router", tsObject(...operationObjects.map(apiOperationToAstTsRestContract))]),
        export_: true,
      })
    );

    return await prettify(ast.toString());
  } catch (error) {
    console.error("Error generating TypeScript REST contract:", error);
  }
}

void generateTsRestContractFromOpenAPI({
  input:
    "https://raw.githubusercontent.com/pagopa/interop-be-monorepo/main/packages/tenant-process/open-api/tenant-service-spec.yml",
}).then(console.log);
