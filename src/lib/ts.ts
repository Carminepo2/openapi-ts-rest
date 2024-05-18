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

export function tsNamedImport({ import_, from }: { import_: Array<string>; from: string }) {
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

export function tsNamedExport({ export_: names }: { export_: Array<string> }) {
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

type TsLiteral = string | number | boolean | null | Expression;
export type TsLiteralOrExpression = TsLiteral | Expression;

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

type TsStatement = "var" | "let" | "const";
export function tsStatement(statement: "var"): NodeFlags.None;
export function tsStatement(statement: "let"): NodeFlags.Let;
export function tsStatement(statement: "const"): NodeFlags.Const;
export function tsStatement(statement: TsStatement): NodeFlags;
export function tsStatement(statement: TsStatement): NodeFlags {
  return match(statement)
    .with("var", () => NodeFlags.None)
    .with("let", () => NodeFlags.Let)
    .with("const", () => NodeFlags.Const)
    .exhaustive();
}

export function tsAssignment(
  statement: TsStatement,
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
      tsStatement(statement)
    )
  );
}

export function tsFunctionCall(identifier: string, ...args: TsLiteralOrExpression[]) {
  return factory.createCallExpression(factory.createIdentifier(identifier), undefined, args.map(tsLiteralOrExpression));
}

export function tsObject(...properties: Array<[key: string, value: TsLiteralOrExpression]>) {
  return factory.createObjectLiteralExpression(
    properties.map(([key, value]) =>
      factory.createPropertyAssignment(factory.createIdentifier(key), tsLiteralOrExpression(value))
    )
  );
}

export function tsPropertyCall(
  identifier: string,
  [method, ...args]: [method: string, ...args: TsLiteralOrExpression[]],
  ...chain: [method: string, ...args: TsLiteralOrExpression[]][]
) {
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
