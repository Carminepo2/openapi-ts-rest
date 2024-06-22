import type { Expression } from "typescript";

import { type ReferenceObject, type SchemaObject, isReferenceObject } from "openapi3-ts";
import { P, match } from "ts-pattern";

import type { Context } from "../context/createContext";

import { unexpectedError } from "../domain/errors";
import {
  type TsFunctionCall,
  type TsLiteralOrExpression,
  tsArray,
  tsChainedMethodCall,
  tsIdentifier,
  tsObject,
} from "../lib/ts";
import { generatePowerset } from "../lib/utils";
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
 * Builds the ast expression for a Zod schema.
 */
function buildZodSchema(
  identifier: Expression | string,
  zodMethod?: ZodTypeMethodCall,
  ...chainedMethods: TsFunctionCall[]
): Expression {
  return tsChainedMethodCall(identifier, ...(zodMethod ? [zodMethod] : []), ...chainedMethods);
}

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
  function buildZodSchemaWithValidators(
    identifier: string,
    zodMethod?: ZodTypeMethodCall,
    customValidatorOptions = validatorOptions
  ): Expression {
    return buildZodSchema(
      identifier,
      zodMethod,
      ...schemaObjectToZodValidators(schemaOrRef, customValidatorOptions)
    );
  }

  if (isReferenceObject(schemaOrRef)) {
    const exportedSchema = ctx.componentSchemasMap.get(schemaOrRef.$ref);
    /**
     * If the schema is exported, we build the Zod schema from the identifier.
     */
    if (exportedSchema) {
      return buildZodSchemaWithValidators(exportedSchema.normalizedIdentifier);
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
    return buildZodSchemaFromAnyOfSchemaObject(schema.anyOf, ctx);
  }

  if (schema.enum) {
    return buildZodSchemaFromEnumSchemaObject(schema, buildZodSchemaWithValidators);
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
        buildZodSchemaWithValidators("z", [
          "union",
          tsArray(...t.map((type) => schemaObjectToAstZodSchema({ ...schema, type }, ctx))),
        ])
    )
    .with(
      "string",
      () => schema.format === "binary",
      () => buildZodSchemaWithValidators("z", ["instanceof", tsIdentifier("File")])
    )
    .with("string", () => buildZodSchemaWithValidators("z", ["string"]))
    .with("number", "integer", () => buildZodSchemaWithValidators("z", ["number"]))
    .with("boolean", () => buildZodSchemaWithValidators("z", ["boolean"]))
    .with("null", () => buildZodSchemaWithValidators("z", ["null"]))
    .with("array", () => {
      if (!schema.items)
        return buildZodSchemaWithValidators("z", ["array", buildZodSchema("z", ["any"])]);
      return buildZodSchemaWithValidators("z", [
        "array",
        schemaObjectToAstZodSchema(schema.items, ctx),
      ]);
    })
    .when(
      (t) => Boolean(t === "object" || schema.properties),
      () => {
        if (!schema.properties || Object.keys(schema.properties).length === 0) {
          if (schema.additionalProperties === true) {
            return buildZodSchemaWithValidators("z", ["record", buildZodSchema("z", ["any"])], {
              strict: true,
            });
          }

          if (typeof schema.additionalProperties === "object") {
            return buildZodSchemaWithValidators(
              "z",
              ["record", schemaObjectToAstZodSchema(schema.additionalProperties, ctx)],
              { strict: true }
            );
          }
        }
        return buildZodSchemaWithValidators("z", [
          "object",
          tsObject(...buildSchemaObjectProperties(schema, ctx)),
        ]);
      }
    )
    .with(P.nullish, () => buildZodSchemaWithValidators("z", ["unknown"]))
    .otherwise((t) => {
      throw unexpectedError({ detail: `Unsupported schema type ${t as unknown as string}` });
    });
}

function buildZodSchemaFromEnumSchemaObject(
  schema: SchemaObject,
  buildZodSchemaWithValidators: (
    identifier: string,
    zodMethod?: ZodTypeMethodCall,
    customValidatorOptions?: SchemaObjectToZodValidatorsOptions | undefined
  ) => Expression
): Expression {
  if (!schema.enum) {
    throw unexpectedError({ detail: "The schema does not have an enum property" });
  }

  function resolveEnumValue(value: unknown): string {
    if (value === null) return "null";
    return value as string;
  }

  if (schema.type === "string") {
    if (schema.enum.length === 1) {
      return buildZodSchemaWithValidators("z", ["literal", resolveEnumValue(schema.enum[0])]);
    }

    return buildZodSchemaWithValidators("z", [
      "enum",
      tsArray(...schema.enum.map(resolveEnumValue)),
    ]);
  }

  if (schema.enum.some((e) => typeof e === "string")) {
    return buildZodSchemaWithValidators("z", ["never"]);
  }

  if (schema.enum.length === 1) {
    return buildZodSchemaWithValidators("z", ["literal", schema.enum[0]]);
  }

  return buildZodSchemaWithValidators("z", [
    "enum",
    tsArray(
      ...schema.enum.map((value) =>
        buildZodSchemaWithValidators("z", ["literal", resolveEnumValue(value)])
      )
    ),
  ]);
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

  return buildZodSchema("z", [
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

  return buildZodSchema(
    schemas[0], // Schema1
    undefined,
    ...schemas.slice(1).map((s) => ["and", s] satisfies TsFunctionCall) // .and(Schema2).and(Schema3) ...
  );
}

/**
 * Creates a zod union of all possible combinations (powerset) of the schemas contained in the `anyOf` property.
 * @example
 * ```ts
 * const schema = {
 *   anyOf: [
 *     { ref: "#/components/schemas/Schema1" },
 *     { ref: "#/components/schemas/Schema2" },
 *   ]
 * }
 *
 * const result = buildZodSchemaFromAnyOfSchemaObject(schema.anyOf);
 * console.log(astToString(result)); // Output: z.union(Schema1.merge(Schema2), Schema2, Schema1)
 * ```
 *
 * @see {@link generatePowerset}
 * @see {@link https://stackblitz.com/edit/typescript-bcarya}
 */
function buildZodSchemaFromAnyOfSchemaObject(
  anyOf: NonNullable<SchemaObject["anyOf"]>,
  ctx: Context
): Expression {
  if (anyOf.length === 1) {
    return schemaObjectToAstZodSchema(anyOf[0], ctx);
  }

  const schemas = anyOf.map((s) => schemaObjectToAstZodSchema(s, ctx));
  // drop empty set, sort largest to smallest
  const schemasPowerSet = generatePowerset(schemas).slice(1).reverse();
  const subsets = schemasPowerSet.map((set) => {
    if (set.length === 1) return set[0];
    return buildZodSchema(
      set[0], // Schema1
      undefined,
      ...set.slice(1).map((s) => ["merge", s] satisfies TsFunctionCall) // .merge(Schema2).merge(Schema3) ...
    );
  });

  return buildZodSchema("z", ["union", tsArray(...subsets)]);
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
