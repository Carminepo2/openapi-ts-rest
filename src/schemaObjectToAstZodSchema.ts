import { type SchemaObject } from "openapi3-ts/oas30";
import { tsArray, tsIdentifier, tsObject, tsChainedMethodCall, tsRegex, type TsLiteralOrExpression } from "./lib/ts";
import { match, P } from "ts-pattern";
import type { Context } from "./context";
import { noop } from "./lib/utils";
import type { Expression } from "typescript";

type ZodType =
  | "number"
  | "string"
  | "boolean"
  | "null"
  | "array"
  | "object"
  | "literal"
  | "enum"
  | "never"
  | "any"
  | "union"
  | "instanceof"
  | "unknown";

type ZodValidationMethod =
  | "int"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "multipleOf"
  | "instanceof"
  | "uuid"
  | "url"
  | "email"
  | "datetime"
  | "ip"
  | "min"
  | "max"
  | "regex"
  | "nullish"
  | "nullable"
  | "optional"
  | "default";

type ZodTypeMethodCall = [zodType: ZodType] | [zodType: ZodType, ...args: TsLiteralOrExpression[]];
type ZodValidationMethodCall = [zodValidationMethod: ZodValidationMethod, ...args: TsLiteralOrExpression[]];

interface ObjectPropertyCtx {
  isObjectProperty?: boolean;
  isRequiredObjectProperty?: boolean;
}

