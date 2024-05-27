import type { SchemaObject } from "openapi3-ts/oas30";
import { match } from "ts-pattern";
import { tsArray, tsObject, tsRegex, type TsLiteralOrExpression } from "../lib/ts";
import { noop } from "../lib/utils";
import type { SchemaObjectToAstZosSchemaOptions } from "./schemaObjectToAstZodSchema";

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

type ZodValidationMethodCall = [
  zodValidationMethod: ZodValidationMethod,
  ...args: TsLiteralOrExpression[],
];

export function schemaObjectToZodValidationChain(
  schema: SchemaObject,
  options?: SchemaObjectToAstZosSchemaOptions
): ZodValidationMethodCall[] {
  const validationChain = match(schema.type)
    .with("string", () => buildZodStringValidationChain(schema))
    .with("number", "integer", () => buildZodNumberValidationChain(schema))
    .with("array", () => buildZodArrayValidationChain(schema))
    .otherwise(() => []);

  if (schema.nullable && !options?.isRequired) validationChain.push(["nullish"]);
  else if (schema.nullable) validationChain.push(["nullable"]);
  else if (typeof options?.isRequired !== "undefined" && !options.isRequired)
    validationChain.push(["optional"]);

  if (schema.default !== undefined) {
    const value = match(schema.type)
      .with("number", "integer", () => Number(schema.default))
      .with("boolean", () => Boolean(schema.default))
      .when(
        () => typeof schema.default === "string",
        () => schema.default as string
      )
      .with("array", () => tsArray(...(schema.default as TsLiteralOrExpression[])))
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
  const CONTROL_CHARS_REGEX =
    // eslint-disable-next-line no-control-regex
    /[\t\n\r\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFE\uFFFF]/g;
  const HEX_PADDING_FOR_BYTE = "00";
  const HEX_PADDING_FOR_UNICODE = "0000";

  const sanitizedPattern =
    pattern.startsWith("/") && pattern.endsWith("/") ? pattern.slice(1, -1) : pattern;

  const formattedPattern = sanitizedPattern.replace(CONTROL_CHARS_REGEX, (match) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const dec = match.codePointAt(0)!;
    const hex = dec.toString(16);
    const padding = dec <= 0xff ? HEX_PADDING_FOR_BYTE : HEX_PADDING_FOR_UNICODE;
    return `\\x${padding}${hex}`.slice(-2);
  });

  return `/${formattedPattern}/`;
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
