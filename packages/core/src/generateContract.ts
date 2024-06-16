import type { OpenAPIObject } from "openapi3-ts";
import type { Options as PrettierOptions } from "prettier";

import SwaggerParser from "@apidevtools/swagger-parser";

import { createContext } from "./context/createContext.js";
import { apiOperationToAstTsRestContract } from "./converters/apiOperationToAstTsRestContract.js";
import { schemaObjectToAstZodSchema } from "./converters/schemaObjectToAstZodSchema.js";
import { getApiOperationObjects } from "./getApiOperationObjects.js";
import { getExportedSchemas } from "./getTopologicallySortedSchemas.js";
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

export interface GenerateContractOptions {
  /**
   * The OpenAPI schema to generate the ts-rest contract from.
   * It can be either an OpenAPI schema object or a URL to an OpenAPI schema.
   */
  openApi: OpenAPIObject | string;
  /**
   * The Prettier configuration to use for formatting the generated code.
   */
  prettierConfig?: PrettierOptions | null;
}

/**
 * Generates a ts-rest contract from an OpenAPI schema.
 * @param {generateContractOptions} options - The options for the generation.
 */
export async function generateContract({
  openApi,
  prettierConfig,
}: GenerateContractOptions): Promise<string> {
  const openApiSchema = (await SwaggerParser.bundle(openApi as never)) as OpenAPIObject;

  const ctx = createContext(openApiSchema);

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

  const schemasToExport = getExportedSchemas(ctx);

  if (schemasToExport.length > 0) {
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
