import ts from "typescript";
import { describe, expect, it } from "vitest";

import { generateContract } from "../src/generateContract";

const OPENAPI_DOCS = [
  "https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/examples/v3.0/petstore.yaml",
  "https://raw.githubusercontent.com/teamdigitale/api-openapi-samples/master/openapi-v3/defibrillatori-example.yaml",
];

describe("generateContract", () => {
  it.each(OPENAPI_DOCS)(
    "should successfully transpile module without ts errors",
    async (openApi) => {
      const module = await generateContract({
        openApi,
      });

      const output = ts.transpileModule(module, {
        compilerOptions: {
          module: ts.ModuleKind.NodeNext,
          noEmit: true,
          strict: true,
          target: ts.ScriptTarget.ESNext,
        },
        reportDiagnostics: true,
      });

      expect(output.diagnostics).toHaveLength(0);
    }
  );

  it.each(OPENAPI_DOCS)("should match snapshot for %s", async (openApi) => {
    const module = await generateContract({
      openApi,
    });

    expect(module).toMatchSnapshot();
  });
});
