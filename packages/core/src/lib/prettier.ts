import type { Options } from "prettier";

import { format } from "prettier";
import * as parserTypescript from "prettier/parser-typescript";

export async function prettify(input: string, config?: Options | null): Promise<string> {
  try {
    return format(input.trim(), {
      parser: "typescript",
      plugins: [parserTypescript],
      ...config,
    });
  } catch (error) {
    return input;
  }
}
