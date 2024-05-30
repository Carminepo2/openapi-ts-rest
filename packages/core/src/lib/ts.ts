/**
 * This module provides a set of utility functions to generate TypeScript AST nodes.
 * It helps to avoid using the TypeScript compiler API directly, which can be verbose and error-prone.
 */

import { P, match } from "ts-pattern";
import {
  type ArrayLiteralExpression,
  type CallExpression,
  type ExportDeclaration,
  type Expression,
  type FalseLiteral,
  type Identifier,
  type ImportDeclaration,
  NodeFlags,
  type NullLiteral,
  type NumericLiteral,
  type ObjectLiteralExpression,
  type RegularExpressionLiteral,
  type StringLiteral,
  SyntaxKind,
  type TrueLiteral,
  type VariableStatement,
  factory,
  isExpression,
} from "typescript";

export type TsKeyword = "const" | "let" | "var";
export type TsLiteral = boolean | null | number | string;
export type TsLiteralOrExpression = Expression | TsLiteral;
export type TsFunctionCall = [identifier: string, ...args: TsLiteralOrExpression[]];

/**
 * Creates an AST TypeScript named import statement.
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
export function tsNamedImport({
  from,
  import_,
}: {
  from: string;
  import_: string[];
}): ImportDeclaration {
  return factory.createImportDeclaration(
    undefined,
    factory.createImportClause(
      false,
      undefined,
      factory.createNamedImports(
        import_.map((name) =>
          factory.createImportSpecifier(false, undefined, factory.createIdentifier(name))
        )
      )
    ),
    factory.createStringLiteral(from),
    undefined
  );
}

/**
 * Creates an AST TypeScript named export statement.
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
export function tsNamedExport({ export_: names }: { export_: string[] }): ExportDeclaration {
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
): Expression | FalseLiteral | NullLiteral | NumericLiteral | StringLiteral | TrueLiteral;
export function tsLiteralOrExpression(
  value: TsLiteralOrExpression
): Expression | FalseLiteral | NullLiteral | NumericLiteral | StringLiteral | TrueLiteral {
  return match(value)
    .with(P.string, (value) => factory.createStringLiteral(value))
    .with(
      P.number,
      (v) => v < 0,
      (v) =>
        factory.createPrefixUnaryExpression(
          SyntaxKind.MinusToken,
          factory.createNumericLiteral(Math.abs(v))
        )
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
 * @param keyword - The keyword.
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

/**
 * Creates an AST TypeScript variable declaration statement.
 *
 * @param keyword - The variable declaration keyword.
 * @param identifier - The variable identifier.
 * @param eq - The primitive value or the ast expresion to assign to the variable.
 * @param export_ - Whether to export the variable.
 *
 * @returns The TypeScript AST variable declaration statement.
 *
 * @example
 * ```ts
 * tsVariableDeclaration("const", "foo", { eq: "bar" });
 * // const foo = "bar";
 *
 * tsVariableDeclaration("let", "foo", { eq: tsObject({}) });
 * // let foo = {};
 *
 * tsVariableDeclaration("var", "foo", { eq: tsFunctionCall("fn", "arg"), _export: true });
 * // export var foo = fn("arg");
 * ```
 */
export function tsVariableDeclaration(
  keyword: TsKeyword,
  identifier: string,
  { eq: value, export_ }: { eq: TsLiteralOrExpression; export_?: boolean }
): VariableStatement {
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

/**
 * Creates an AST TypeScript function call expression.
 *
 * @param fn - The first argument is the identifier (name) of the function. The remaining arguments are the parameters to pass to the function.
 * @returns  An AST TypeScript function call expression.
 *
 * @example
 * ```ts
 * tsFunctionCall("fn", "arg1", "arg2");
 * // fn("arg1", "arg2");
 * ```
 */
export function tsFunctionCall(...fn: TsFunctionCall): CallExpression {
  const [identifier, ...fnCallArgs] = fn;
  return factory.createCallExpression(
    factory.createIdentifier(identifier),
    undefined,
    fnCallArgs.map(tsLiteralOrExpression)
  );
}

/**
 * Creates an AST TypeScript object literal expression.
 * @param properties An array of key-value pairs to create the object properties. The value can be primitive (which will be automatically converted to an AST expression) or an AST expression.
 * @returns The TypeScript AST object literal expression.
 *
 * @example
 * ```ts
 * tsObject(["foo", "bar"], ["baz", 42]);
 * // { foo: "bar", baz: 42 }
 * ```
 */
export function tsObject(
  ...properties: Array<[key: Identifier | string] | [key: string, value: TsLiteralOrExpression]>
): ObjectLiteralExpression {
  return factory.createObjectLiteralExpression(
    properties.map(([key, value]) => {
      if (value && typeof key === "string") {
        return factory.createPropertyAssignment(
          factory.createStringLiteral(key),
          tsLiteralOrExpression(value)
        );
      }
      return factory.createShorthandPropertyAssignment(
        typeof key === "string" ? factory.createIdentifier(key) : key,
        undefined
      );
    })
  );
}

/**
 * Creates an AST TypeScript array literal expression.
 * @param elements An array of elements to create the array. The elements can be primitive (which will be automatically converted to an AST expression) or an AST expression.
 * @returns The TypeScript AST array literal expression.
 *
 * @example
 * ```ts
 * tsArray("foo", 42);
 * // ["foo", 42]
 * ```
 */
export function tsArray(...elements: TsLiteralOrExpression[]): ArrayLiteralExpression {
  return factory.createArrayLiteralExpression(elements.map(tsLiteralOrExpression));
}

/**
 * Creates an AST TypeScript method call expression.
 * Method calls are chained together.
 *
 * @param identifier the identifier of the object to call the method on
 * @param param1 the method to call
 * @param chain the rest of the method calls
 * @returns the AST TypeScript property call expression
 *
 * @example
 * ```ts
 * tsPropertyCall("foo", ["bar", "baz"], ["qux", "quux"]);
 * // foo.bar("baz").qux("quux")
 * ```
 */
export function tsChainedMethodCall(identifier: string, ...chain: TsFunctionCall[]): Expression {
  if (identifier.length === 0) return factory.createIdentifier(identifier);

  return chain.reduce(
    (expression, [method, ...args]) =>
      factory.createCallExpression(
        factory.createPropertyAccessExpression(expression, factory.createIdentifier(method)),
        undefined,
        args.map(tsLiteralOrExpression)
      ),
    factory.createIdentifier(identifier) as Expression
  );
}

/**
 * Create an new line in the AST.
 * This might be a bit hacky, but it works.
 * @see https://stackoverflow.com/a/69240365
 *
 * @returns
 */
export function tsNewLine(): Identifier {
  return factory.createIdentifier("\n");
}

/**
 * Create an AST Typescript identifier.
 *
 * @param name the name of the identifier
 * @returns the AST Typescript identifier
 */
export function tsIdentifier(name: string): Identifier {
  return factory.createIdentifier(name);
}

/**
 * Create an AST Typescript regular expression literal.
 * @param pattern the pattern of the regular expression
 * @returns the AST Typescript regular expression literal
 */
export function tsRegex(pattern: string): RegularExpressionLiteral {
  return factory.createRegularExpressionLiteral(pattern);
}
