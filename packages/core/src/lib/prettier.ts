import type { Options } from "prettier";

import * as parserTypescript from "prettier/parser-typescript";
import * as prettierPluginEstree from "prettier/plugins/estree";
import { format } from "prettier/standalone";

export async function prettify(input: string, config?: Options | null): Promise<string> {
  try {
    return format(input.trim(), {
      parser: "typescript",
      plugins: [parserTypescript, prettierPluginEstree],
      ...config,
    });
  } catch (error) {
    return input;
  }
}
