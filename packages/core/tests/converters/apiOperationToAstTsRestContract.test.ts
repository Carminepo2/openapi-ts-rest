import merge from "lodash/merge";
import { describe, expect, it } from "vitest";

import type { APIOperationObject } from "../../src/domain/types";

import { apiOperationToAstTsRestContract } from "../../src/converters/apiOperationToAstTsRestContract";
import { POSSIBLE_STATUS_CODES_TS_REST_OUTPUT } from "../../src/domain/constants";
import {
  invalidStatusCodeError,
  missingSchemaInParameterObjectError,
  unsupportedRequestBodyContentTypeError,
} from "../../src/domain/errors";
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
            responses: {},
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
      `"{ "getPosts": { "method": "GET", "path": "/getPosts", "responses": {} } }"`
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
      missingSchemaInParameterObjectError({
        method: "get",
        paramType: "query",
        path: "/getPosts",
      })
    );
  });

  it("should add z.void() body if the operation method is different from get and has no request body", () => {
    expect(
      wrappedApiOperationToAstTsRestContract({
        method: "post",
      })
    ).toContain(`"body": z.void()`);
  });

  it("should not add z.void() body if the operation method GET and has no request body", () => {
    expect(
      wrappedApiOperationToAstTsRestContract({
        method: "get",
      })
    ).not.toContain(`"body": z.void()`);
  });

  it("should throw an error if a body has an unsupported content type", () => {
    expect(() =>
      wrappedApiOperationToAstTsRestContract({
        requestBody: {
          content: {
            "application/xml": {
              schema: {
                type: "string",
              },
            },
          },
        },
      })
    ).toThrowError(
      unsupportedRequestBodyContentTypeError({
        contentType: "application/xml",
        method: "get",
        path: "/getPosts",
      })
    );
  });

  it("should correctly set an empty body if a body with a content type does not have a schema", () => {
    const result = wrappedApiOperationToAstTsRestContract({
      requestBody: {
        content: {
          "application/json": {},
        },
      },
    });
    expect(result).toContain('"body": z.void()');
  });

  it("should correctly convert a body with a schema", () => {
    expect(
      wrappedApiOperationToAstTsRestContract({
        requestBody: {
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
        },
      })
    ).toContain(`"body": z.object({ "a": z.string().optional(), "b": z.number().optional() })`);
  });

  it("should correctly convert a body with a schema containing an exported ref", () => {
    const mockCtx = createMockContext({
      components: {
        schemas: {
          Post: {
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
      wrappedApiOperationToAstTsRestContract(
        {
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Post",
                },
              },
            },
          },
        },
        mockCtx
      )
    ).toContain(`"body": Post`);
  });

  it("should correctly convert a body with a schema containing an not exported ref", () => {
    const mockCtx = createMockContext({
      components: {
        schemas: {
          Post: {
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
      wrappedApiOperationToAstTsRestContract(
        {
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Post",
                },
              },
            },
          },
        },
        { ...mockCtx, componentSchemasMap: new Map() }
      )
    ).toContain(`"body": z.object({ "a": z.string().optional(), "b": z.number().optional() })`);
  });

  it.each(POSSIBLE_STATUS_CODES_TS_REST_OUTPUT)(
    "should correctly convert a response object with a status code %s",
    (statusCode) => {
      expect(
        wrappedApiOperationToAstTsRestContract({
          responses: {
            [statusCode]: {
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
        })
      ).toContain(
        `"${statusCode}": z.object({ "a": z.string().optional(), "b": z.number().optional() })`
      );
    }
  );

  it("It should correctly parse a response without content", () => {
    const result = wrappedApiOperationToAstTsRestContract({
      responses: {
        "204": {
          description: "OK",
        },
      },
    });

    expect(result).contain('"204": z.void()');
  });

  it.each(["2xx", "4xx", "5XX"])(
    "should correctly convert a response object with a range of status code %s",
    (range) => {
      const result = wrappedApiOperationToAstTsRestContract({
        responses: {
          [range]: {
            content: {
              "application/json": {
                schema: {
                  type: "boolean",
                },
              },
            },
            description: "OK",
          },
        },
      });

      const possibleStatusCodes = POSSIBLE_STATUS_CODES_TS_REST_OUTPUT.filter((statusCode) =>
        statusCode.startsWith(range.charAt(0))
      );

      possibleStatusCodes.forEach((statusCode) => {
        expect(result).toContain(`"${statusCode}": z.boolean()`);
      });
    }
  );

  it("should not add the range of status codes 2XX if there is already a 2XX status code", () => {
    const result = wrappedApiOperationToAstTsRestContract({
      responses: {
        "2xx": {
          content: {
            "application/json": {
              schema: {
                type: "boolean",
              },
            },
          },
          description: "OK",
        },
        "200": {
          content: {
            "application/json": {
              schema: {
                type: "string",
              },
            },
          },
          description: "OK",
        },
      },
    });

    expect(result).toContain(`"200": z.string()`);
    POSSIBLE_STATUS_CODES_TS_REST_OUTPUT.filter(
      (statusCode) => statusCode.startsWith("2") && statusCode !== "200"
    ).forEach((statusCode) => {
      expect(result).not.toContain(`"${statusCode}": z.string()`);
    });
  });

  it("should correctly convert a response object with a default status code", () => {
    const result = wrappedApiOperationToAstTsRestContract({
      responses: {
        default: {
          content: {
            "application/json": {
              schema: {
                type: "boolean",
              },
            },
          },
          description: "OK",
        },
      },
    });

    POSSIBLE_STATUS_CODES_TS_REST_OUTPUT.forEach((statusCode) => {
      expect(result).toContain(`"${statusCode}": z.boolean()`);
    });
  });

  it("should not add the 2xx status codes on the default status code if there is already a 2xx status code", () => {
    const result = wrappedApiOperationToAstTsRestContract({
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: {
                type: "boolean",
              },
            },
          },
          description: "OK",
        },
        default: {
          content: {
            "application/json": {
              schema: {
                type: "string",
              },
            },
          },
          description: "OK",
        },
      },
    });

    expect(result).toContain(`"200": z.boolean()`);
    POSSIBLE_STATUS_CODES_TS_REST_OUTPUT.filter((statusCode) => statusCode.startsWith("2")).forEach(
      (statusCode) => {
        expect(result).not.toContain(`"${statusCode}": z.string()`);
      }
    );
  });

  it("default status code should not override existing status codes", () => {
    const result = wrappedApiOperationToAstTsRestContract({
      responses: {
        "403": {
          content: {
            "application/json": {
              schema: {
                type: "string",
              },
            },
          },
          description: "OK",
        },
        "404": {
          content: {
            "application/json": {
              schema: {
                type: "string",
              },
            },
          },
          description: "OK",
        },
        default: {
          content: {
            "application/json": {
              schema: {
                type: "boolean",
              },
            },
          },
          description: "OK",
        },
      },
    });

    expect(result).toContain(`"404": z.string()`);
    expect(result).toContain(`"403": z.string()`);
  });

  it("range status code should not override existing status codes", () => {
    const result = wrappedApiOperationToAstTsRestContract({
      responses: {
        "4xx": {
          content: {
            "application/json": {
              schema: {
                type: "boolean",
              },
            },
          },
          description: "OK",
        },
        "403": {
          content: {
            "application/json": {
              schema: {
                type: "string",
              },
            },
          },
          description: "OK",
        },
        "404": {
          content: {
            "application/json": {
              schema: {
                type: "string",
              },
            },
          },
          description: "OK",
        },
      },
    });

    expect(result).toContain(`"404": z.string()`);
    expect(result).toContain(`"403": z.string()`);
  });

  it("should override correctly status code in responses objects correctly", () => {
    const result = wrappedApiOperationToAstTsRestContract({
      responses: {
        "4xx": {
          content: {
            "application/json": {
              schema: {
                type: "string",
              },
            },
          },
          description: "OK",
        },
        "400": {
          content: {
            "application/json": {
              schema: {
                type: "boolean",
              },
            },
          },
          description: "OK",
        },
        default: {
          content: {
            "application/json": {
              schema: {
                type: "null",
              },
            },
          },
          description: "OK",
        },
      },
    });

    expect(result).toContain(`"400": z.boolean()`);
    const possible4xxStatusCodes = POSSIBLE_STATUS_CODES_TS_REST_OUTPUT.filter(
      (statusCode) => statusCode.startsWith("4") && statusCode !== "400"
    );
    possible4xxStatusCodes.forEach((statusCode) => {
      expect(result).toContain(`"${statusCode}": z.string()`);
    });
    const restOfStatusCodes = POSSIBLE_STATUS_CODES_TS_REST_OUTPUT.filter(
      (statusCode) => !statusCode.startsWith("4") && statusCode !== "200"
    );
    restOfStatusCodes.forEach((statusCode) => {
      expect(result).toContain(`"${statusCode}": z.null()`);
    });
  });

  it("should correctly convert a response object with a content type differente from application/json", () => {
    const result = wrappedApiOperationToAstTsRestContract({
      responses: {
        "204": {
          content: {
            "application/pdf": {
              schema: {
                type: "string",
              },
            },
          },
          description: "OK",
        },
      },
    });

    expect(result).toContain(
      `"204": c.otherResponse({ "contentType": "application/pdf", "body": z.string() })`
    );
  });

  it("should throw error if an invalid status code is provided", () => {
    expect(() =>
      wrappedApiOperationToAstTsRestContract({
        responses: {
          "2010": {
            content: {
              "application/json": {
                schema: {
                  type: "string",
                },
              },
            },
            description: "OK",
          },
        },
      })
    ).toThrowError(
      invalidStatusCodeError({
        method: "get",
        path: "/getPosts",
        statusCode: "2010",
      })
    );
  });

  it("should throw an error if the response object does not have a content type", () => {
    const result = wrappedApiOperationToAstTsRestContract({
      responses: {
        "204": {
          content: {},
          description: "OK",
        },
      },
    });
    expect(result).toContain(`"204": z.void()`);
  });

  it("should use the operationId as the contract operation name if given", () => {
    expect(
      wrappedApiOperationToAstTsRestContract({
        operationId: "getPosts",
      })
    ).toContain(`"getPosts"`);
  });

  it("should convert the operationId to camelcase if it contains a dash", () => {
    expect(
      wrappedApiOperationToAstTsRestContract({
        operationId: "get-posts",
      })
    ).toContain(`"getPosts"`);
  });

  it("should use the path as the contract operation name if operationId is not given", () => {
    expect(wrappedApiOperationToAstTsRestContract({ operationId: undefined })).toContain(
      `"getPosts"`
    );
  });
});
