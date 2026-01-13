type OpenApiTsRestContractErrorCode =
  | "CircularRefDependencyError"
  | "InvalidHttpMethodError"
  | "InvalidRefError"
  | "InvalidStatusCodeError"
  | "MissingSchemaInParameterObjectError"
  | "NotImplementedError"
  | "ObjectResolutionDepthExceededError"
  | "RefResolutionDepthExceededError"
  | "ResolveRefError"
  | "UnexpectedError"
  | "UnsupportedRequestBodyContentTypeError";

class OpenApiTsRestError extends Error {
  public readonly code: OpenApiTsRestContractErrorCode;
  public readonly detail: string;

  constructor({ code, detail }: { code: OpenApiTsRestContractErrorCode; detail: string }) {
    super(detail);
    this.code = code;
    this.detail = detail;
  }
}

export function invalidStatusCodeError({
  method,
  path,
  statusCode,
}: {
  method: string;
  path: string;
  statusCode: string;
}): OpenApiTsRestError {
  return new OpenApiTsRestError({
    code: "InvalidStatusCodeError",
    detail: `Invalid status code at path ${method} ${path}: ${statusCode}`,
  });
}

export function invalidHttpMethodError({
  method,
  path,
}: {
  method: string;
  path: string;
}): OpenApiTsRestError {
  return new OpenApiTsRestError({
    code: "InvalidHttpMethodError",
    detail: `Invalid HTTP method at path ${path}: ${method}`,
  });
}

export function invalidRefError({ ref }: { ref: string }): OpenApiTsRestError {
  return new OpenApiTsRestError({
    code: "InvalidRefError",
    detail: `Invalid reference found: ${ref}`,
  });
}

export function resolveRefError({ ref }: { ref: string }): OpenApiTsRestError {
  return new OpenApiTsRestError({
    code: "ResolveRefError",
    detail: `Could not resolve component reference: ${ref}`,
  });
}

export function circularRefDependencyError({
  depsPath,
}: {
  depsPath: string[];
}): OpenApiTsRestError {
  return new OpenApiTsRestError({
    code: "CircularRefDependencyError",
    detail: `Circular reference detected: ${depsPath.join(" -> ")}`,
  });
}

export function notImplementedError({ detail }: { detail: string }): OpenApiTsRestError {
  return new OpenApiTsRestError({
    code: "NotImplementedError",
    detail,
  });
}

export function unexpectedError({ detail }: { detail: string }): OpenApiTsRestError {
  return new OpenApiTsRestError({
    code: "UnexpectedError",
    detail,
  });
}

export function missingSchemaInParameterObjectError({
  method,
  paramType,
  path,
}: {
  method: string;
  paramType: string;
  path: string;
}): OpenApiTsRestError {
  return new OpenApiTsRestError({
    code: "MissingSchemaInParameterObjectError",
    detail: `Missing schema in parameter ${paramType} at path ${method} ${path}`,
  });
}

export function unsupportedRequestBodyContentTypeError({
  contentType,
  method,
  path,
}: {
  contentType: string;
  method: string;
  path: string;
}): OpenApiTsRestError {
  return new OpenApiTsRestError({
    code: "UnsupportedRequestBodyContentTypeError",
    detail: `Unsupported content type at path ${method} ${path}: ${contentType}`,
  });
}

export function refResolutionDepthExceededError({ ref }: { ref: string }): OpenApiTsRestError {
  return new OpenApiTsRestError({
    code: "RefResolutionDepthExceededError",
    detail: `Ref resolution depth exceeded at ref: ${ref}\nThere might be a circular reference.`,
  });
}
