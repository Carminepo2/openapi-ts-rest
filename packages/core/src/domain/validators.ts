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
  // Range of status codes (1XX, 2XX, 3XX etc...) are allowed
  if (/^[1-5]XX$/.test(statusCode)) return;

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

export function validateOpenAPIHttpMethod({
  path,
  method,
}: {
  path: string;
  method: string;
}): void {
  if (
    !["get", "post", "put", "patch", "delete", "head", "options", "trace"].includes(
      method.toLowerCase()
    )
  ) {
    throwError({
      type: "InvalidHttpMethod",
      payload: {
        path,
        method,
      },
    });
  }
}
