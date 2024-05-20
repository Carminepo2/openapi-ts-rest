import { type SchemaObject } from "openapi3-ts/oas30";
import {
  tsArray,
  tsIdentifier,
  tsObject,
  tsPropertyCall,
  tsRegex,
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
  NULLISH: "nullish",
  NULLABLE: "nullable",
  OPTIONAL: "optional",
  REQUIRED: "required",
  DEFAULT: "default",

  INT: "int",
  GT: "gt",
  GTE: "gte",
  LT: "lt",
  LTE: "lte",
  MULTIPLE_OF: "multipleOf",
  INSTANCE_OF: "instanceof",
  UUID: "uuid",
  URL: "url",
  EMAIL: "email",
  DATETIME: "datetime",
  IP: "ip",
  MIN: "min",
  MAX: "max",
} as const;

interface ObjectPropertyCtx {
  isObjectProperty?: boolean;
  isRequiredObjectProperty?: boolean;
}

function buildZodSchema(firstCall: TsFunctionCall, ...chain: TsFunctionCall[]): Expression {
  return tsPropertyCall("z", firstCall, ...chain);
}

export function schemaObjectToAstZodSchema(
  schema: SchemaObject,
  ctx: Context,
  objectPropertyCtx?: ObjectPropertyCtx
): Expression {
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
        return buildZodSchema([Z.LITERAL, resolveEnumValue(schema.enum[0])]);
      }

      return buildZodSchema([Z.ENUM, tsArray(...schema.enum.map(resolveEnumValue))]);
    }

    if (schema.enum.some((e) => typeof e === "string")) {
      return buildZodSchema([Z.NEVER]);
    }

    if (schema.enum.length === 1) {
      return buildZodSchema([Z.LITERAL, schema.enum[0]]);
    }

    return buildZodSchema([
      Z.ENUM,
      tsArray(...schema.enum.map((value) => buildZodSchema([Z.LITERAL, resolveEnumValue(value)]))),
    ]);
  }

  return match(schema.type)
    .with(
      P.array(P.any),
      (t) => t.length === 1,
      (t) => schemaObjectToAstZodSchema({ ...schema, type: t[0] }, ctx)
    )
    .with(
      P.array(P.any),
      (t) => t.length > 1,
      (t) =>
        buildZodSchema([Z.UNION, tsArray(...t.map((type) => schemaObjectToAstZodSchema({ ...schema, type }, ctx)))])
    )
    .with(
      "string",
      () => schema.format === "binary",
      () => {
        return buildZodSchema([Z.INSTANCE_OF, tsIdentifier("File")]);
      }
    )
    .with("string", () => {
      return buildZodSchema([Z.STRING], ...buildZodValidationChain(schema, objectPropertyCtx));
    })
    .with("number", "integer", () => {
      return buildZodSchema([Z.NUMBER], ...buildZodValidationChain(schema, objectPropertyCtx));
    })
    .with("boolean", () => {
      return buildZodSchema([Z.BOOLEAN]);
    })
    .with("null", () => {
      return buildZodSchema([Z.NULL]);
    })
    .with("array", () => {
      return buildZodSchema(
        [
          Z.ARRAY,
          schema.items
            ? schemaObjectToAstZodSchema(ctx.resolveOpenAPIComponent(schema.items), ctx)
            : buildZodSchema([Z.ANY]),
        ],
        ...buildZodValidationChain(schema, objectPropertyCtx)
      );
    })
    .when(
      (t) => Boolean(t === "object" || schema.properties),
      () => {
        //TODO: Add support for `schema.additionalProperties`
        if (!schema.properties) return buildZodSchema([Z.OBJECT, tsObject()]);
        const properties: [string, TsLiteralOrExpression][] = Object.entries(schema.properties).map(
          ([key, schemaOrRef]) => {
            const propSchema = ctx.resolveOpenAPIComponent(schemaOrRef);
            const isRequiredObjectProperty = schema.required?.includes(key);
            return [
              key,
              // Pass the information about we are dealing with an object property and if it is required
              schemaObjectToAstZodSchema(propSchema, ctx, { isRequiredObjectProperty, isObjectProperty: true }),
            ];
          }
        );
        return buildZodSchema([Z.OBJECT, tsObject(...properties)]);
      }
    )
    .with(P.nullish, () => {
      return buildZodSchema([Z.UNKNOWN]);
    })
    .otherwise((t) => {
      throw new Error(`Unsupported schema type ${t as unknown as string}`);
    });
}

export function buildZodValidationChain(schema: SchemaObject, options?: ObjectPropertyCtx): TsFunctionCall[] {
  const validationChain = match(schema.type)
    .with("string", () => buildZodStringValidationChain(schema))
    .with("number", "integer", () => buildZodNumberValidationChain(schema))
    .with("array", () => buildZodArrayValidationChain(schema))
    .otherwise(() => []);

  // Are we dealing with an object property that is required?
  const isRequiredObjectProperty = options?.isObjectProperty && !options.isRequiredObjectProperty;

  if (schema.nullable && !options?.isObjectProperty) validationChain.push([Z.NULLISH]);
  else if (schema.nullable && isRequiredObjectProperty) validationChain.push([Z.NULLABLE]);
  else if (isRequiredObjectProperty) validationChain.push([Z.OPTIONAL]);

  if (schema.default !== undefined) {
    const value = match(schema.type)
      .with("number", "integer", () => Number(schema.default))
      .when(
        () => typeof schema.default === "string",
        () => schema.default as string
      )
      .otherwise(() => JSON.stringify(schema.default));
    validationChain.push([Z.DEFAULT, value]);
  }

  return validationChain;
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
    zodValidationMethods.push([Z.REGEX, tsRegex(sanitizeAndFormatRegex(schema.pattern))]);
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
