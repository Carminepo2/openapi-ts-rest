import { generateTsRestContractFromOpenAPI } from "@openapi-to-ts-rest/core";
import jsYaml from "js-yaml";
import useSWRImmutable from "swr/immutable";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useOpenAPITsRest(openaAPIDoc: string) {
  return useSWRImmutable(
    openaAPIDoc,
    async (value) => {
      const specObj = jsYaml.load(value) as string;
      return await generateTsRestContractFromOpenAPI({
        input: specObj,
      });
    },
    {
      compare: (a, b) => a === b,
    }
  );
}
