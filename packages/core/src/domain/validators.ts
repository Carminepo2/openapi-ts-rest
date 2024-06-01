import { P, match } from "ts-pattern";

import type { OpenAPIComponentPath } from "./types";

import { invalidHttpMethodError, invalidRefError, invalidStatusCodeError } from "./errors";

export function validateOpenAPIStatusCode({
  method,
  path,
  statusCode,
}: {
  method: string;
  path: string;
  statusCode: string;
}): void {
  if (statusCode === "default") return;
  // Range of status codes (1XX, 2XX, 3XX etc...) are allowed
  if (/^[1-5]XX$/.test(statusCode)) return;

  const statusCodeNumber = Number(statusCode);
  if (!Number.isInteger(statusCodeNumber) || statusCodeNumber < 100 || statusCodeNumber >= 600) {
    throw invalidStatusCodeError({ method, path, statusCode });
  }
}

export function validateOpenAPIHttpMethod({
  method,
  path,
}: {
  method: string;
  path: string;
}): void {
  if (
    !["delete", "get", "head", "options", "patch", "post", "put", "trace"].includes(
      method.toLowerCase()
    )
  ) {
    throw invalidHttpMethodError({ method, path });
  }
}

export function validateRef(ref: string): void {
  const componentPaths = [
    "schemas",
    "parameters",
    "requestBodies",
    "responses",
    "headers",
    "pathItems",
  ] as const satisfies OpenAPIComponentPath[];

  const isValid = match(ref.split("/"))
    .with(["#", "components", P.union(...componentPaths), P.string.minLength(1)], () => true)
    .otherwise(() => false);

  if (!isValid) {
    throw invalidRefError({ ref });
  }
}
