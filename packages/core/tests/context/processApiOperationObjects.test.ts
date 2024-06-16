import type { OpenAPIObject } from "openapi3-ts";

import { describe, expect, it } from "vitest";

import { makeRefObjectResolvers } from "../../src/context/makeRefObjectResolvers";
import { processApiOperationObjects } from "../../src/context/processApiOperationObjects";
import { invalidHttpMethodError, invalidStatusCodeError } from "../../src/domain/errors";
import { createMockOpenApiObject } from "../test.utils";

const wrappedProcessApiOperationObjects = (
  openAPIDoc: OpenAPIObject
): ReturnType<typeof processApiOperationObjects> => {
  const { resolveObject } = makeRefObjectResolvers(openAPIDoc);
  return processApiOperationObjects(openAPIDoc, resolveObject);
};

describe("processApiOperationObjects", () => {
  it("should return an array of APIOperationObject", () => {
    const openApiDoc = createMockOpenApiObject({
      paths: { "/hello": { get: { responses: { 200: { description: "200" } } } } },
    });

    const result = wrappedProcessApiOperationObjects(openApiDoc);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      method: "get",
      path: "/hello",
      responses: {
        200: { description: "200" },
      },
    });
  });

  it("should return an empty array if the paths object is falsy", () => {
    const openApiDoc = createMockOpenApiObject({
      paths: undefined,
    });

    const result = wrappedProcessApiOperationObjects(openApiDoc);
    expect(result).toHaveLength(0);
  });

  it("should correctly resolve the api item ref", () => {
    const openApiDoc = createMockOpenApiObject({
      components: {
        // @ts-expect-error @typescript-eslint/ban-ts-comment
        pathItems: {
          Hello: {
            get: { responses: { 200: { description: "200" } } },
          },
        },
      },
      paths: {
        "/hello": {
          $ref: "#/components/pathItems/Hello",
        },
      },
    });

    const result = wrappedProcessApiOperationObjects(openApiDoc);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      method: "get",
      path: "/hello",
      responses: {
        200: { description: "200" },
      },
    });
  });

  it("should ignore a path without operations", () => {
    const openApiDoc = createMockOpenApiObject({
      paths: { "/hello": {} },
    });

    const result = wrappedProcessApiOperationObjects(openApiDoc);
    expect(result).toHaveLength(0);
  });

  it("should ignore a path operation without responses", () => {
    const openApiDoc = createMockOpenApiObject({
      paths: { "/hello": { get: {} } },
    });

    const result = wrappedProcessApiOperationObjects(openApiDoc);
    expect(result).toHaveLength(0);
  });

  it("should throw an error if the HTTP method is invalid", () => {
    const openApiDoc = createMockOpenApiObject({
      paths: { "/hello": { invalid: { responses: { 200: { description: "200" } } } } },
    });

    expect(() => wrappedProcessApiOperationObjects(openApiDoc)).toThrowError(
      invalidHttpMethodError({ method: "invalid", path: "/hello" })
    );
  });

  it("should merge parameters from path and operation", () => {
    const openApiDoc = createMockOpenApiObject({
      paths: {
        "/hello": {
          get: {
            parameters: [{ in: "query", name: "param2" }],
            responses: { 200: { description: "200" } },
          },
          parameters: [{ in: "query", name: "param1" }],
        },
      },
    });

    const result = wrappedProcessApiOperationObjects(openApiDoc);
    expect(result).toHaveLength(1);
    expect(result[0].parameters).toHaveLength(2);
  });

  it("should remove duplicate parameters", () => {
    const openApiDoc = createMockOpenApiObject({
      paths: {
        "/hello": {
          get: {
            parameters: [{ in: "query", name: "param1" }],
            responses: { 200: { description: "200" } },
          },
          parameters: [{ in: "query", name: "param1" }],
        },
      },
    });

    const result = wrappedProcessApiOperationObjects(openApiDoc);
    expect(result).toHaveLength(1);
    expect(result[0].parameters).toHaveLength(1);
  });

  it("should correctly resolve the request body", () => {
    const openApiDoc = createMockOpenApiObject({
      paths: {
        "/hello": {
          get: {
            responses: { 200: { description: "200" } },
          },
          post: {
            requestBody: { content: { "application/json": { schema: { type: "object" } } } },
            responses: { 200: { description: "200" } },
          },
        },
      },
    });

    const result = wrappedProcessApiOperationObjects(openApiDoc);
    expect(result).toHaveLength(2);
    expect(result[1].requestBody).toMatchObject({
      content: { "application/json": { schema: { type: "object" } } },
    });
  });

  it("should throw an error if the status code is invalid", () => {
    const openApiDoc = createMockOpenApiObject({
      paths: {
        "/hello": {
          get: {
            responses: { 200: { description: "200" }, invalid: { description: "invalid" } },
          },
        },
      },
    });

    expect(() => wrappedProcessApiOperationObjects(openApiDoc)).toThrowError(
      invalidStatusCodeError({ method: "get", path: "/hello", statusCode: "invalid" })
    );
  });

  it("should return an empty array if there are no paths", () => {
    const openApiDoc = createMockOpenApiObject({});

    const result = wrappedProcessApiOperationObjects(openApiDoc);
    expect(result).toHaveLength(0);
  });

  it("should skip the path if it is empty", () => {
    const openAPIDoc = createMockOpenApiObject({
      paths: {
        "/hello": undefined,
        "/world": { get: { responses: { 200: { description: "200" } } } },
      },
    });

    const result = wrappedProcessApiOperationObjects(openAPIDoc);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      method: "get",
      path: "/world",
      responses: {
        200: { description: "200" },
      },
    });
  });
});
