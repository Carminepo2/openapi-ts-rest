import type { Options } from "prettier";

import * as parserTypescript from "prettier/parser-typescript";
import * as prettierPluginEstree from "prettier/plugins/estree";
import * as prettier from "prettier/standalone";

export async function prettify(input: string, config?: Options | null): Promise<string> {
  try {
    return prettier.format(input.trim(), {
      parser: "typescript",
      plugins: [parserTypescript, prettierPluginEstree],
      ...config,
    });
  } catch (error) {
    return input;
  }
}
