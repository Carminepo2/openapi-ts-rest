import { type SchemaObject } from "openapi3-ts/oas30";
import {
  tsArray,
  tsIdentifier,
  tsObject,
  tsPropertyCall,
  type TsFunctionCall,
  type TsLiteralOrExpression,
} from "./lib/ts";
import { match, P } from "ts-pattern";
import type { Context } from "./context";
import { noop } from "./lib/utils";
import type { Expression } from "typescript";

const Z = {
  NUMBER: "number",
  STRING: "string",
  BOOLEAN: "boolean",
  NULL: "null",
  ARRAY: "array",
  OBJECT: "object",
  UNION: "union",
  ANY: "any",
  UNKNOWN: "unknown",
  LITERAL: "literal",
  REGEX: "regex",
  ENUM: "enum",
  NEVER: "never",

  INT: "int",
  GT: "gt",
  GTE: "gte",
  LT: "lt",
  LTE: "lte",
  MULTIPLE_OF: "multipleOf",
  INSTANCE_OF: "instanceOf",
  UUID: "uuid",
  URL: "url",
  EMAIL: "email",
  DATETIME: "datetime",
  IP: "ip",
  MIN: "min",
  MAX: "max",
} as const;

export function openAPISchemaObjectToAstZodSchema(schema: SchemaObject, ctx: Context): Expression {
  if (schema.oneOf || schema.anyOf || schema.allOf) {
    throw new Error("oneOf, anyOf and allOf are currently not supported");
  }

  if (schema.enum) {
    function resolveEnumValue(value: unknown): string {
      if (value === null) return "null";
      return `"${value as string}"`;
    }

    if (schema.type === "string") {
      if (schema.enum.length === 1) {
        return tsPropertyCall("z", [Z.LITERAL, resolveEnumValue(schema.enum[0])]);
      }

      return tsPropertyCall("z", [Z.ENUM, tsArray(...schema.enum.map(resolveEnumValue))]);
    }

    if (schema.enum.some((e) => typeof e === "string")) {
      return tsPropertyCall("z", [Z.NEVER]);
    }

    if (schema.enum.length === 1) {
      return tsPropertyCall("z", [Z.LITERAL, schema.enum[0]]);
    }

    return tsPropertyCall("z", [
      Z.ENUM,
      tsArray(...schema.enum.map((value) => tsPropertyCall("z", [Z.LITERAL, resolveEnumValue(value)]))),
    ]);
  }

  return match(schema.type)
    .with(
      P.array(P.any),
      (t) => t.length === 1,
      (t) => openAPISchemaObjectToAstZodSchema({ ...schema, type: t[0] }, ctx)
    )
    .with(
      P.array(P.any),
      (t) => t.length > 1,
      (t) =>
        tsPropertyCall("z", [
          Z.UNION,
          tsArray(...t.map((type) => openAPISchemaObjectToAstZodSchema({ ...schema, type }, ctx))),
        ])
    )
    .with(
      "string",
      () => schema.format === "binary",
      () => {
        return tsPropertyCall("z", [Z.INSTANCE_OF, tsIdentifier("File")]);
      }
    )
    .with("string", () => {
      return tsPropertyCall("z", [Z.STRING], ...buildZodStringValidationChain(schema));
    })
    .with("number", "integer", () => {
      return tsPropertyCall("z", [Z.NUMBER], ...buildZodNumberValidationChain(schema));
    })
    .with("boolean", () => {
      return tsPropertyCall("z", [Z.BOOLEAN]);
    })
    .with("null", () => {
      return tsPropertyCall("z", [Z.NULL]);
    })
    .with("array", () => {
      return tsPropertyCall(
        "z",
        [
          Z.ARRAY,
          schema.items
            ? openAPISchemaObjectToAstZodSchema(ctx.resolveOpenAPIComponent(schema.items), ctx)
            : tsPropertyCall("z", [Z.ANY]),
        ],
        ...buildZodArrayValidationChain(schema)
      );
    })
    .when(
      (t) => Boolean(t === "object" || schema.properties),
      () => {
        //TODO: Add support for `schema.additionalProperties`
        if (!schema.properties) return tsPropertyCall("z", [Z.OBJECT, tsObject()]);
        const properties: [string, TsLiteralOrExpression][] = Object.entries(schema.properties).map(
          ([key, schemaOrRef]) => {
            const propSchema = ctx.resolveOpenAPIComponent(schemaOrRef);
            return [key, openAPISchemaObjectToAstZodSchema(propSchema, ctx)];
          }
        );
        return tsPropertyCall("z", [Z.OBJECT, tsObject(...properties)]);
      }
    )
    .with(P.nullish, () => {
      return tsPropertyCall("z", [Z.UNKNOWN]);
    })
    .otherwise((t) => {
      throw new Error(`Unsupported schema type ${t as unknown as string}`);
    });
}

