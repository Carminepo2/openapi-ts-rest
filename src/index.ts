import { tsAssignment, tsFunctionCall, tsNamedImport, tsObject, tsPropertyCall } from "./lib/ts.js";
import { AstTsWriter } from "./lib/utils.js";
import { getOperationObjects } from "./getOperationObjects.js";
import { validateAndBundleOpenAPISchema } from "./lib/redoc.js";

type GenerateTsRestContractFromOpenAPIOptions = {
  input: string;
};

async function generateTsRestContractFromOpenAPI({ input }: GenerateTsRestContractFromOpenAPIOptions) {
  const openApiSchema = await validateAndBundleOpenAPISchema(input);

  const astWriter = new AstTsWriter();

  astWriter
    .add(tsNamedImport({ import_: ["initContract"], from: "@ts-rest/core" }))
    .add(tsNamedImport({ import_: ["z"], from: "zod" }))
    .add(tsAssignment("const", "c", { eq: tsFunctionCall("initContract") }));

  const operationObjects = getOperationObjects(openApiSchema.paths);

  astWriter.add(tsAssignment("const", "contract", { eq: tsPropertyCall("c", ["router", tsObject()]), exported: true }));

  console.log(astWriter.toString());
}

generateTsRestContractFromOpenAPI({
  input:
    "https://raw.githubusercontent.com/pagopa/interop-be-monorepo/main/packages/tenant-process/open-api/tenant-service-spec.yml",
});
