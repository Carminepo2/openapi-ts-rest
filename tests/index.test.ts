import { describe, it, expect } from "vitest";
import { generateTsRestContractFromOpenAPI } from "../src";

describe("generateTsRestContractFromOpenAPI", () => {
  it("should not throw", () => {
    expect(async () => {
      await generateTsRestContractFromOpenAPI({
        input: "https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/examples/v3.0/petstore.yaml",
      });
    }).not.toThrow();
  });
});
