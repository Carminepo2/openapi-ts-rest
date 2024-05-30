import { throwError } from "./errors";

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
    throwError({
      payload: {
        method,
        path,
        statusCode,
      },
      type: "InvalidStatusCode",
    });
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
    throwError({
      payload: {
        method,
        path,
      },
      type: "InvalidHttpMethod",
    });
  }
}
