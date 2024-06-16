import * as fs from "fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { generateContract } from "../src/generateContract";

const OPENAPI_DOCS = fs.readdirSync("./tests/examples");

const getPath = (name: string): string => `./tests/examples/${name}`;

describe("generateContract", () => {
  it.each(OPENAPI_DOCS)(
    "should successfully transpile module without ts errors",
    async (openApi) => {
      const module = await generateContract({
        openApi: getPath(openApi),
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
      openApi: getPath(openApi),
    });

    expect(module).toMatchSnapshot();
  });
});
