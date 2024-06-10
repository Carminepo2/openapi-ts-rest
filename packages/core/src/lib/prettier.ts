import type { Options } from "prettier";

import { format } from "prettier";
import * as parserTypescript from "prettier/parser-typescript";
import * as prettierPluginEstree from "prettier/plugins/estree";

export async function prettify(input: string, config?: Options | null): Promise<string> {
  try {
    return format(input.trim(), {
      parser: "typescript",
      ...config,
      plugins: [parserTypescript, prettierPluginEstree],
    });
  } catch (error) {
    return input;
  }
}
