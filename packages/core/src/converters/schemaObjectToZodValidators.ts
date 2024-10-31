import { type ReferenceObject, type SchemaObject, isReferenceObject } from "openapi3-ts";
import { P, match } from "ts-pattern";

import {
  type TsFunctionCall,
  type TsLiteralOrExpression,
  tsArray,
  tsObject,
  tsRegex,
} from "../lib/ts";
import { noop } from "../lib/utils";

type ZodValidatorMethod =
  | "datetime"
  | "default"
  | "email"
  | "gt"
  | "gte"
  | "instanceof"
  | "int"
  | "ip"
  | "lt"
  | "lte"
  | "max"
  | "min"
  | "multipleOf"
  | "nullable"
  | "nullish"
  | "optional"
  | "passthrough"
  | "regex"
  | "strict"
  | "url"
  | "uuid";

type ZodValidatorCall = { identifier: ZodValidatorMethod } & TsFunctionCall;

export interface SchemaObjectToZodValidatorsOptions {
  /**
   * Indicates if the schema is a required property of an object schema.
   */
  isRequired?: boolean;
  /**
   * Forces to not put the `passthrough` validator in the schema.
   */
  strict?: boolean;
}

/**
 * Given a schema object, returns an array of Zod validator methods with their arguments, if any.
 * A Zod validator method is a tuple where the first element is the method name and the rest are the arguments.
 * A given schema object can have multiple validators, so this function returns an array.
 *
 * @param schema The schema object to convert to Zod validators.
 * @param options In some cases, we need to know if the schema we are converting is a required property of an object schema or not, plus other infos.
 * @returns An array of Zod validator methods with their arguments.
 *
 * @example
 * ```ts
 * const result = schemaObjectToZodValidators({
 *  minLength: 2,
 *  type: "string",
 * });
 *
 * console.log(result); // Output: [["min", 2]] -> z.string()<.min(2)>
 * ```
 */
export function schemaObjectToZodValidators(
  schema: ReferenceObject | SchemaObject,
  options?: SchemaObjectToZodValidatorsOptions
): ZodValidatorCall[] {
  if (isReferenceObject(schema)) {
    return buildOptionalNullableValidators(schema, options);
  }

  const zodValidators = match(schema.type)
    .with("string", () => buildZodStringValidators(schema))
    .with("number", "integer", () => buildZodNumberValidators(schema))
    .with("array", () => buildZodArrayValidators(schema))
    .with("object", () => buildZodObjectValidators(schema, options))
    .otherwise(() => []);

  zodValidators.push(...buildOptionalNullableValidators(schema, options));
  zodValidators.push(...buildDefaultValidator(schema));

  return zodValidators;
}

function buildOptionalNullableValidators(
  schema: ReferenceObject | SchemaObject,
  options?: SchemaObjectToZodValidatorsOptions
): ZodValidatorCall[] {
  const zodValidators: ZodValidatorCall[] = [];

  if ("nullable" in schema && schema.nullable && !options?.isRequired)
    zodValidators.push({ identifier: "nullish" });
  else if ("nullable" in schema && schema.nullable) zodValidators.push({ identifier: "nullable" });
  else if (typeof options?.isRequired !== "undefined" && !options.isRequired)
    zodValidators.push({ identifier: "optional" });

  return zodValidators;
}

function buildDefaultValidator(schema: SchemaObject): ZodValidatorCall[] {
  const zodValidators: ZodValidatorCall[] = [];

  if (schema.default !== undefined) {
    const value = match(schema.type)
      .with("string", () => String(schema.default))
      .with("number", "integer", () => Number(schema.default))
      .with("boolean", () => Boolean(schema.default))
      .with("array", () => tsArray(...(schema.default as TsLiteralOrExpression[])))
      .with(P._, noop)
      .exhaustive();

    if (value !== undefined) zodValidators.push({ args: [value], identifier: "default" });
  }

  return zodValidators;
}

