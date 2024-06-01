type OpenApiTsRestContractErrorCode =
  | "CircularRefDependencyError"
  | "InvalidHttpMethodError"
  | "InvalidRefError"
  | "InvalidStatusCodeError"
  | "ResolveRefError";

class RiskAnalysisTemplateIssue extends Error {
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
}): RiskAnalysisTemplateIssue {
  return new RiskAnalysisTemplateIssue({
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
}): RiskAnalysisTemplateIssue {
  return new RiskAnalysisTemplateIssue({
    code: "InvalidHttpMethodError",
    detail: `Invalid HTTP method at path ${path}: ${method}`,
  });
}

export function invalidRefError({ ref }: { ref: string }): RiskAnalysisTemplateIssue {
  return new RiskAnalysisTemplateIssue({
    code: "InvalidRefError",
    detail: `Invalid reference found: ${ref}`,
  });
}

export function resolveRefError({ ref }: { ref: string }): RiskAnalysisTemplateIssue {
  return new RiskAnalysisTemplateIssue({
    code: "ResolveRefError",
    detail: `Could not resolve reference: ${ref}`,
  });
}

export function circularRefDependencyError({
  depsPath,
}: {
  depsPath: string[];
}): RiskAnalysisTemplateIssue {
  return new RiskAnalysisTemplateIssue({
    code: "CircularRefDependencyError",
    detail: `Circular reference detected: ${depsPath.join(" -> ")}`,
  });
}
