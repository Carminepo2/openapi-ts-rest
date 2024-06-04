import merge from "lodash/merge";

import type { APIOperationObject } from "../../src/domain/types";

import { apiOperationToAstTsRestContract } from "../../src/converters/apiOperationToAstTsRestContract";
import { missingSchemaInParameterError } from "../../src/domain/errors";
import { tsObject } from "../../src/lib/ts";
import { astToString } from "../../src/lib/utils";
import { createMockContext } from "../test.utils";

const mockCtx = createMockContext();

const wrappedApiOperationToAstTsRestContract = (
  overrides: Partial<APIOperationObject> = {},
  ctx = mockCtx
): string =>
  astToString(
    tsObject(
      apiOperationToAstTsRestContract(
        merge(
          {
            method: "get",
            parameters: [],
            path: "/getPosts",
            responses: {
              200: {
                content: {
                  "application/json": {
                    schema: {
                      properties: {
                        a: { type: "string" },
                        b: { type: "number" },
                      },
                      type: "object",
                    },
                  },
                },
                description: "OK",
              },
            },
          },
          overrides
        ),
        ctx
      )
    )
  ).trim();

describe("apiOperationToAstTsRestContract", () => {
  it("should correctly convert a simple GET operation", () => {
    expect(wrappedApiOperationToAstTsRestContract()).toMatchInlineSnapshot(
      `"{ "getPosts": { "method": "GET", "path": "/getPosts", "responses": { "200": z.object({ "a": z.string().optional(), "b": z.number().optional() }) } } }"`
    );
  });

  it("should correctly uppercase the method", () => {
    expect(wrappedApiOperationToAstTsRestContract({ method: "post" })).toContain(
      `"method": "POST"`
    );
  });

  it("should correctly convert an openapi path with path parameters", () => {
    expect(wrappedApiOperationToAstTsRestContract({ path: "/getPosts/{id}" })).toContain(
      `"path": "/getPosts/:id"`
    );
  });

  it("should correctly set the summary as summary if it exists", () => {
    expect(wrappedApiOperationToAstTsRestContract({ summary: "Get posts" })).toContain(
      `"summary": "Get posts"`
    );
  });

  it("should correctly set the description as summary if summary does not exist", () => {
    expect(wrappedApiOperationToAstTsRestContract({ description: "Get posts" })).toContain(
      `"summary": "Get posts"`
    );
  });

  it("should not set the summary if both description and summary not exist", () => {
    expect(wrappedApiOperationToAstTsRestContract()).not.toContain(`"summary"`);
  });

  it.each([
    ["header", "headers"],
    ["query", "query"],
    ["path", "pathParams"],
  ] as const)(`should correctly convert %s parameter`, (openApiParamType, tsContractParamType) => {
    expect(
      wrappedApiOperationToAstTsRestContract({
        parameters: [
          { in: openApiParamType, name: "a", required: true, schema: { type: "string" } },
          { in: openApiParamType, name: "b", required: true, schema: { type: "number" } },
        ],
      })
    ).toContain(`"${tsContractParamType}": z.object({ "a": z.string(), "b": z.number() })`);
  });

  it.each([
    ["header", "headers"],
    ["query", "query"],
  ] as const)(
    `should correctly convert %s parameter when they are not required`,
    (openApiParamType, tsContractParamType) => {
      expect(
        wrappedApiOperationToAstTsRestContract({
          parameters: [
            { in: openApiParamType, name: "a", required: false, schema: { type: "string" } },
            { in: openApiParamType, name: "b", required: false, schema: { type: "number" } },
          ],
        })
      ).toContain(
        `"${tsContractParamType}": z.object({ "a": z.string().optional(), "b": z.number().optional() })`
      );
    }
  );

  it("should always treat path parames parameters as required", () => {
    expect(
      wrappedApiOperationToAstTsRestContract({
        parameters: [
          { in: "path", name: "a", required: false, schema: { type: "string" } },
          { in: "path", name: "b", required: false, schema: { type: "number" } },
        ],
      })
    ).toContain(`"pathParams": z.object({ "a": z.string(), "b": z.number() })`);
  });

  it("should throw an error if a parameter does not have a schema", () => {
    expect(() =>
      wrappedApiOperationToAstTsRestContract({
        parameters: [{ in: "query", name: "a", required: true }],
      })
    ).toThrowError(
      missingSchemaInParameterError({
        method: "get",
        paramType: "query",
        path: "/getPosts",
      })
    );
  });
});
