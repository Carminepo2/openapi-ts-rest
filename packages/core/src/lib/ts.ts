/**
 * This module provides a set of utility functions to generate TypeScript AST nodes.
 * It helps to avoid using the TypeScript compiler API directly, which can be verbose and error-prone.
 */

import { P, match } from "ts-pattern";
import ts from "typescript";

import { unexpectedError } from "../domain/errors";

export type TsKeyword = "const" | "let" | "var";
export type TsLiteral = boolean | null | number | string;
export type TsLiteralOrExpression = TsLiteral | ts.Expression;
export type TsFunctionCall = {
  args?: TsLiteralOrExpression[];
  identifier: string;
  typeGenerics?: [string, ...string[]];
};

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
}): ts.ImportDeclaration {
  return ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      false,
      undefined,
      ts.factory.createNamedImports(
        import_.map((name) =>
          ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(name))
        )
      )
    ),
    ts.factory.createStringLiteral(from),
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
export function tsNamedExport({ export_: names }: { export_: string[] }): ts.ExportDeclaration {
  return ts.factory.createExportDeclaration(
    undefined,
    false,
    ts.factory.createNamedExports(
      names.map((n) =>
        ts.factory.createExportSpecifier(false, undefined, ts.factory.createIdentifier(n))
      )
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
export function tsLiteralOrExpression(value: string): ts.StringLiteral;
export function tsLiteralOrExpression(value: number): ts.NumericLiteral;
export function tsLiteralOrExpression(value: true): ts.TrueLiteral;
export function tsLiteralOrExpression(value: false): ts.FalseLiteral;
export function tsLiteralOrExpression(value: null): ts.NullLiteral;
export function tsLiteralOrExpression(value: ts.Expression): ts.Expression;
export function tsLiteralOrExpression(
  value: TsLiteralOrExpression
):
  | ts.Expression
  | ts.FalseLiteral
  | ts.NullLiteral
  | ts.NumericLiteral
  | ts.StringLiteral
  | ts.TrueLiteral;
export function tsLiteralOrExpression(
  value: TsLiteralOrExpression
):
  | ts.Expression
  | ts.FalseLiteral
  | ts.NullLiteral
  | ts.NumericLiteral
  | ts.StringLiteral
  | ts.TrueLiteral {
  return match(value)
    .with(P.string, (value) => ts.factory.createStringLiteral(value))
    .with(
      P.number,
      (v) => v < 0,
      (v) =>
        ts.factory.createPrefixUnaryExpression(
          ts.SyntaxKind.MinusToken,
          ts.factory.createNumericLiteral(Math.abs(v))
        )
    )
    .with(P.number, (value) => ts.factory.createNumericLiteral(value))
    .with(true, () => ts.factory.createTrue())
    .with(false, () => ts.factory.createFalse())
    .with(null, () => ts.factory.createNull())
    .when(ts.isExpression, (v) => v)
    .exhaustive();
}

/**
 * Returns the corresponding TypeScript AST node for the given keyword.
 *
 * @param keyword - The keyword.
 * @returns The TypeScript AST node for the keyword.
 */
export function tsKeyword(keyword: "var"): ts.NodeFlags.None;
export function tsKeyword(keyword: "let"): ts.NodeFlags.Let;
export function tsKeyword(keyword: "const"): ts.NodeFlags.Const;
export function tsKeyword(keyword: TsKeyword): ts.NodeFlags;
export function tsKeyword(keyword: TsKeyword): ts.NodeFlags {
  return match(keyword)
    .with("var", () => ts.NodeFlags.None)
    .with("let", () => ts.NodeFlags.Let)
    .with("const", () => ts.NodeFlags.Const)
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
): ts.VariableStatement {
  return ts.factory.createVariableStatement(
    export_ ? [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)] : undefined,
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          ts.factory.createIdentifier(identifier),
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
 * @param identifier - The name of the function to be called.
 * @param args - An array of arguments to pass to the function, each of which should be a valid TypeScript expression.
 * @param typeGenerics - An optional array of generic type parameters for the function call, each represented as a string.
 * @returns A `ts.CallExpression` representing a TypeScript function call.
 *
 * @example
 * ```ts
 * tsFunctionCall({
 *   identifier: "myFunction",
 *   args: ["arg1", "arg2"],
 *   typeGenerics: ["T"]
 * });
 * // Resulting code: myFunction<T>("arg1", "arg2");
 * ```
 */
export function tsFunctionCall({
  args,
  identifier,
  typeGenerics,
}: TsFunctionCall): ts.CallExpression {
  return ts.factory.createCallExpression(
    ts.factory.createIdentifier(identifier),
    typeGenerics?.map((t) =>
      ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(t), undefined)
    ),
    args?.map(tsLiteralOrExpression)
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
  ...properties: Array<
    [key: number | string, value: TsLiteralOrExpression] | [key: string | ts.Identifier]
  >
): ts.ObjectLiteralExpression {
  return ts.factory.createObjectLiteralExpression(
    properties.map(([key, value]) =>
      match([key, value])
        .with([P.string, P.nonNullable], ([key, value]) =>
          ts.factory.createPropertyAssignment(
            ts.factory.createStringLiteral(key),
            tsLiteralOrExpression(value)
          )
        )
        .with([P.number, P.nonNullable], ([key, value]) =>
          ts.factory.createPropertyAssignment(
            ts.factory.createNumericLiteral(key),
            tsLiteralOrExpression(value)
          )
        )
        .with([P.string, P.nullish], ([key]) =>
          ts.factory.createShorthandPropertyAssignment(ts.factory.createIdentifier(key), undefined)
        )
        .with([P.when(ts.isIdentifier), P.nullish], ([key]) =>
          ts.factory.createShorthandPropertyAssignment(key, undefined)
        )
        .otherwise(([key, value]) => {
          throw unexpectedError({
            detail: `Unexpected key of value type creating ast ts object. key: ${key}, value: ${value}`,
          });
        })
    )
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
export function tsArray(...elements: TsLiteralOrExpression[]): ts.ArrayLiteralExpression {
  return ts.factory.createArrayLiteralExpression(elements.map(tsLiteralOrExpression));
}

/**
 * Creates an AST TypeScript method call expression.
 * Chains multiple method calls on an initial identifier or expression.
 *
 * @param identifier - The base identifier or expression to call methods on (e.g., an object or function name).
 * @param chain - An array of method call configurations to chain onto the base identifier. Each method call can specify:
 *   - `identifier`: The method name to call.
 *   - `args`: Arguments to pass to the method.
 *   - `typeGenerics`: Optional generic type arguments for the method.
 * @returns A `ts.Expression` representing a chain of method calls.
 *
 * @example
 * ```ts
 * tsChainedMethodCall("foo",
 *   { identifier: "bar", args: ["baz"] },
 *   { identifier: "qux", args: ["quux"], typeGenerics: ["T"] }
 * );
 * // Resulting code: foo.bar("baz").qux<T>("quux")
 * ```
 */
export function tsChainedMethodCall(
  identifier: string | ts.Expression,
  ...chain: TsFunctionCall[]
): ts.Expression {
  const first =
    typeof identifier === "string" ? ts.factory.createIdentifier(identifier) : identifier;

  if (chain.length === 0) return first;

  return chain.reduce(
    (expression, { args, identifier, typeGenerics }) =>
      ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          expression,
          ts.factory.createIdentifier(identifier)
        ),
        typeGenerics?.map((t) =>
          ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(t), undefined)
        ),
        args?.map(tsLiteralOrExpression)
      ),
    first
  );
}

/**
 * Create an new line in the AST.
 * This might be a bit hacky, but it works.
 * @see https://stackoverflow.com/a/69240365
 *
 * @returns
 */
export function tsNewLine(): ts.Identifier {
  return ts.factory.createIdentifier("\n");
}

/**
 * Create an AST Typescript identifier.
 *
 * @param name the name of the identifier
 * @returns the AST Typescript identifier
 */
export function tsIdentifier(name: string): ts.Identifier {
  return ts.factory.createIdentifier(name);
}

/**
 * Create an AST Typescript regular expression literal.
 * @param pattern the pattern of the regular expression
 * @returns the AST Typescript regular expression literal
 */
export function tsRegex(pattern: string): ts.RegularExpressionLiteral {
  return ts.factory.createRegularExpressionLiteral(pattern);
}
