import { invalidRefError } from "../../src/domain/errors";
import { validateRef } from "../../src/domain/validators";

describe("validators", () => {
  describe("validateRef", () => {
    it("should validate a valid ref", () => {
      const ref = "#/components/schemas/User";
      expect(() => validateRef(ref)).not.toThrow();
    });

    it("should throw an error if the there is an invalid component type", () => {
      const ref = "#/components/invalid/User";
      expect(() => validateRef(ref)).toThrowError(invalidRefError({ ref }));
    });

    it("should throw an error if there is no identifier", () => {
      const ref = "#/components/schemas";
      expect(() => validateRef(ref)).toThrowError(invalidRefError({ ref }));
    });
  });
});
