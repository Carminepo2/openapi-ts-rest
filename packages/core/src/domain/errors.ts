import { match } from "ts-pattern";

type OpenApiTsRestContractError =
  | {
      type: "InvalidStatusCode";
      payload: {
        statusCode: string;
        path: string;
        method: string;
      };
    }
  | {
      type: "InvalidHttpMethod";
      payload: {
        path: string;
        method: string;
      };
    };

export function throwError(error: OpenApiTsRestContractError): void {
  throw new Error(errorMessageMapper(error));
}

function errorMessageMapper(error: OpenApiTsRestContractError): string {
  return match(error)
    .with(
      { type: "InvalidStatusCode" },
      ({ payload }) => `Invalid status code at path ${payload.method} ${payload.path}: ${payload.statusCode}`
    )
    .with(
      { type: "InvalidHttpMethod" },
      ({ payload }) => `Invalid HTTP method at path ${payload.path}: ${payload.method}`
    )
    .exhaustive();
}
