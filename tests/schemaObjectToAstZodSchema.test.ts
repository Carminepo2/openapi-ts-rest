import { test, describe, expect } from "vitest";
import type { SchemaObject } from "openapi3-ts/oas30";
import { schemaObjectToAstZodSchema } from "../src/converters/schemaObjectToAstZodSchema";
import type { Context } from "../src/context";
import { astToString } from "../src/lib/utils";

const mockCtx = {
  resolveSchemaObject: <T>(arg: T) => arg,
} as Context;

const wrappedSchemaObjectToAstZodSchema = (schema: SchemaObject): string =>
  astToString(schemaObjectToAstZodSchema(schema, mockCtx)).trim();

describe("schemaObjectToAstZodSchema", () => {
  test("snapshot testing schema type string", () => {
    expect(wrappedSchemaObjectToAstZodSchema({ type: "string" })).toMatchInlineSnapshot(`"z.string()"`);
    expect(wrappedSchemaObjectToAstZodSchema({ type: "string", nullable: true })).toMatchInlineSnapshot(
      `"z.string().nullish()"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ type: "string", minLength: 5 })).toMatchInlineSnapshot(
      `"z.string().min(5)"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ type: "string", maxLength: 5 })).toMatchInlineSnapshot(
      `"z.string().max(5)"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ type: "string", minLength: 5, maxLength: 10 })).toMatchInlineSnapshot(
      `"z.string().min(5).max(10)"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ type: "string", pattern: ".*" })).toMatchInlineSnapshot(
      `"z.string().regex(/.*/)"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ type: "string", format: "binary" })).toMatchInlineSnapshot(
      `"z.instanceof(File)"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ type: "string", enum: ["a", "b", "c"] })).toMatchInlineSnapshot(
      `"z.enum(["\\"a\\"", "\\"b\\"", "\\"c\\""])"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ type: "string", enum: ["a"] })).toMatchInlineSnapshot(
      `"z.literal("\\"a\\"")"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ type: "string", enum: [1, 2, 3] })).toMatchInlineSnapshot(
      `"z.enum(["\\"1\\"", "\\"2\\"", "\\"3\\""])"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ type: "string", enum: [1] })).toMatchInlineSnapshot(
      `"z.literal("\\"1\\"")"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ type: "string", enum: ["a", 1, true] })).toMatchInlineSnapshot(
      `"z.enum(["\\"a\\"", "\\"1\\"", "\\"true\\""])"`
    );
  });

  test("snapshot testing schema type number", () => {
    expect(wrappedSchemaObjectToAstZodSchema({ type: "number" })).toMatchInlineSnapshot(`"z.number()"`);
    expect(wrappedSchemaObjectToAstZodSchema({ type: "number", nullable: true })).toMatchInlineSnapshot(
      `"z.number().nullish()"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ type: "number", minimum: 5 })).toMatchInlineSnapshot(
      `"z.number().gte(5)"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ type: "number", maximum: 5 })).toMatchInlineSnapshot(
      `"z.number().lte(5)"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ type: "number", minimum: 5, maximum: 10 })).toMatchInlineSnapshot(
      `"z.number().gte(5).lte(10)"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ type: "number", multipleOf: 5 })).toMatchInlineSnapshot(
      `"z.number().multipleOf(5)"`
    );
    expect(
      wrappedSchemaObjectToAstZodSchema({ type: "number", minimum: 5, exclusiveMinimum: true })
    ).toMatchInlineSnapshot(`"z.number().gt(5)"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({ type: "number", maximum: 5, exclusiveMaximum: true })
    ).toMatchInlineSnapshot(`"z.number().lt(5)"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        type: "number",
        minimum: 5,
        exclusiveMinimum: true,
        maximum: 5,
        exclusiveMaximum: true,
      })
    ).toMatchInlineSnapshot(`"z.number().gt(5).lt(5)"`);
  });

  test("snapshot testing schema type boolean and null", () => {
    expect(wrappedSchemaObjectToAstZodSchema({ type: "boolean" })).toMatchInlineSnapshot(`"z.boolean()"`);
    expect(wrappedSchemaObjectToAstZodSchema({ type: "null" })).toMatchInlineSnapshot(`"z.null()"`);
  });

  test("snapshot testing schema type array", () => {
    expect(wrappedSchemaObjectToAstZodSchema({ type: "array", items: { type: "string" } })).toMatchInlineSnapshot(
      `"z.array(z.string())"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ type: "array", items: { type: "number" } })).toMatchInlineSnapshot(
      `"z.array(z.number())"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ type: "array", items: { type: "boolean" } })).toMatchInlineSnapshot(
      `"z.array(z.boolean())"`
    );
    expect(wrappedSchemaObjectToAstZodSchema({ type: "array", items: { type: "null" } })).toMatchInlineSnapshot(
      `"z.array(z.null())"`
    );
    expect(
      wrappedSchemaObjectToAstZodSchema({ type: "array", items: { type: "array", items: { type: "string" } } })
    ).toMatchInlineSnapshot(`"z.array(z.array(z.string()))"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        type: "array",
        items: { type: "array", items: { type: "number" }, minItems: 5 },
      })
    ).toMatchInlineSnapshot(`"z.array(z.array(z.number()).min(5))"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        type: "array",
        items: { type: "array", items: { type: "number" }, maxItems: 5 },
      })
    ).toMatchInlineSnapshot(`"z.array(z.array(z.number()).max(5))"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        type: "array",
        items: { type: "array", items: { type: "number" }, minItems: 5, maxItems: 10 },
      })
    ).toMatchInlineSnapshot(`"z.array(z.array(z.number()).min(5).max(10))"`);
  });

  test("snapshot testing schema type object", () => {
    expect(wrappedSchemaObjectToAstZodSchema({ type: "object", properties: {} })).toMatchInlineSnapshot(
      `"z.object({})"`
    );
    expect(
      wrappedSchemaObjectToAstZodSchema({
        type: "object",
        properties: {
          a: { type: "string" },
          b: { type: "number" },
        },
      })
    ).toMatchInlineSnapshot(`"z.object({ "a": z.string().optional(), "b": z.number().optional() })"`);
    expect(
      wrappedSchemaObjectToAstZodSchema({
        type: "object",
        properties: {
          a: { type: "string" },
          b: { type: "number" },
        },
        required: ["a"],
      })
    ).toMatchInlineSnapshot(`"z.object({ "a": z.string(), "b": z.number().optional() })"`);
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
        type: ["string", "number", "boolean"],
        nullable: true,
      })
    ).toMatchInlineSnapshot(`"z.union([z.string().nullish(), z.number().nullish(), z.boolean().nullish()]).nullish()"`);
  });
});