function buildZodStringValidators(schema: SchemaObject): ZodValidatorCall[] {
  const zodValidators: ZodValidatorCall[] = [];

  if (!schema.enum) {
    if (schema.minLength) {
      zodValidators.push({ args: [schema.minLength], identifier: "min" });
    }

    if (schema.maxLength) {
      zodValidators.push({ args: [schema.maxLength], identifier: "max" });
    }
  }

  if (schema.pattern) {
    zodValidators.push({
      args: [tsRegex(sanitizeAndFormatRegex(schema.pattern))],
      identifier: "regex",
    });
  }

  const format = match<typeof schema.format, ZodValidatorCall | undefined>(schema.format)
    .with("uuid", () => ({ identifier: "uuid" }))
    .with("hostname", "uri", () => ({ identifier: "url" }))
    .with("email", () => ({ identifier: "email" }))
    .with("date-time", () => ({ args: [tsObject(["offset", true])], identifier: "datetime" }))
    .with("ipv4", () => ({ args: [tsObject(["version", "v4"])], identifier: "ip" }))
    .with("ipv6", () => ({ args: [tsObject(["version", "v6"])], identifier: "ip" }))
    .otherwise(noop);

  if (format) {
    zodValidators.push(format);
  }

  return zodValidators;
}

function buildZodNumberValidators(schema: SchemaObject): ZodValidatorCall[] {
  const zodValidators: ZodValidatorCall[] = [];

  if (schema.enum) return zodValidators;

  if (schema.type === "integer") {
    zodValidators.push({ identifier: "int" });
  }

  if (schema.minimum !== undefined) {
    zodValidators.push({
      args: [schema.minimum],
      identifier: schema.exclusiveMinimum ? "gt" : "gte",
    });
  } else if (typeof schema.exclusiveMinimum === "number") {
    zodValidators.push({ args: [schema.exclusiveMinimum], identifier: "gt" });
  }

  if (schema.maximum !== undefined) {
    zodValidators.push({
      args: [schema.maximum],
      identifier: schema.exclusiveMaximum ? "lt" : "lte",
    });
  } else if (typeof schema.exclusiveMaximum === "number") {
    zodValidators.push({ args: [schema.exclusiveMaximum], identifier: "lt" });
  }

  if (schema.multipleOf !== undefined) {
    zodValidators.push({ args: [schema.multipleOf], identifier: "multipleOf" });
  }

  return zodValidators;
}

function buildZodArrayValidators(schema: SchemaObject): ZodValidatorCall[] {
  const zodValidators: ZodValidatorCall[] = [];

  if (schema.minItems !== undefined) {
    zodValidators.push({ args: [schema.minItems], identifier: "min" });
  }

  if (schema.maxItems !== undefined) {
    zodValidators.push({ args: [schema.maxItems], identifier: "max" });
  }

  return zodValidators;
}

function buildZodObjectValidators(
  schema: SchemaObject,
  options: SchemaObjectToZodValidatorsOptions | undefined
): ZodValidatorCall[] {
  const zodValidators: ZodValidatorCall[] = [];

  match(schema.additionalProperties)
    .with(false, noop)
    .when(() => options?.strict === true, noop)
    .otherwise(() => zodValidators.push({ identifier: "passthrough" }));

  return zodValidators;
}

function sanitizeAndFormatRegex(pattern: string): string {
  const result = (pattern.startsWith("/") && pattern.endsWith("/") ? pattern.slice(1, -1) : pattern)
    .replace(/\t/g, "\\t") // U+0009
    .replace(/\n/g, "\\n") // U+000A
    .replace(/\r/g, "\\r") // U+000D
    // eslint-disable-next-line no-control-regex
    .replace(/([\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFE\uFFFF])/g, (_m, p1) => {
      const dec: number = p1.codePointAt();
      const hex: string = dec.toString(16);
      if (dec <= 0xff) return `\\x${`00${hex}`.slice(-2)}`;
      return `\\u${`0000${hex}`.slice(-4)}`;
    })
    .replace(/\//g, "\\/");

  return `/${result}/`;
}
