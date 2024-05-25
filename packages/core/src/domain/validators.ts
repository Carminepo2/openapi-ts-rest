import { throwError } from "./errors";

export function validateOpenAPIStatusCode({
  statusCode,
  path,
  method,
}: {
  statusCode: string;
  path: string;
  method: string;
}): void {
  if (statusCode === "default") return;

  const statusCodeNumber = Number(statusCode);
  if (!Number.isInteger(statusCodeNumber) || statusCodeNumber < 100 || statusCodeNumber >= 600) {
    throwError({
      type: "InvalidStatusCode",
      payload: {
        statusCode,
        path,
        method,
      },
    });
  }
}

export function validateOpenAPIHttpMethod({ path, method }: { path: string; method: string }): void {
  if (!["get", "post", "put", "patch", "delete", "head", "options", "trace"].includes(method.toLowerCase())) {
    throwError({
      type: "InvalidHttpMethod",
      payload: {
        path,
        method,
      },
    });
  }
}
