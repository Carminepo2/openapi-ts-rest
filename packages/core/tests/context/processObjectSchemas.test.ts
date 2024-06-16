import type { OpenAPIObject } from "openapi3-ts";

import { describe, expect, it } from "vitest";

import { makeRefObjectResolvers } from "../../src/context/makeRefObjectResolvers";
import { processObjectSchemas } from "../../src/context/processObjectSchemas";
import { circularRefDependencyError } from "../../src/domain/errors";
import { createMockOpenApiObject } from "../test.utils";

const componentSchemaRef1 = "#/components/schemas/Schema1";
const componentSchemaRef2 = "#/components/schemas/Schema2";
const componentSchemaRef3 = "#/components/schemas/Schema3";
const componentSchemaRef4 = "#/components/schemas/Schema4";

function wrappedProcessObjectSchemas(
  openAPIDoc: OpenAPIObject
): ReturnType<typeof processObjectSchemas> {
  const { resolveRef } = makeRefObjectResolvers(openAPIDoc);
  return processObjectSchemas(openAPIDoc, resolveRef);
}

describe("getTopologicallySortedSchema", () => {
  it("should return topologically sorted schema", async () => {
    const openAPIDoc = createMockOpenApiObject({
      components: {
        schemas: {
          Schema1: {
            properties: {
              prop: { $ref: componentSchemaRef2 },
            },
            type: "object",
          },
          Schema2: {
            properties: {
              prop2: { type: "string" },
            },
            type: "object",
          },
        },
      },
    });
    const { topologicallySortedSchemas } = wrappedProcessObjectSchemas(openAPIDoc);
    expect(topologicallySortedSchemas).toHaveLength(2);

    expect(topologicallySortedSchemas[0].normalizedIdentifier).toBe("Schema2");
    expect(topologicallySortedSchemas[1].normalizedIdentifier).toBe("Schema1");
  });

  it("should throw error if there is a circular dependency", async () => {
    const openAPIDoc = createMockOpenApiObject({
      components: {
        schemas: {
          Schema1: {
            properties: {
              prop: { $ref: componentSchemaRef2 },
            },
            type: "object",
          },
          Schema2: {
            properties: {
              prop2: { $ref: componentSchemaRef1 },
            },
            type: "object",
          },
        },
      },
    });
    expect(() => wrappedProcessObjectSchemas(openAPIDoc)).toThrowError(
      circularRefDependencyError({
        depsPath: [componentSchemaRef1, componentSchemaRef2, componentSchemaRef1],
      })
    );
  });

  it("should handle complex dependencies structure", async () => {
    const openAPIDoc = createMockOpenApiObject({
      components: {
        schemas: {
          Schema1: {
            anyOf: [{ $ref: componentSchemaRef3 }],
            type: "object",
          },
          Schema2: {
            items: { $ref: componentSchemaRef3 },
            type: "array",
          },
          Schema3: {
            additionalProperties: {
              $ref: componentSchemaRef4,
            },
          },
          Schema4: {
            type: "boolean",
          },
        },
      },
    });
    const { topologicallySortedSchemas } = wrappedProcessObjectSchemas(openAPIDoc);
    expect(topologicallySortedSchemas).toHaveLength(4);

    expect(topologicallySortedSchemas[0].normalizedIdentifier).toBe("Schema4");
    expect(topologicallySortedSchemas[1].normalizedIdentifier).toBe("Schema3");
    expect(topologicallySortedSchemas[2].normalizedIdentifier).toBe("Schema1");
    expect(topologicallySortedSchemas[3].normalizedIdentifier).toBe("Schema2");
  });

  it("should return empty array if there is no schema", async () => {
    const openAPIDoc = createMockOpenApiObject({});
    const { topologicallySortedSchemas } = wrappedProcessObjectSchemas(openAPIDoc);
    expect(topologicallySortedSchemas).toHaveLength(0);
  });
});
