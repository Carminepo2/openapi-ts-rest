import type { Expression } from "typescript";

import { type ReferenceObject, type SchemaObject, isReferenceObject } from "openapi3-ts";
import { P, match } from "ts-pattern";

import type { Context } from "../context";

import { notImplementedError, unexpectedError } from "../domain/errors";
import {
  type TsLiteralOrExpression,
  tsArray,
  tsChainedMethodCall,
  tsIdentifier,
  tsObject,
} from "../lib/ts";
import {
  type SchemaObjectToZodValidatorsOptions,
  schemaObjectToZodValidators,
} from "./schemaObjectToZodValidators";

type ZodType =
  | "any"
  | "array"
  | "boolean"
  | "enum"
  | "instanceof"
  | "literal"
  | "never"
  | "null"
  | "number"
  | "object"
  | "record"
  | "string"
  | "union"
  | "unknown";

type ZodTypeMethodCall = [zodType: ZodType, ...args: TsLiteralOrExpression[]] | [zodType: ZodType];

/**
 * Converts a SchemaObject or ReferenceObject to a Zod schema AST expression.
 *
 * @param schemaOrRef The schema object or reference object to convert.
 * @param ctx The context object.
 * @param validatorOptions Some additional options to pass to the `schemaObjectToZodValidators` function.
 * @returns The AST expression for the Zod schema.
 *
 * @example
 * ```ts
 * const result = schemaObjectToAstZodSchema({
 *    type: "string",
 *    minLength: 2,
 * });
 * console.log(astToString(result)); // Output: z.string().min(2)
 * ```
 */
export function schemaObjectToAstZodSchema(
  schemaOrRef: ReferenceObject | SchemaObject,
  ctx: Context,
  validatorOptions?: SchemaObjectToZodValidatorsOptions
): Expression {
  /**
   * Builds the ast expression for a Zod schema.
   */
  function buildZodSchema(
    identifier: string,
    zodMethod?: ZodTypeMethodCall,
    customValidatorOptions = validatorOptions
  ): Expression {
    return tsChainedMethodCall(
      identifier,
      ...(zodMethod ? [zodMethod] : []),
      ...schemaObjectToZodValidators(schemaOrRef, customValidatorOptions)
    );
  }

  /**
   * If the schema is a reference object, we need to check if it's an "exported" schema.
   */
  if (isReferenceObject(schemaOrRef)) {
    const schemaToExport = ctx.exportedComponentSchemasMap.get(schemaOrRef.$ref);
    /**
     * If the schema is exported, we build the Zod schema from the identifier.
     */
    if (schemaToExport) {
      return buildZodSchema(schemaToExport.normalizedIdentifier, undefined);
    }
  }

  const schema = ctx.resolveObject(schemaOrRef);

  if (schema.oneOf) {
    if (schema.oneOf.length === 1) {
      return schemaObjectToAstZodSchema(schema.oneOf[0], ctx);
    }
    return buildZodSchema("z", [
      "union",
      tsArray(...schema.oneOf.map((s) => schemaObjectToAstZodSchema(s, ctx))),
    ]);
  }

  if (schema.oneOf || schema.anyOf || schema.allOf) {
    // TODO: Add support for `oneOf`, `anyOf` and `allOf`
    throw notImplementedError({ detail: "oneOf, anyOf and allOf are currently not supported" });
  }

  if (schema.enum) {
    function resolveEnumValue(value: unknown): string {
      if (value === null) return "null";
      return value as string;
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
      tsArray(
        ...schema.enum.map((value) => buildZodSchema("z", ["literal", resolveEnumValue(value)]))
      ),
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
      () => buildZodSchema("z", ["instanceof", tsIdentifier("File")])
    )
    .with("string", () => buildZodSchema("z", ["string"]))
    .with("number", "integer", () => buildZodSchema("z", ["number"]))
    .with("boolean", () => buildZodSchema("z", ["boolean"]))
    .with("null", () => buildZodSchema("z", ["null"]))
    .with("array", () => {
      if (!schema.items) return buildZodSchema("z", ["array", tsChainedMethodCall("z", ["any"])]);
      return buildZodSchema("z", ["array", schemaObjectToAstZodSchema(schema.items, ctx)]);
    })
    .when(
      (t) => Boolean(t === "object" || schema.properties),
      () => {
        if (!schema.properties || Object.keys(schema.properties).length === 0) {
          if (schema.additionalProperties === true) {
            return buildZodSchema("z", ["record", tsChainedMethodCall("z", ["any"])], {
              strict: true,
            });
          }

          if (typeof schema.additionalProperties === "object") {
            return buildZodSchema(
              "z",
              ["record", schemaObjectToAstZodSchema(schema.additionalProperties, ctx)],
              { strict: true }
            );
          }
        }
        return buildZodSchema("z", [
          "object",
          tsObject(...buildSchemaObjectProperties(schema, ctx)),
        ]);
      }
    )
    .with(P.nullish, () => buildZodSchema("z", ["unknown"]))
    .otherwise((t) => {
      throw unexpectedError({ detail: `Unsupported schema type ${t as unknown as string}` });
    });
}

/**
 * Builds the properties for the Zod object schema from the schema properties.
 */
function buildSchemaObjectProperties(
  schema: SchemaObject,
  ctx: Context
): Array<[string, TsLiteralOrExpression]> {
  if (!schema.properties) return [];

  return Object.entries(schema.properties).map(([key, refOrSchema]) => {
    const isRequired = Boolean(schema.required?.includes(key));
    return [key, schemaObjectToAstZodSchema(refOrSchema, ctx, { isRequired })];
  });
}
