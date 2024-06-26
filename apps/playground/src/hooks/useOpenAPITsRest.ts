import { generateContract } from "@openapi-ts-rest/core";
import jsYaml from "js-yaml";
import useSWRImmutable from "swr/immutable";

import { useDebounce } from "./useDebounce";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useOpenAPITsRest(openAPIDoc: string) {
  const debouncedOpenAPIDoc = useDebounce(openAPIDoc, 200);

  return useSWRImmutable(
    debouncedOpenAPIDoc,
    async (value) =>
      await generateContract({
        openApi: jsYaml.load(value) as string,
      }),
    { compare: (a, b) => a === b }
  );
}
