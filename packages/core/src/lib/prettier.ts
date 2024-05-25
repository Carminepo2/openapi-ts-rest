import * as prettier from "prettier/standalone";
import type { Options } from "prettier";
import * as parserTypescript from "prettier/parser-typescript";
import * as prettierPluginEstree from "prettier/plugins/estree";

export async function prettify(input: string, config?: Options | null): Promise<string> {
  try {
    return prettier.format(input.trim(), {
      parser: "typescript",
      plugins: [parserTypescript, prettierPluginEstree],
      ...config,
    });
  } catch (error) {
    console.log(error);

    return input;
  }
}
