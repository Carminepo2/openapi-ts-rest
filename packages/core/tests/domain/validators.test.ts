import { describe, expect, it } from "vitest";

import {
  invalidHttpMethodError,
  invalidRefError,
  invalidStatusCodeError,
} from "../../src/domain/errors";
import {
  validateOpenAPIHttpMethod,
  validateOpenAPIStatusCode,
  validateRef,
} from "../../src/domain/validators";

describe("validators", () => {
  describe("validateOpenAPIStatusCode", () => {
    it("should validate a valid status code", () => {
      const method = "get";
      const path = "/users";
      const statusCode = "200";
      expect(() => validateOpenAPIStatusCode({ method, path, statusCode })).not.toThrow();
    });

    it("should validate a valid status code range", () => {
      const method = "get";
      const path = "/users";
      const statusCode = "2XX";
      expect(() => validateOpenAPIStatusCode({ method, path, statusCode })).not.toThrow();
    });

    it("should validate a valid default status code", () => {
      const method = "get";
      const path = "/users";
      const statusCode = "default";
      expect(() => validateOpenAPIStatusCode({ method, path, statusCode })).not.toThrow();
    });

    it("should throw an error if the status code is invalid", () => {
      const method = "get";
      const path = "/users";
      const statusCode = "invalid";
      expect(() => validateOpenAPIStatusCode({ method, path, statusCode })).toThrowError(
        invalidStatusCodeError({ method, path, statusCode })
      );
    });
  });

  describe("validateOpenAPIHttpMethod", () => {
    it("should validate a valid HTTP method", () => {
      const method = "get";
      const path = "/users";
      expect(() => validateOpenAPIHttpMethod({ method, path })).not.toThrow();
    });

    it("should throw an error if the HTTP method is invalid", () => {
      const method = "invalid";
      const path = "/users";
      expect(() => validateOpenAPIHttpMethod({ method, path })).toThrowError(
        invalidHttpMethodError({ method, path })
      );
    });
  });

  describe("validateRef", () => {
    it("should validate a valid ref", () => {
      const ref = "#/components/schemas/User";
      expect(() => validateRef(ref)).not.toThrow();
    });

    it("should throw an error if the there is an invalid component type", () => {
      const ref = "#/components/invalid/User";
      expect(() => validateRef(ref)).toThrowError(invalidRefError({ ref }));
    });

    it("should throw an error if there is no identifier", () => {
      const ref = "#/components/schemas";
      expect(() => validateRef(ref)).toThrowError(invalidRefError({ ref }));
    });
  });
});
