import type { OpenAPIObject } from "openapi3-ts/oas30";

import { generateTsRestContractFromOpenAPI } from "@openapi-to-ts-rest/core";
import jsYaml from "js-yaml";
import useSWRImmutable from "swr/immutable";

import { useDebounce } from "./useDebounce";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useOpenAPITsRest(openAPIDoc: string) {
  const debouncedOpenAPIDoc = useDebounce(openAPIDoc, 200);

  return useSWRImmutable(
    debouncedOpenAPIDoc,
    async (value) =>
      await generateTsRestContractFromOpenAPI({
        input: jsYaml.load(value) as OpenAPIObject,
      }),
    {
      compare: (a, b) => a === b,
    }
  );
}
