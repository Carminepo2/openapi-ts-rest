import camelcase from "camelcase";
import ts from "typescript";

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
