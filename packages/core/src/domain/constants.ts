/*
 * Common HTTP status codes. We will use them to output the status code in
 * the contract when an openapi response object has the "default" status code
 * or a range of status codes (2XX, 3XX etc...).
 * Example, if the openapi response object has the "default" status code, we will output
 * every status code in the contract in the STATUS_CODES_OUTPUT array.
 * */
export const POSSIBLE_STATUS_CODES_TS_REST_OUTPUT = [
  "200",
  "201",
  "204",
  "400",
  "401",
  "403",
  "404",
  "405",
  "409",
  "415",
  "500",
] as const;

/**
 * ts-rest supports the following content types for the response body
 */
export const TS_REST_RESPONSE_BODY_SUPPORTED_CONTENT_TYPES = [
  "application/json",
  "multipart/form-data",
  "application/x-www-form-urlencoded",
] as const;
