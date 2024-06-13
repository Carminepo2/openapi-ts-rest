import type { Expression } from "typescript";

import { type ReferenceObject, type SchemaObject, isReferenceObject } from "openapi3-ts";
import { P, match } from "ts-pattern";

import type { Context } from "../context";

import { notImplementedError, unexpectedError } from "../domain/errors";
import {
  type TsFunctionCall,
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
    return buildZodSchemaFromOneOfSchemaObject(schema.oneOf, ctx);
  }

  if (schema.allOf) {
    return buildZodSchemaFromAllOfSchemaObject(schema.allOf, ctx);
  }

  if (schema.anyOf) {
    // TODO: Add support for `anyOf`
    throw notImplementedError({ detail: "anyOf is currently not supported" });
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
 * Put all the schemas contained in the `oneOf` property in a zoo `union` method call.
 * @example
 * ```ts
 * const schema = {
 *  oneOf: [
 *     { type: "string" },
 *     { type: "number" },
 *     { type: "boolean" },
 *   ]
 * }
 *
 * const result = buildZodSchemaFromOneOfSchemaObject(schema.oneOf);
 * console.log(astToString(result)); // Output: z.union(z.string(), z.number(), z.boolean())
 * ```
 */
function buildZodSchemaFromOneOfSchemaObject(
  oneOf: NonNullable<SchemaObject["oneOf"]>,
  ctx: Context
): Expression {
  if (oneOf.length === 1) {
    return schemaObjectToAstZodSchema(oneOf[0], ctx);
  }

  return tsChainedMethodCall("z", [
    "union",
    tsArray(...oneOf.map((schema) => schemaObjectToAstZodSchema(schema, ctx))),
  ]);
}

/**
 * Chain all the schemas contained in the `allOf` property with the zod `and` method.
 * @example
 * ```ts
 * const schema = {
 *   allOf: [
 *     { ref: "#/components/schemas/Schema1" },
 *     { ref: "#/components/schemas/Schema2" },
 *     { ref: "#/components/schemas/Schema3" },
 *     { type: "string" },
 *     { type: "boolean" },
 *   ]
 * }
 *
 * const result = buildZodSchemaFromAllOfSchemaObject(schema.allOf);
 * console.log(astToString(result)); // Output: Schema1.and(Schema2).and(Schema3).and(z.string()).and(z.boolean())
 * ```
 */
function buildZodSchemaFromAllOfSchemaObject(
  allOf: NonNullable<SchemaObject["allOf"]>,
  ctx: Context
): Expression {
  if (allOf.length === 1) {
    return schemaObjectToAstZodSchema(allOf[0], ctx);
  }

  const schemas = allOf.map((s) => schemaObjectToAstZodSchema(s, ctx));

  return tsChainedMethodCall(
    schemas[0], // Schema1
    ...schemas.map((s) => ["and", s] satisfies TsFunctionCall) // .and(Schema2).and(Schema3) ...
  );
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