export function schemaObjectToAstZodSchema(
  schema: SchemaObject,
  ctx: Context,
  objectPropertyCtx?: ObjectPropertyCtx
): Expression {
  if (schema.oneOf || schema.anyOf || schema.allOf) {
    throw new Error("oneOf, anyOf and allOf are currently not supported");
  }

  function buildZodSchema(zodMethod: ZodTypeMethodCall): Expression {
    return tsChainedMethodCall("z", zodMethod, ...buildZodValidationChain(schema, objectPropertyCtx));
  }

  if (schema.enum) {
    function resolveEnumValue(value: unknown): string {
      if (value === null) return "null";
      return `"${value as string}"`;
    }

    if (schema.type === "string") {
      if (schema.enum.length === 1) {
        return buildZodSchema(["literal", resolveEnumValue(schema.enum[0])]);
      }

      return buildZodSchema(["enum", tsArray(...schema.enum.map(resolveEnumValue))]);
    }

    if (schema.enum.some((e) => typeof e === "string")) {
      return buildZodSchema(["never"]);
    }

    if (schema.enum.length === 1) {
      return buildZodSchema(["literal", schema.enum[0]]);
    }

    return buildZodSchema([
      "enum",
      tsArray(...schema.enum.map((value) => buildZodSchema(["literal", resolveEnumValue(value)]))),
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
        buildZodSchema(["union", tsArray(...t.map((type) => schemaObjectToAstZodSchema({ ...schema, type }, ctx)))])
    )
    .with(
      "string",
      () => schema.format === "binary",
      () => {
        return buildZodSchema(["instanceof", tsIdentifier("File")]);
      }
    )
    .with("string", () => {
      return buildZodSchema(["string"]);
    })
    .with("number", "integer", () => {
      return buildZodSchema(["number"]);
    })
    .with("boolean", () => {
      return buildZodSchema(["boolean"]);
    })
    .with("null", () => {
      return buildZodSchema(["null"]);
    })
    .with("array", () => {
      return buildZodSchema([
        "array",
        schema.items
          ? schemaObjectToAstZodSchema(ctx.resolveOpenAPIComponent(schema.items), ctx)
          : buildZodSchema(["any"]),
      ]);
    })
    .when(
      (t) => Boolean(t === "object" || schema.properties),
      () => {
        //TODO: Add support for `schema.additionalProperties`
        if (!schema.properties) return buildZodSchema(["object", tsObject()]);
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
        return buildZodSchema(["object", tsObject(...properties)]);
      }
    )
    .with(P.nullish, () => {
      return buildZodSchema(["unknown"]);
    })
    .otherwise((t) => {
      throw new Error(`Unsupported schema type ${t as unknown as string}`);
    });
}

export function buildZodValidationChain(schema: SchemaObject, options?: ObjectPropertyCtx): ZodValidationMethodCall[] {
  const validationChain = match(schema.type)
    .with("string", () => buildZodStringValidationChain(schema))
    .with("number", "integer", () => buildZodNumberValidationChain(schema))
    .with("array", () => buildZodArrayValidationChain(schema))
    .otherwise(() => []);

  // Are we dealing with an object property that is required?
  const isRequiredObjectProperty = options?.isObjectProperty && !options.isRequiredObjectProperty;

  if (schema.nullable && !options?.isObjectProperty) validationChain.push(["nullish"]);
  else if (schema.nullable && isRequiredObjectProperty) validationChain.push(["nullable"]);
  else if (isRequiredObjectProperty) validationChain.push(["optional"]);

  if (schema.default !== undefined) {
    const value = match(schema.type)
      .with("number", "integer", () => Number(schema.default))
      .when(
        () => typeof schema.default === "string",
        () => schema.default as string
      )
      .otherwise(() => JSON.stringify(schema.default));
    validationChain.push(["default", value]);
  }

  return validationChain;
}

function buildZodStringValidationChain(schema: SchemaObject): ZodValidationMethodCall[] {
  const zodValidationMethods: ZodValidationMethodCall[] = [];

  if (!schema.enum) {
    if (schema.minLength) {
      zodValidationMethods.push(["min", schema.minLength]);
    }

    if (schema.maxLength) {
      zodValidationMethods.push(["max", schema.maxLength]);
    }
  }

  if (schema.pattern) {
    zodValidationMethods.push(["regex", tsRegex(sanitizeAndFormatRegex(schema.pattern))]);
  }

  const format = match<typeof schema.format, ZodValidationMethodCall | undefined>(schema.format)
    .with("uuid", () => ["uuid"])
    .with("hostname", "uri", () => ["url"])
    .with("email", () => ["email"])
    .with("date-time", () => ["datetime", tsObject(["offset", true])])
    .with("ipv4", () => ["ip", tsObject(["version", "v4"])])
    .with("ipv6", () => ["ip", tsObject(["version", "v6"])])
    .otherwise(noop);

  if (format) {
    zodValidationMethods.push(format);
  }

  return zodValidationMethods;
}

function sanitizeAndFormatRegex(pattern: string): string {
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

function buildZodNumberValidationChain(schema: SchemaObject): ZodValidationMethodCall[] {
  const zodValidationMethods: ZodValidationMethodCall[] = [];

  if (schema.enum) return zodValidationMethods;

  if (schema.type === "integer") {
    zodValidationMethods.push(["int"]);
  }

  if (schema.minimum !== undefined) {
    zodValidationMethods.push([schema.exclusiveMinimum ? "gt" : "gte", schema.minimum]);
  } else if (typeof schema.exclusiveMinimum === "number") {
    zodValidationMethods.push(["gt", schema.exclusiveMinimum]);
  }

  if (schema.maximum !== undefined) {
    zodValidationMethods.push([schema.exclusiveMaximum ? "lt" : "lte", schema.maximum]);
  } else if (typeof schema.exclusiveMaximum === "number") {
    zodValidationMethods.push(["lt", schema.exclusiveMaximum]);
  }

  if (schema.multipleOf !== undefined) {
    zodValidationMethods.push(["multipleOf", schema.multipleOf]);
  }

  return zodValidationMethods;
}

function buildZodArrayValidationChain(schema: SchemaObject): ZodValidationMethodCall[] {
  const zodValidationMethods: ZodValidationMethodCall[] = [];

  if (schema.minItems !== undefined) {
    zodValidationMethods.push(["min", schema.minItems]);
  }

  if (schema.maxItems !== undefined) {
    zodValidationMethods.push(["max", schema.maxItems]);
  }

  return zodValidationMethods;
}
