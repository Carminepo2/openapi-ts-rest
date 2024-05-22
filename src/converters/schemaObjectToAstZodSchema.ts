import { isReferenceObject, type SchemaObject } from "openapi3-ts/oas30";
import { tsArray, tsIdentifier, tsObject, tsChainedMethodCall, tsRegex, type TsLiteralOrExpression } from "../lib/ts";
import { match, P } from "ts-pattern";
import type { Context } from "../context";
import { noop } from "../lib/utils";
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

interface SchemaObjectToAstZosSchemaOptions {
  isRequired?: boolean;
  isObjectProperty?: boolean;
}

export function schemaObjectToAstZodSchema(
  schema: SchemaObject,
  ctx: Context,
  options?: SchemaObjectToAstZosSchemaOptions
): Expression {
  if (schema.oneOf || schema.anyOf || schema.allOf) {
    // TODO: Add support for `oneOf`, `anyOf` and `allOf`
    throw new Error("oneOf, anyOf and allOf are currently not supported");
  }

  function buildZodSchema(identifier = "z", zodMethod?: ZodTypeMethodCall, customOptions = options): Expression {
    return tsChainedMethodCall(
      identifier,
      ...(zodMethod ? [zodMethod] : []),
      ...buildZodValidationChain(schema, customOptions)
    );
  }

  function buildSchemaObjectProperties(properties: SchemaObject["properties"]): [string, TsLiteralOrExpression][] {
    if (!properties) return [];

    return Object.entries(properties).map(([key, refOrSchema]) => {
      const isRequired = schema.required?.includes(key);
      const options: SchemaObjectToAstZosSchemaOptions = { isRequired, isObjectProperty: true };

      if (isReferenceObject(refOrSchema)) {
        const schemaToExport = ctx.schemasToExportMap.get(refOrSchema.$ref);
        if (schemaToExport) {
          return [key, buildZodSchema(schemaToExport.normalizedIdentifier, undefined, options)];
        }
      }

      const schemaObject = ctx.resolveSchemaObject(refOrSchema);

      return [key, schemaObjectToAstZodSchema(schemaObject, ctx, options)];
    });
  }

  if (schema.enum) {
    function resolveEnumValue(value: unknown): string {
      if (value === null) return "null";
      return `"${value as string}"`;
    }

    if (schema.type === "string") {
      if (schema.enum.length === 1) {
        return buildZodSchema("z", ["literal", resolveEnumValue(schema.enum[0])]);
      }

      return buildZodSchema("z", ["enum", tsArray(...schema.enum.map(resolveEnumValue))]);
    }

    if (schema.enum.some((e) => typeof e === "string")) {
      return buildZodSchema("z", ["never"]);
    }

    if (schema.enum.length === 1) {
      return buildZodSchema("z", ["literal", schema.enum[0]]);
    }

    return buildZodSchema("z", [
      "enum",
      tsArray(...schema.enum.map((value) => buildZodSchema("z", ["literal", resolveEnumValue(value)]))),
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
        buildZodSchema("z", [
          "union",
          tsArray(...t.map((type) => schemaObjectToAstZodSchema({ ...schema, type }, ctx))),
        ])
    )
    .with(
      "string",
      () => schema.format === "binary",
      () => {
        return buildZodSchema("z", ["instanceof", tsIdentifier("File")]);
      }
    )
    .with("string", () => {
      return buildZodSchema("z", ["string"]);
    })
    .with("number", "integer", () => {
      return buildZodSchema("z", ["number"]);
    })
    .with("boolean", () => {
      return buildZodSchema("z", ["boolean"]);
    })
    .with("null", () => {
      return buildZodSchema("z", ["null"]);
    })
    .with("array", () => {
      if (!schema.items) return buildZodSchema("z", ["array", buildZodSchema("z", ["any"])]);

      if (isReferenceObject(schema.items)) {
        const schemaToExport = ctx.schemasToExportMap.get(schema.items.$ref);
        if (schemaToExport) {
          return buildZodSchema("z", ["array", tsIdentifier(schemaToExport.normalizedIdentifier)]);
        }
      }

      const schemaObject = ctx.resolveSchemaObject(schema.items);

      return buildZodSchema("z", ["array", schemaObjectToAstZodSchema(schemaObject, ctx)]);
    })
    .when(
      (t) => Boolean(t === "object" || schema.properties),
      () => {
        //TODO: Add support for `schema.additionalProperties`
        return buildZodSchema("z", ["object", tsObject(...buildSchemaObjectProperties(schema.properties))]);
      }
    )
    .with(P.nullish, () => {
      return buildZodSchema("z", ["unknown"]);
    })
    .otherwise((t) => {
      throw new Error(`Unsupported schema type ${t as unknown as string}`);
    });
}

export function buildZodValidationChain(
  schema: SchemaObject,
  options?: SchemaObjectToAstZosSchemaOptions
): ZodValidationMethodCall[] {
  const validationChain = match(schema.type)
    .with("string", () => buildZodStringValidationChain(schema))
    .with("number", "integer", () => buildZodNumberValidationChain(schema))
    .with("array", () => buildZodArrayValidationChain(schema))
    .otherwise(() => []);

  // Are we dealing with an object property that is required?
  const isOptionalObjectProperty = options?.isObjectProperty && !options.isRequired;

  if (schema.nullable && !options?.isObjectProperty) validationChain.push(["nullish"]);
  else if (schema.nullable && isOptionalObjectProperty) validationChain.push(["nullable"]);
  else if (isOptionalObjectProperty) validationChain.push(["optional"]);

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
