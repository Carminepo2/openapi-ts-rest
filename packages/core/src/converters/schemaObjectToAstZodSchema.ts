import type { Expression } from "typescript";

import { type SchemaObject, isReferenceObject } from "openapi3-ts/oas30";
import { P, match } from "ts-pattern";

import type { Context } from "../context";

import {
  type TsLiteralOrExpression,
  tsArray,
  tsChainedMethodCall,
  tsIdentifier,
  tsObject,
} from "../lib/ts";
import { schemaObjectToZodValidationChain } from "./schemaObjectToZodValidationChain";

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
  | "string"
  | "union"
  | "unknown";

type ZodTypeMethodCall = [zodType: ZodType, ...args: TsLiteralOrExpression[]] | [zodType: ZodType];

export interface SchemaObjectToAstZosSchemaOptions {
  isRequired?: boolean;
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

  function buildZodSchema(
    identifier = "z",
    zodMethod?: ZodTypeMethodCall,
    customOptions = options
  ): Expression {
    return tsChainedMethodCall(
      identifier,
      ...(zodMethod ? [zodMethod] : []),
      ...schemaObjectToZodValidationChain(schema, customOptions)
    );
  }

  function buildSchemaObjectProperties(
    properties: SchemaObject["properties"]
  ): Array<[string, TsLiteralOrExpression]> {
    if (!properties) return [];

    return Object.entries(properties).map(([key, refOrSchema]) => {
      const isRequired = Boolean(schema.required?.includes(key));

      if (isReferenceObject(refOrSchema)) {
        const schemaToExport = ctx.exportedComponentSchemasMap.get(refOrSchema.$ref);
        if (schemaToExport) {
          return [
            key,
            buildZodSchema(schemaToExport.normalizedIdentifier, undefined, { isRequired }),
          ];
        }
      }

      const schemaObject = ctx.resolveObject(refOrSchema);

      return [key, schemaObjectToAstZodSchema(schemaObject, ctx, { isRequired })];
    });
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
      if (!schema.items) return buildZodSchema("z", ["array", buildZodSchema("z", ["any"])]);

      if (isReferenceObject(schema.items)) {
        const schemaToExport = ctx.exportedComponentSchemasMap.get(schema.items.$ref);
        if (schemaToExport) {
          return buildZodSchema("z", ["array", tsIdentifier(schemaToExport.normalizedIdentifier)]);
        }
      }

      const schemaObject = ctx.resolveObject(schema.items);

      return buildZodSchema("z", ["array", schemaObjectToAstZodSchema(schemaObject, ctx)]);
    })
    .when(
      (t) => Boolean(t === "object" || schema.properties),
      () =>
        // TODO: Add support for `schema.additionalProperties`
        buildZodSchema("z", ["object", tsObject(...buildSchemaObjectProperties(schema.properties))])
    )
    .with(P.nullish, () => buildZodSchema("z", ["unknown"]))
    .otherwise((t) => {
      throw new Error(`Unsupported schema type ${t as unknown as string}`);
    });
}
