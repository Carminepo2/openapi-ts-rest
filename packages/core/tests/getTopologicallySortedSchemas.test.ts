import { describe, expect, it } from "vitest";

import { circularRefDependencyError } from "../src/domain/errors";
import { getExportedSchemas } from "../src/getTopologicallySortedSchemas";
import { createMockContext } from "./test.utils";

const componentSchemaRef1 = "#/components/schemas/Schema1";
const componentSchemaRef2 = "#/components/schemas/Schema2";
const componentSchemaRef3 = "#/components/schemas/Schema3";
const componentSchemaRef4 = "#/components/schemas/Schema4";

describe("getTopologicallySortedSchema", () => {
  it("should return topologically sorted schema", async () => {
    const ctx = createMockContext({
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
    const result = getExportedSchemas(ctx);
    expect(result).toHaveLength(2);

    expect(result[0].normalizedIdentifier).toBe("Schema2");
    expect(result[1].normalizedIdentifier).toBe("Schema1");
  });

  it("should throw error if there is a circular dependency", async () => {
    const ctx = createMockContext({
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
    expect(() => getExportedSchemas(ctx)).toThrowError(
      circularRefDependencyError({
        depsPath: [componentSchemaRef1, componentSchemaRef2, componentSchemaRef1],
      })
    );
  });

  it("should handle complex dependencies structure", async () => {
    const ctx = createMockContext({
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
    const result = getExportedSchemas(ctx);
    expect(result).toHaveLength(4);

    expect(result[0].normalizedIdentifier).toBe("Schema4");
    expect(result[1].normalizedIdentifier).toBe("Schema3");
    expect(result[2].normalizedIdentifier).toBe("Schema1");
    expect(result[3].normalizedIdentifier).toBe("Schema2");
  });

  it("should return empty array if there is no schema", async () => {
    const ctx = createMockContext({});
    const result = getExportedSchemas(ctx);
    expect(result).toHaveLength(0);
  });
});
