import prettier, { type Options, resolveConfig } from "prettier";
import parserTypescript from "prettier/parser-typescript";

export async function prettify(input: string, options?: Options | null): Promise<string> {
  try {
    const config = await resolveConfig("./");
    return prettier.format(input.trim(), {
      parser: "typescript",
      plugins: [parserTypescript],
      ...config,
      ...options,
    });
  } catch {
    return input;
  }
}
