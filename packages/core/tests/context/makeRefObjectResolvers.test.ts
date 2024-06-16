/* eslint-disable sonarjs/no-duplicate-string */
import { describe, expect, it } from "vitest";

import type { OpenAPIComponentPath } from "../../src/domain/types";

import { makeRefObjectResolvers } from "../../src/context/makeRefObjectResolvers";
import { refResolutionDepthExceededError, resolveRefError } from "../../src/domain/errors";
import { createMockOpenApiObject } from "../test.utils";

describe("makeRefObjectResolvers", () => {
  describe("resolveRef", () => {
    it.each([
      "headers",
      "parameters",
      "pathItems",
      "requestBodies",
      "responses",
      "schemas",
    ] satisfies OpenAPIComponentPath[])(
      "should resolve the OpenAPI ref for component type %s",
      (componentType) => {
        const testSchema = {
          type: "string",
        };

        const openAPIMock = createMockOpenApiObject({
          components: {
            [componentType]: {
              Test: testSchema,
            },
          },
        });

        const { resolveRef } = makeRefObjectResolvers(openAPIMock);

        const resolvedObject = resolveRef(`#/components/${componentType}/Test`);
        expect(resolvedObject).toEqual(testSchema);
      }
    );

    it("should throw an error if the ref is not found", () => {
      const openAPIMock = createMockOpenApiObject();

      const { resolveRef } = makeRefObjectResolvers(openAPIMock);

      const ref = "#/components/schemas/NotFound";

      expect(() => resolveRef(ref)).toThrowError(resolveRefError({ ref }));
    });

    it("should resolve deeply nested refs", () => {
      const testSchema = {
        type: "string",
      } as const;

      const openAPIMock = createMockOpenApiObject({
        components: {
          schemas: {
            Nested: testSchema,
            Test: {
              $ref: "#/components/schemas/Nested",
            },
          },
        },
      });

      const { resolveRef } = makeRefObjectResolvers(openAPIMock);

      const resolvedObject = resolveRef("#/components/schemas/Test");
      expect(resolvedObject).toEqual(testSchema);
    });

    it("should throw an error if the ref resolution depth exceeds 100", () => {
      const openAPIMock = createMockOpenApiObject({
        components: {
          schemas: {
            Infinite: {
              $ref: "#/components/schemas/Loop",
            },
            Loop: {
              $ref: "#/components/schemas/Infinite",
            },
          },
        },
      });

      const { resolveRef } = makeRefObjectResolvers(openAPIMock);

      const ref = "#/components/schemas/Infinite";

      expect(() => resolveRef(ref)).toThrowError(refResolutionDepthExceededError({ ref }));
    });

    it("should not resolve the ref if the ref with the same identifier is in another component type", () => {
      const openAPIMock = createMockOpenApiObject({
        components: {
          responses: {
            Test: {
              $ref: "#/components/schemas/Test",
            },
          },
          schemas: {
            Test: {
              type: "string",
            },
          },
        },
      });

      const { resolveRef } = makeRefObjectResolvers(openAPIMock);

      const ref = "#/components/responses/Test";

      expect(() => resolveRef(ref)).toThrowError(resolveRefError({ ref }));
    });
  });

  describe("resolveObject", () => {
    it("should resolve an OpenAPI object", () => {
      const testSchema = {
        type: "string",
      } as const;

      const openAPIMock = createMockOpenApiObject({
        components: {
          schemas: {
            Test: testSchema,
          },
        },
      });

      const { resolveObject } = makeRefObjectResolvers(openAPIMock);

      const resolvedObject = resolveObject({
        $ref: "#/components/schemas/Test",
      });
      expect(resolvedObject).toEqual(testSchema);
    });

    it("should resolve deeply nested refs", () => {
      const testSchema = {
        type: "string",
      } as const;

      const openAPIMock = createMockOpenApiObject({
        components: {
          schemas: {
            Nested: testSchema,
            Test: {
              $ref: "#/components/schemas/Nested",
            },
          },
        },
      });

      const { resolveObject } = makeRefObjectResolvers(openAPIMock);

      const resolvedObject = resolveObject({
        $ref: "#/components/schemas/Test",
      });
      expect(resolvedObject).toEqual(testSchema);
    });

    it("should throw an error if the ref resolution depth exceeds 100", () => {
      const openAPIMock = createMockOpenApiObject({
        components: {
          schemas: {
            Infinite: {
              $ref: "#/components/schemas/Loop",
            },
            Loop: {
              $ref: "#/components/schemas/Infinite",
            },
          },
        },
      });

      const { resolveObject } = makeRefObjectResolvers(openAPIMock);

      const ref = "#/components/schemas/Infinite";

      expect(() => resolveObject({ $ref: ref })).toThrowError(
        refResolutionDepthExceededError({ ref })
      );
    });
  });
});
