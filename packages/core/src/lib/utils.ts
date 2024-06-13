import camelcase from "camelcase";
import ts from "typescript";

import type { OpenAPIComponentPath } from "../domain/types";

import { validateRef } from "../domain/validators";

/**
 * Converts an AST (Abstract Syntax Tree) to a string.
 *
 * @param ast - The AST to convert. Can be a single node, an array of nodes, a single type element, or an array of type elements.
 * @param options.fileName - The name of the file for the source file object. Defaults to "contract.ts".
 * @param options.sourceText - The source text to include in the source file object. Defaults to an empty string.
 * @param options.formatOptions - Optional formatting options for the printer.
 * @returns The string representation of the AST.
 */
export function astToString(
  ast: ts.Node | ts.Node[] | ts.TypeElement | ts.TypeElement[],
  options: {
    fileName?: string;
    formatOptions?: ts.PrinterOptions;
    sourceText?: string;
  } = {}
): string {
  const { fileName = "contract.ts", formatOptions, sourceText = "" } = options;

  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.TS
  );

  // @ts-expect-error it’s OK to overwrite statements once
  sourceFile.statements = ts.factory.createNodeArray(Array.isArray(ast) ? ast : [ast]);

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false,
    ...formatOptions,
  });

  return printer.printFile(sourceFile);
}

/**
 * A function that does nothing and returns undefined.
 *
 * @returns {void}
 */
export function noop(): undefined {
  return void 0;
}

/**
 * An utility class to write TypeScript AST nodes.
 */
export class AstTsWriter {
  private nodes: ts.Node[] = [];

  /**
   * Adds one or more nodes to the writer.
   * @param nodes The nodes to add.
   * @returns The updated `AstTsWriter` instance.
   */
  add(...nodes: ts.Node[]): typeof this {
    this.nodes.push(...nodes);
    return this;
  }

  /**
   * Converts the added nodes to a string representation.
   * @returns The string representation of the added nodes.
   */
  toString(): string {
    return astToString(this.nodes);
  }
}

/**
 * Formats a string to a valid identifier by replacing invalid characters with underscores.
 * If the string doesn't start with a valid identifier character, an underscore is added at the beginning.
 *
 * @param str - The string to format.
 * @returns The formatted string.
 */
export const formatToIdentifierString = (str: string): string => {
  const replacedStr = str.replace(/[^a-zA-Z0-9_$]/g, "_");
  return /^[a-zA-Z_$]/.test(replacedStr) ? replacedStr : "_" + replacedStr;
};

/**
 * Converts a path to a variable name.
 * It replaces all slashes, dots, and curly braces with dashes and camelcases the result.
 *
 * @param path - The path to convert.
 * @returns The variable name.
 *
 * @example
 * ```typescript
 * pathToVariableName("/path/to/{id}") // "pathToId"
 * pathToVariableName("/path/to/resource") // "pathToResource"
 * pathToVariableName("/robots.txt") // "robotsTxt"
 * ```
 */
export const convertPathToVariableName = (path: string): string =>
  camelcase(path.replaceAll(/(\/|\.|{)/g, "-").replaceAll("}", ""));

/**
 * Validate and parse an OpenAPI ref string.
 *
 * @param ref - The OpenAPI ref string.
 * @returns The component type and component identifier.
 */
export const parseRefComponents = (
  ref: string
): {
  identifier: string;
  type: OpenAPIComponentPath;
} => {
  validateRef(ref);

  const [
    _, // #/
    __, // components/
    type, // "(schemas|parameters|requestBodies|responses|headers)/"
    identifier,
  ] = ref.split("/") as [string, string, OpenAPIComponentPath, string];

  return {
    identifier,
    type,
  };
};

/**
 * Generates the powerset of an array.
 *
 * @param array - The array to generate the powerset from.
 * @returns The powerset of the array.
 *
 * @example
 * ```typescript
 * generatePowerset([1, 2, 3]); // [[], [1], [2], [1, 2], [3], [1, 3], [2, 3], [1, 2, 3]]
 * ```
 */
export function generatePowerset<T>(array: T[]): T[][] {
  const result: T[][] = [];
  result.push([]);

  // eslint-disable-next-line functional/no-let, no-bitwise
  for (let i = 1; i < 1 << array.length; i++) {
    const subset = [];
    // eslint-disable-next-line functional/no-let, no-bitwise
    for (let j = 0; j < array.length; j++) if (i & (1 << j)) subset.push(array[j]);

    result.push(subset);
  }

  return result;
}
