import type { OpenAPIObject } from "openapi3-ts/oas30";
import type { Options as PrettierOptions } from "prettier";

import SwaggerParser from "@apidevtools/swagger-parser";

import { generateContext } from "./context/index.js";
import { apiOperationToAstTsRestContract } from "./converters/apiOperationToAstTsRestContract.js";
import { schemaObjectToAstZodSchema } from "./converters/schemaObjectToAstZodSchema.js";
import { getApiOperationObjects } from "./getApiOperationObjects.js";
import { prettify } from "./lib/prettier.js";
import {
  tsChainedMethodCall,
  tsFunctionCall,
  tsNamedImport,
  tsNewLine,
  tsObject,
  tsVariableDeclaration,
} from "./lib/ts.js";
import { AstTsWriter } from "./lib/utils.js";
import { processSchemasForExport } from "./processSchemasForExport.js";

interface GenerateTsRestContractFromOpenAPIOptions {
  input: string;
  prettierConfig?: PrettierOptions | null;
}

/**
 * Generates a ts-rest contract from an OpenAPI schema.
 * @param {GenerateTsRestContractFromOpenAPIOptions} options - The options for the generation.
 */
export async function generateTsRestContractFromOpenAPI({
  input,
  prettierConfig,
}: GenerateTsRestContractFromOpenAPIOptions): Promise<string> {
  const openApiSchema = (await SwaggerParser.bundle(input)) as OpenAPIObject;

  const ctx = generateContext(openApiSchema);

  const ast = new AstTsWriter();

  ast
    // import { initContract } from "@ts-rest/core";
    .add(tsNamedImport({ from: "@ts-rest/core", import_: ["initContract"] }))
    // import { z } from "zod";
    .add(tsNamedImport({ from: "zod", import_: ["z"] }))
    .add(tsNewLine())
    // const c = initContract();
    .add(tsVariableDeclaration("const", "c", { eq: tsFunctionCall("initContract") }))
    .add(tsNewLine());

  const schemasToExport = processSchemasForExport(ctx);

  // Generates the Zod schemas for each component schema.
  for (const { normalizedIdentifier, schema } of schemasToExport) {
    // const [identifier] = z.object({ ... }) | z.string() | z.number() | ...
    ast.add(
      tsVariableDeclaration("const", normalizedIdentifier, {
        eq: schemaObjectToAstZodSchema(schema, ctx),
      })
    );
  }

  ast.add(tsNewLine());

  if (schemasToExport.length > 0) {
    // export const schemas = { schema1, schema2, ... };
    ast
      .add(
        tsVariableDeclaration("const", "schemas", {
          eq: tsObject(
            ...schemasToExport.map(
              ({ normalizedIdentifier }) => [normalizedIdentifier] satisfies [string]
            )
          ),
          export_: true,
        })
      )
      .add(tsNewLine());
  }

  const apiOperationObjects = getApiOperationObjects(ctx);

  const tsRestAstContracts = apiOperationObjects.map((operationObject) =>
    apiOperationToAstTsRestContract(operationObject, ctx)
  );

  // export const contract = c.router({ ... });
  ast.add(
    tsVariableDeclaration("const", "contract", {
      eq: tsChainedMethodCall("c", ["router", tsObject(...tsRestAstContracts)]),
      export_: true,
    })
  );

  return await prettify(ast.toString(), prettierConfig);
}
