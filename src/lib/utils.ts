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
    sourceText?: string;
    formatOptions?: ts.PrinterOptions;
  } = {}
): string {
  const { fileName = "contract.ts", sourceText = "", formatOptions } = options;

  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.ESNext, false, ts.ScriptKind.TS);

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
export function noop(): void {
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
  add(...nodes: ts.Node[]) {
    this.nodes.push(...nodes);
    return this;
  }

  /**
   * Converts the added nodes to a string representation.
   * @returns The string representation of the added nodes.
   */
  toString() {
    return astToString(this.nodes);
  }
}
