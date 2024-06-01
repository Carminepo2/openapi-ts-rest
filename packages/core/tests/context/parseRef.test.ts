import { parseRef } from "../../src/context/parseRef";
import { invalidRefError } from "../../src/domain/errors";

describe("parseRef", () => {
  it.each([
    ["#/components/schemas/User", "schemas", "User"],
    ["#/components/parameters/User", "parameters", "User"],
    ["#/components/requestBodies/User", "requestBodies", "User"],
    ["#/components/responses/User", "responses", "User"],
    ["#/components/headers/User", "headers", "User"],
    ["#/components/pathItems/User", "pathItems", "User"],
  ])("should parse a valid ref", (ref, componentPath, componentName) => {
    const result = parseRef(ref);
    expect(result).toMatchObject({ componentName, componentPath });
  });

  it("should throw an error for an invalid ref", () => {
    const ref = "#/components/invalid/User";
    expect(() => parseRef(ref)).toThrowError(invalidRefError({ ref }));

    const ref2 = "#/components/headers/";
    expect(() => parseRef(ref2)).toThrowError(invalidRefError({ ref: ref2 }));
  });
});
