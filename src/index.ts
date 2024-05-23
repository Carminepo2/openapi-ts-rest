import { writeFileSync } from "node:fs";
import { apiOperationToAstTsRestContract } from "./converters/apiOperationToAstTsRestContract.js";
import { generateContext } from "./context.js";
import { getAPIOperationsObjects } from "./getAPIOperationsObjects.js";
import { prettify } from "./lib/prettier.js";
import { validateAndBundleOpenAPISchema } from "./lib/redoc.js";
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

  // Generates the Zod schemas for each component schema.
  for (const { normalizedIdentifier, schema } of ctx.topologicallySortedSchemas) {
    // const [identifier] = z.object({ ... }) | z.string() | z.number() | ...
    ast.add(tsVariableDeclaration("const", normalizedIdentifier, { eq: schemaObjectToAstZodSchema(schema, ctx) }));
  }

  ast.add(tsNewLine());

  const schemaIdentifiersToExport = ctx.topologicallySortedSchemas
    .filter(({ ref }) => ctx.schemasToExportMap.has(ref))
    .map(({ normalizedIdentifier }) => [normalizedIdentifier] satisfies [string]);

  // export const schemas = { schema1, schema2, ... };
  ast.add(tsVariableDeclaration("const", "schemas", { eq: tsObject(...schemaIdentifiersToExport), export_: true }));

  ast.add(tsNewLine());

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

const tenant =
  "https://raw.githubusercontent.com/pagopa/interop-be-monorepo/main/packages/tenant-process/open-api/tenant-service-spec.yml";
const catalog =
  "https://raw.githubusercontent.com/pagopa/interop-be-monorepo/main/packages/catalog-process/open-api/catalog-service-spec.yml";
const purpose =
  "https://raw.githubusercontent.com/pagopa/interop-be-monorepo/main/packages/purpose-process/open-api/purpose-service-spec.yml";
const attributeRegistry =
  "https://raw.githubusercontent.com/pagopa/interop-be-monorepo/main/packages/attribute-registry-process/open-api/attribute-registry-service-spec.yml";
const agreement =
  "https://raw.githubusercontent.com/pagopa/interop-be-monorepo/main/packages/agreement-process/open-api/agreement-service-spec.yml";

for (const [name, url] of [
  ["tenant", tenant],
  ["catalog", catalog],
  ["purpose", purpose],
  ["attributeRegistry", attributeRegistry],
  ["agreement", agreement],
]) {
  void generateTsRestContractFromOpenAPI({
    input: url,
  }).then((s) => {
    writeFileSync(`${name}.ts`, s);
  });
}
