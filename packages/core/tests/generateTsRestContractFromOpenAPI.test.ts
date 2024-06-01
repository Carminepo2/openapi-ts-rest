import { generateTsRestContractFromOpenAPI } from "../src/generateTsRestContractFromOpenAPI";

describe("generateTsRestContractFromOpenAPI", () => {
  it("should not throw", () => {
    expect(async () => {
      await generateTsRestContractFromOpenAPI({
        input:
          "https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/examples/v3.0/petstore.yaml",
      });
    }).not.toThrow();
  });
});
