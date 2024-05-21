/**
 * This module provides a set of utility functions to generate TypeScript AST nodes.
 * It helps to avoid using the TypeScript compiler API directly, which can be verbose and error-prone.
 */

import { match, P } from "ts-pattern";
import {
  factory,
  NodeFlags,
  type Expression,
  isExpression,
  type StringLiteral,
  type NumericLiteral,
  type TrueLiteral,
  type FalseLiteral,
  type NullLiteral,
  SyntaxKind,
} from "typescript";

export type TsKeyword = "var" | "let" | "const";
export type TsLiteral = string | number | boolean | null;
export type TsLiteralOrExpression = TsLiteral | Expression;
export type TsFunctionCall = [identifier: string, ...args: TsLiteralOrExpression[]];

/**
 * Creates a TypeScript named import statement.
 *
 * @param import_ The names of the imports.
 * @param from The module specifier.
 * @returns The TypeScript AST import statement.
 *
 * @example
 * ```ts
 * tsNamedImport({ import_: ["foo", "bar"], from: "./module" });
 * // import { foo, bar } from "./module";
 * ```
 */
export function tsNamedImport({ import_, from }: { import_: string[]; from: string }) {
  return factory.createImportDeclaration(
    undefined,
    factory.createImportClause(
      false,
      undefined,
      factory.createNamedImports(
        import_.map((name) => factory.createImportSpecifier(false, undefined, factory.createIdentifier(name)))
      )
    ),
    factory.createStringLiteral(from),
    undefined
  );
}

/**
 * Creates a TypeScript named export statement.
 *
 * @param export_ The identifiers to export
 * @returns The TypeScript AST named export statement.
 *
 * @example
 * ```ts
 * tsNamedExport({ export_: ["foo", "bar"] });
 * // export { foo, bar };
 * ```
 */
export function tsNamedExport({ export_: names }: { export_: string[] }) {
  return factory.createExportDeclaration(
    undefined,
    false,
    factory.createNamedExports(
      names.map((n) => factory.createExportSpecifier(false, undefined, factory.createIdentifier(n)))
    ),
    undefined,
    undefined
  );
}

/**
 * Accepts both Javascript primitive values and TypeScript AST nodes and returns the corresponding AST node.
 * If the input is a primitive value, it returns the corresponding TypeScript AST node.
 * If the input is already a TypeScript AST node, it returns the input as is.
 *
 * This function is useful when you want to accept both primitive values and TypeScript AST nodes as input.
 *
 * @param value - The primitive value or TypeScript AST node.
 * @returns The TypeScript AST node.
 *
 * @example
 * ```ts
 * tsLiteralOrExpression("foo");
 * // StringLiteral { text: "foo" }
 *
 * tsLiteralOrExpression(42);
 * // NumericLiteral { text: "42" }
 *
 * tsLiteralOrExpression(true);
 * // TrueLiteral {}
 *
 * tsLiteralOrExpression(StringLiteral { text: "foo" });
 * // StringLiteral { text: "foo" }
 * ```
 */
export function tsLiteralOrExpression(value: string): StringLiteral;
export function tsLiteralOrExpression(value: number): NumericLiteral;
export function tsLiteralOrExpression(value: true): TrueLiteral;
export function tsLiteralOrExpression(value: false): FalseLiteral;
export function tsLiteralOrExpression(value: null): NullLiteral;
export function tsLiteralOrExpression(value: Expression): Expression;
export function tsLiteralOrExpression(
  value: TsLiteralOrExpression
): StringLiteral | NumericLiteral | TrueLiteral | FalseLiteral | NullLiteral | Expression;
export function tsLiteralOrExpression(
  value: TsLiteralOrExpression
): StringLiteral | NumericLiteral | TrueLiteral | FalseLiteral | NullLiteral | Expression {
  return match(value)
    .with(P.string, (value) => factory.createStringLiteral(value))
    .with(
      P.number,
      (v) => v < 0,
      (v) => factory.createPrefixUnaryExpression(SyntaxKind.MinusToken, factory.createNumericLiteral(Math.abs(v)))
    )
    .with(P.number, (value) => factory.createNumericLiteral(value))
    .with(true, () => factory.createTrue())
    .with(false, () => factory.createFalse())
    .with(null, () => factory.createNull())
    .when(isExpression, (v) => v)
    .exhaustive();
}

/**
 * Returns the corresponding TypeScript AST node for the given keyword.
 *
 * @param keyword - The keywod.
 * @returns The TypeScript AST node for the keyword.
 */
export function tsKeyword(keyword: "var"): NodeFlags.None;
export function tsKeyword(keyword: "let"): NodeFlags.Let;
export function tsKeyword(keyword: "const"): NodeFlags.Const;
export function tsKeyword(keyword: TsKeyword): NodeFlags;
export function tsKeyword(keyword: TsKeyword): NodeFlags {
  return match(keyword)
    .with("var", () => NodeFlags.None)
    .with("let", () => NodeFlags.Let)
    .with("const", () => NodeFlags.Const)
    .exhaustive();
}

export function tsVariableDeclaration(
  keyword: TsKeyword,
  identifier: string,
  { eq: value, export_ }: { eq: TsLiteralOrExpression; export_?: boolean }
) {
  return factory.createVariableStatement(
    export_ ? [factory.createToken(SyntaxKind.ExportKeyword)] : undefined,
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(identifier),
          undefined,
          undefined,
          tsLiteralOrExpression(value)
        ),
      ],
      tsKeyword(keyword)
    )
  );
}

export function tsFunctionCall(...args: TsFunctionCall) {
  const [identifier, ...fnCallArgs] = args;
  return factory.createCallExpression(
    factory.createIdentifier(identifier),
    undefined,
    fnCallArgs.map(tsLiteralOrExpression)
  );
}

export function tsObject(...properties: [key: string, value: TsLiteralOrExpression][]) {
  return factory.createObjectLiteralExpression(
    properties.map(([key, value]) =>
      factory.createPropertyAssignment(factory.createIdentifier(key), tsLiteralOrExpression(value))
    )
  );
}

export function tsArray(...elements: TsLiteralOrExpression[]) {
  return factory.createArrayLiteralExpression(elements.map(tsLiteralOrExpression));
}

export function tsPropertyCall(identifier: string, [method, ...args]: TsFunctionCall, ...chain: TsFunctionCall[]) {
  let expression: Expression = factory.createCallExpression(
    factory.createPropertyAccessExpression(factory.createIdentifier(identifier), factory.createIdentifier(method)),
    undefined,
    args.map(tsLiteralOrExpression)
  );

  for (const [method, ...args] of chain) {
    expression = factory.createCallExpression(
      factory.createPropertyAccessExpression(expression, factory.createIdentifier(method)),
      undefined,
      args.map(tsLiteralOrExpression)
    );
  }

  return expression;
}

export function tsNewLine() {
  return factory.createIdentifier("\n");
}

export function tsIdentifier(name: string) {
  return factory.createIdentifier(name);
}

export function tsRegex(pattern: string) {
  return factory.createRegularExpressionLiteral(pattern);
}
