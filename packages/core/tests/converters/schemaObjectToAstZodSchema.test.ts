/* eslint-disable sonarjs/no-duplicate-string */
import type { SchemaObject } from "openapi3-ts";

import { describe, expect, test } from "vitest";

import { schemaObjectToAstZodSchema } from "../../src/converters/schemaObjectToAstZodSchema";
import { notImplementedError } from "../../src/domain/errors";
import { astToString } from "../../src/lib/utils";
import { createMockContext } from "../test.utils";

const mockCtx = createMockContext();

const wrappedSchemaObjectToAstZodSchema = (schema: SchemaObject, ctx = mockCtx): string =>
  astToString(schemaObjectToAstZodSchema(schema, ctx)).trim();

describe("schemaObjectToAstZodSchema", () => {
  test("snapshot testing schema", () => {
    expect(wrappedSchemaObjectToAstZodSchema({ type: undefined })).toMatchInlineSnapshot(
      `"z.unknown()"`
    );
  });

  it("should throw an error if given unsupported schema type", () => {
    expect(() =>
      // @ts-expect-error @typescript-eslint/ban-ts-comment
      wrappedSchemaObjectToAstZodSchema({ type: "unsupported" })
    ).toThrowError(notImplementedError({ detail: "Unsupported schema type unsupported" }));
  });

  test("snapshot testing schema type string", () => {
    expect(wrappedSchemaObjectToAstZodSchema({ type: "string" })).toMatchInlineSnapshot(
      `"z.string()"`
    );
    expect(
      wrappedSchemaObjectToAstZodSchema({ nullable: true, type: "string" })
    ).toMatchInlineSnapshot(`"z.string().nullish()"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ minLength: 5, type: "string" })
    ).toMatchInlineSnapshot(`"z.string().min(5)"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ maxLength: 5, type: "string" })
    ).toMatchInlineSnapshot(`"z.string().max(5)"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ maxLength: 10, minLength: 5, type: "string" })
    ).toMatchInlineSnapshot(`"z.string().min(5).max(10)"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ pattern: ".*", type: "string" })
    ).toMatchInlineSnapshot(`"z.string().regex(/.*/)"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ format: "binary", type: "string" })
    ).toMatchInlineSnapshot(`"z.instanceof(File)"`);
  });

  test("snapshot testing schema type number", () => {
    expect(wrappedSchemaObjectToAstZodSchema({ type: "number" })).toMatchInlineSnapshot(
      `"z.number()"`
    );
    expect(
      wrappedSchemaObjectToAstZodSchema({ nullable: true, type: "number" })
    ).toMatchInlineSnapshot(`"z.number().nullish()"`);
    expect(wrappedSchemaObjectToAstZodSchema({ minimum: 5, type: "number" })).toMatchInlineSnapshot(
      `"z.number().gte(5)"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ maximum: 5, type: "number" })).toMatchInlineSnapshot(
      `"z.number().lte(5)"`
    );
    expect(
      wrappedSchemaObjectToAstZodSchema({ maximum: 10, minimum: 5, type: "number" })
    ).toMatchInlineSnapshot(`"z.number().gte(5).lte(10)"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ multipleOf: 5, type: "number" })
    ).toMatchInlineSnapshot(`"z.number().multipleOf(5)"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ exclusiveMinimum: true, minimum: 5, type: "number" })
    ).toMatchInlineSnapshot(`"z.number().gt(5)"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ exclusiveMaximum: true, maximum: 5, type: "number" })
    ).toMatchInlineSnapshot(`"z.number().lt(5)"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        exclusiveMaximum: true,
        exclusiveMinimum: true,
        maximum: 5,
        minimum: 5,
        type: "number",
      })
    ).toMatchInlineSnapshot(`"z.number().gt(5).lt(5)"`);
  });

  test("snapshot testing schema type boolean and null", () => {
    expect(wrappedSchemaObjectToAstZodSchema({ type: "boolean" })).toMatchInlineSnapshot(
      `"z.boolean()"`
    );
    expect(
      wrappedSchemaObjectToAstZodSchema({ default: false, type: "boolean" })
    ).toMatchInlineSnapshot(`"z.boolean().default(false)"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ default: true, type: "boolean" })
    ).toMatchInlineSnapshot(`"z.boolean().default(true)"`);
    expect(wrappedSchemaObjectToAstZodSchema({ type: "null" })).toMatchInlineSnapshot(`"z.null()"`);
  });

  test("snapshot testing schema type array", () => {
    expect(
      wrappedSchemaObjectToAstZodSchema({ items: { type: "string" }, type: "array" })
    ).toMatchInlineSnapshot(`"z.array(z.string())"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ items: { type: "number" }, type: "array" })
    ).toMatchInlineSnapshot(`"z.array(z.number())"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ items: { type: "boolean" }, type: "array" })
    ).toMatchInlineSnapshot(`"z.array(z.boolean())"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ items: { type: "null" }, type: "array" })
    ).toMatchInlineSnapshot(`"z.array(z.null())"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        items: { items: { type: "string" }, type: "array" },
        type: "array",
      })
    ).toMatchInlineSnapshot(`"z.array(z.array(z.string()))"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        items: { items: { type: "number" }, minItems: 5, type: "array" },
        type: "array",
      })
    ).toMatchInlineSnapshot(`"z.array(z.array(z.number()).min(5))"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        items: { items: { type: "number" }, maxItems: 5, type: "array" },
        type: "array",
      })
    ).toMatchInlineSnapshot(`"z.array(z.array(z.number()).max(5))"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        items: { items: { type: "number" }, maxItems: 10, minItems: 5, type: "array" },
        type: "array",
      })
    ).toMatchInlineSnapshot(`"z.array(z.array(z.number()).min(5).max(10))"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        items: { default: [], items: { type: "number" }, maxItems: 10, minItems: 5, type: "array" },
        type: "array",
      })
    ).toMatchInlineSnapshot(`"z.array(z.array(z.number()).min(5).max(10).default([]))"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        items: {
          default: [1, 2, 3],
          items: { type: "number" },
          maxItems: 10,
          minItems: 5,
          type: "array",
        },
        type: "array",
      })
    ).toMatchInlineSnapshot(`"z.array(z.array(z.number()).min(5).max(10).default([1, 2, 3]))"`);

    const ctx = createMockContext({
      components: {
        schemas: {
          RefSchema: { type: "string" },
        },
      },
    });

    expect(
      wrappedSchemaObjectToAstZodSchema(
        {
          items: { $ref: "#/components/schemas/RefSchema" },
          type: "array",
        },
        ctx
      )
    ).toMatchInlineSnapshot(`"z.array(RefSchema)"`);
    expect(
      wrappedSchemaObjectToAstZodSchema(
        {
          items: { $ref: "#/components/schemas/RefSchema" },
          type: "array",
        },
        { ...ctx, exportedComponentSchemasMap: new Map() }
      )
    ).toMatchInlineSnapshot(`"z.array(z.string())"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        type: "array",
      })
    ).toMatchInlineSnapshot(`"z.array(z.any())"`);
  });

  test("snapshot testing schema type object", () => {
    expect(
      wrappedSchemaObjectToAstZodSchema({ properties: {}, type: "object" })
    ).toMatchInlineSnapshot(`"z.object({}).passthrough()"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        properties: {
          a: { type: "string" },
          b: { type: "number" },
        },
        type: "object",
      })
    ).toMatchInlineSnapshot(
      `"z.object({ "a": z.string().optional(), "b": z.number().optional() }).passthrough()"`
    );
    expect(
      wrappedSchemaObjectToAstZodSchema({
        properties: {
          a: { type: "string" },
          b: { type: "number" },
        },
        required: ["a"],
        type: "object",
      })
    ).toMatchInlineSnapshot(
      `"z.object({ "a": z.string(), "b": z.number().optional() }).passthrough()"`
    );

    const ctx = createMockContext({
      components: {
        schemas: {
          RefSchema: {
            properties: {
              a: { type: "string" },
              b: { type: "number" },
            },
            type: "object",
          },
        },
      },
    });

    expect(
      wrappedSchemaObjectToAstZodSchema(
        {
          properties: {
            a: { $ref: "#/components/schemas/RefSchema" },
            b: { type: "number" },
          },
          required: ["a"],
          type: "object",
        },
        ctx
      )
    ).toMatchInlineSnapshot(
      `"z.object({ "a": RefSchema, "b": z.number().optional() }).passthrough()"`
    );
    expect(
      wrappedSchemaObjectToAstZodSchema(
        {
          properties: {
            a: { $ref: "#/components/schemas/RefSchema" },
            b: { type: "number" },
          },
          required: ["a"],
          type: "object",
        },
        { ...ctx, exportedComponentSchemasMap: new Map() }
      )
    ).toMatchInlineSnapshot(
      `"z.object({ "a": z.object({ "a": z.string().optional(), "b": z.number().optional() }), "b": z.number().optional() }).passthrough()"`
    );
    expect(
      wrappedSchemaObjectToAstZodSchema({
        type: "object",
      })
    ).toMatchInlineSnapshot(`"z.object({}).passthrough()"`);

    expect(
      wrappedSchemaObjectToAstZodSchema({
        additionalProperties: true,
        properties: undefined,
        type: "object",
      })
    ).toMatchInlineSnapshot(`"z.record(z.any())"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        additionalProperties: true,
        properties: {},
        type: "object",
      })
    ).toMatchInlineSnapshot(`"z.record(z.any())"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        additionalProperties: {
          type: "string",
        },
        properties: {},
        type: "object",
      })
    ).toMatchInlineSnapshot(`"z.record(z.string())"`);
  });

  test("snapshot testing schema with enum", () => {
    expect(
      wrappedSchemaObjectToAstZodSchema({ enum: ["a", "b", "c"], type: "string" })
    ).toMatchInlineSnapshot(`"z.enum(["a", "b", "c"])"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ enum: ["a"], type: "string" })
    ).toMatchInlineSnapshot(`"z.literal("a")"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ enum: [1, 2, 3], type: "string" })
    ).toMatchInlineSnapshot(`"z.enum([1, 2, 3])"`);
    expect(wrappedSchemaObjectToAstZodSchema({ enum: [1], type: "string" })).toMatchInlineSnapshot(
      `"z.literal(1)"`
    );
    expect(
      wrappedSchemaObjectToAstZodSchema({ enum: ["a", 1, true], type: "string" })
    ).toMatchInlineSnapshot(`"z.enum(["a", 1, true])"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ enum: ["a", "b", "c"], nullable: true, type: "string" })
    ).toMatchInlineSnapshot(`"z.enum(["a", "b", "c"]).nullish()"`);
    expect(wrappedSchemaObjectToAstZodSchema({ enum: ["a", "b", "c"] })).toMatchInlineSnapshot(
      `"z.never()"`
    );
    expect(
      wrappedSchemaObjectToAstZodSchema({ enum: [false], type: "boolean" })
    ).toMatchInlineSnapshot(`"z.literal(false)"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ enum: [1, 2, 3], type: "number" })
    ).toMatchInlineSnapshot(`"z.enum([z.literal(1), z.literal(2), z.literal(3)])"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ enum: [1, null], type: "string" })
    ).toMatchInlineSnapshot(`"z.enum([1, "null"])"`);
  });

  test("snapshot testing schema with array of types", () => {
    expect(
      wrappedSchemaObjectToAstZodSchema({
        type: ["string"],
      })
    ).toMatchInlineSnapshot(`"z.string()"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        type: ["string", "number"],
      })
    ).toMatchInlineSnapshot(`"z.union([z.string(), z.number()])"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        type: ["string", "number", "boolean"],
      })
    ).toMatchInlineSnapshot(`"z.union([z.string(), z.number(), z.boolean()])"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        nullable: true,
        type: ["string", "number", "boolean"],
      })
    ).toMatchInlineSnapshot(
      `"z.union([z.string().nullish(), z.number().nullish(), z.boolean().nullish()]).nullish()"`
    );
  });

  describe("snapshot testing schema with anyOf property", () => {
    it("should throw an error", () => {
      expect(() =>
        wrappedSchemaObjectToAstZodSchema({
          anyOf: [{ type: "string" }, { type: "number" }],
          type: "string",
        })
      ).toThrowError(
        notImplementedError({ detail: "oneOf, anyOf and allOf are currently not supported" })
      );
    });
  });

  describe("snapshot testing schema with oneOf property", () => {
    it("should throw an error", () => {
      expect(() =>
        wrappedSchemaObjectToAstZodSchema({
          oneOf: [{ type: "string" }, { type: "number" }],
          type: "string",
        })
      ).toThrowError(
        notImplementedError({ detail: "oneOf, anyOf and allOf are currently not supported" })
      );
    });
  });

  describe("snapshot testing schema with allOf property", () => {
    it("should throw an error", () => {
      expect(() =>
        wrappedSchemaObjectToAstZodSchema({
          allOf: [{ type: "string" }, { type: "number" }],
          type: "string",
        })
      ).toThrowError(
        notImplementedError({ detail: "oneOf, anyOf and allOf are currently not supported" })
      );
    });
  });
});
