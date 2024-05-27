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
 * Performs a topological sort on a directed graph.
 *
 * A topological sort is used here to sort the components in an OpenAPI schema in the correct order.
 * Meaning that if a component depends on another component, the dependent component will be sorted after the dependency.
 * So, the components can be generated in the correct order.
 *
 * @param graph - The graph to sort, represented as an adjacency list.
 *
 * @returns An array of vertices in topologically sorted order.
 *
 * @example
 * const graph = {
 *   a: ['b', 'c'],
 *   b: ['d'],
 *   c: [],
 *   d: []
 * };
 * const sorted = topologicalSort(graph);
 * console.log(sorted); // Output: ['a', 'c', 'b', 'd']
 */
export function topologicalSort(graph: Record<string, Set<string>>): string[] {
  const sorted = new Set<string>();
  const visited: Record<string, boolean> = {};

  function visit(name: string, ancestors: Set<string>): void {
    ancestors.add(name);
    visited[name] = true;

    const node = graph[name] as Set<string> | undefined;

    if (node) {
      node.forEach((dep) => {
        if (ancestors.has(dep)) {
          // Handle circular dependencies
          return;
        }
        if (visited[dep]) return;
        visit(dep, ancestors);
      });
    }

    sorted.add(name);
  }

  Object.keys(graph).forEach((name) => {
    if (!visited[name]) {
      visit(name, new Set());
    }
  });

  return Array.from(sorted);
}