function buildZodStringValidationChain(schema: SchemaObject): TsFunctionCall[] {
  const zodValidationMethods: TsFunctionCall[] = [];

  if (schema.minLength) {
    zodValidationMethods.push([Z.MIN, schema.minLength]);
  }

  if (schema.maxLength) {
    zodValidationMethods.push([Z.MAX, schema.maxLength]);
  }

  if (schema.pattern) {
    zodValidationMethods.push([Z.REGEX, sanitizeAndFormatRegex(schema.pattern)]);
  }

  const format = match<typeof schema.format, TsFunctionCall | undefined>(schema.format)
    .with("uuid", () => [Z.UUID])
    .with("hostname", "uri", () => [Z.URL])
    .with("email", () => [Z.EMAIL])
    .with("date-time", () => [Z.DATETIME, tsObject(["offset", true])])
    .with("ipv4", () => [Z.IP, tsObject(["version", "v4"])])
    .with("ipv6", () => [Z.IP, tsObject(["version", "v6"])])
    .otherwise(noop);

  if (format) {
    zodValidationMethods.push(format);
  }

  return zodValidationMethods;
}

function sanitizeAndFormatRegex(pattern: string) {
  if (pattern.startsWith("/") && pattern.endsWith("/")) {
    pattern = pattern.slice(1, -1);
  }

  // Escapes control characters
  // eslint-disable-next-line no-control-regex
  const CONTROL_CHARS_REGEX = /[\t\n\r\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFE\uFFFF]/g;
  const HEX_PADDING_FOR_BYTE = "00";
  const HEX_PADDING_FOR_UNICODE = "0000";
  pattern = pattern.replace(CONTROL_CHARS_REGEX, (match) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const dec = match.codePointAt(0)!;
    const hex = dec.toString(16);
    const padding = dec <= 0xff ? HEX_PADDING_FOR_BYTE : HEX_PADDING_FOR_UNICODE;
    return `\\x${padding}${hex}`.slice(-2);
  });

  return `/${pattern}/`;
}

function buildZodNumberValidationChain(schema: SchemaObject): TsFunctionCall[] {
  const zodValidationMethods: TsFunctionCall[] = [];

  if (schema.type === "integer") {
    zodValidationMethods.push([Z.INT]);
  }

  if (schema.minimum !== undefined) {
    zodValidationMethods.push([schema.exclusiveMinimum ? Z.GT : Z.GTE, schema.minimum]);
  } else if (typeof schema.exclusiveMinimum === "number") {
    zodValidationMethods.push([Z.GT, schema.exclusiveMinimum]);
  }

  if (schema.maximum !== undefined) {
    zodValidationMethods.push([schema.exclusiveMaximum ? Z.LT : Z.LTE, schema.maximum]);
  } else if (typeof schema.exclusiveMaximum === "number") {
    zodValidationMethods.push([Z.LT, schema.exclusiveMaximum]);
  }

  if (schema.multipleOf !== undefined) {
    zodValidationMethods.push([Z.MULTIPLE_OF, schema.multipleOf]);
  }

  return zodValidationMethods;
}

function buildZodArrayValidationChain(schema: SchemaObject): TsFunctionCall[] {
  const zodValidationMethods: TsFunctionCall[] = [];

  if (schema.minItems !== undefined) {
    zodValidationMethods.push([Z.MIN, schema.minItems]);
  }

  if (schema.maxItems !== undefined) {
    zodValidationMethods.push([Z.MAX, schema.maxItems]);
  }

  return zodValidationMethods;
}
