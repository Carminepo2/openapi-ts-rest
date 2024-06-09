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

export function schemaObjectToAstZodSchema(
  schemaOrRef: ReferenceObject | SchemaObject,
  ctx: Context,
  validatorOptions?: SchemaObjectToZodValidatorsOptions
): Expression {
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

  if (isReferenceObject(schemaOrRef)) {
    const schemaToExport = ctx.exportedComponentSchemasMap.get(schemaOrRef.$ref);
    if (schemaToExport) {
      return buildZodSchema(schemaToExport.normalizedIdentifier, undefined);
    }
  }

  const schema = ctx.resolveObject(schemaOrRef);

  if (schema.oneOf || schema.anyOf || schema.allOf) {
    // TODO: Add support for `oneOf`, `anyOf` and `allOf`
    throw notImplementedError({ detail: "oneOf, anyOf and allOf are currently not supported" });
  }

  function buildSchemaObjectProperties(
    properties: SchemaObject["properties"]
  ): Array<[string, TsLiteralOrExpression]> {
    if (!properties) return [];

    return Object.entries(properties).map(([key, refOrSchema]) => {
      const isRequired = Boolean(schema.required?.includes(key));
      return [key, schemaObjectToAstZodSchema(refOrSchema, ctx, { isRequired })];
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
          tsObject(...buildSchemaObjectProperties(schema.properties)),
        ]);
      }
    )
    .with(P.nullish, () => buildZodSchema("z", ["unknown"]))
    .otherwise((t) => {
      throw unexpectedError({ detail: `Unsupported schema type ${t as unknown as string}` });
    });
}
