import ts from "typescript";

export interface AstToStringOptions {
  fileName?: string;
  sourceText?: string;
  formatOptions?: ts.PrinterOptions;
}

export function astToString(
  ast: ts.Node | ts.Node[] | ts.TypeElement | ts.TypeElement[],
  options?: AstToStringOptions
): string {
  const sourceFile = ts.createSourceFile(
    options?.fileName ?? "contract.ts",
    options?.sourceText ?? "",
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.TS
  );

  // @ts-expect-error it’s OK to overwrite statements once
  sourceFile.statements = ts.factory.createNodeArray(Array.isArray(ast) ? ast : [ast]);

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false,
    ...options?.formatOptions,
  });
  return printer.printFile(sourceFile);
}

export function noop() {
  return void 0;
}

export class AstTsWriter {
  private nodes: ts.Node[] = [];

  add(...nodes: ts.Node[]) {
    this.nodes.push(...nodes);
    return this;
  }

  toString() {
    return astToString(this.nodes);
  }
}
