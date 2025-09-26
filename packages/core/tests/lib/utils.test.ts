import { describe, expect, it } from "vitest";

import { invalidRefError } from "../../src/domain/errors";
import { tsArray, tsObject } from "../../src/lib/ts";
import {
  AstTsWriter,
  astToString,
  convertPathToVariableName,
  formatToIdentifierString,
  generatePowerset,
  noop,
  parseRefComponents,
} from "../../src/lib/utils";

describe("utils", () => {
  describe("formatToIdentifierString", () => {
    it("should format a string to a valid javascript identifier string", () => {
      expect(formatToIdentifierString("")).toBe("_");
      expect(formatToIdentifierString("1")).toBe("_1");
      expect(formatToIdentifierString("a")).toBe("a");
      expect(formatToIdentifierString("a1")).toBe("a1");
      expect(formatToIdentifierString("a_")).toBe("a_");
      expect(formatToIdentifierString("a$")).toBe("a$");
      expect(formatToIdentifierString("a_1")).toBe("a_1");
      expect(formatToIdentifierString("a$1")).toBe("a$1");
      expect(formatToIdentifierString("a$1_")).toBe("a$1_");
      expect(formatToIdentifierString("a$1_ ")).toBe("a$1__");
      expect(formatToIdentifierString("a$1_ 2")).toBe("a$1__2");
      expect(formatToIdentifierString(" a$1_2")).toBe("_a$1_2");
      expect(formatToIdentifierString("1")).toBe("_1");
      expect(formatToIdentifierString("$")).toBe("$");
      expect(formatToIdentifierString("_")).toBe("_");
      expect(formatToIdentifierString("1$")).toBe("_1$");
      expect(formatToIdentifierString("1_")).toBe("_1_");
      expect(formatToIdentifierString("$1")).toBe("$1");
      expect(formatToIdentifierString("_1")).toBe("_1");
    });
  });

  describe("convertPathToVariableName", () => {
    it("should convert a path to a valid javascript identifier string", () => {
      expect(convertPathToVariableName("/hello")).toBe("hello");
      expect(convertPathToVariableName("/hello/world")).toBe("helloWorld");
      expect(convertPathToVariableName("/hello/world/{id}")).toBe("helloWorldId");
      expect(convertPathToVariableName("/hello/world/{id}/text.it")).toBe("helloWorldIdTextIt");
      expect(convertPathToVariableName("/hello/world/{id}/{id2}/{id3}/.txt")).toBe(
        "helloWorldIdId2Id3Txt"
      );
    });
  });

  describe("parseRefComponents", () => {
    it.each([
      ["#/components/schemas/User", "schemas", "User"],
      ["#/components/parameters/User", "parameters", "User"],
      ["#/components/requestBodies/User", "requestBodies", "User"],
      ["#/components/responses/User", "responses", "User"],
      ["#/components/headers/User", "headers", "User"],
      ["#/components/pathItems/User", "pathItems", "User"],
    ])("should parse a valid ref", (ref, type, identifier) => {
      const result = parseRefComponents(ref);
      expect(result).toMatchObject({ identifier, type });
    });

    it("should throw an error if the ref is invalid", () => {
      const ref = "#/components/schemas";
      expect(() => parseRefComponents(ref)).toThrowError(invalidRefError({ ref }));
    });
  });

  describe("noop", () => {
    it("should return undefined", () => {
      expect(noop()).toBeUndefined();
    });
  });

  describe("astToString", () => {
    it("should convert an AST to a string", () => {
      const ast = tsObject();
      expect(astToString(ast)).toBe("{}\n");
    });

    it("should decode unicode escape sequences", () => {
      const stringLiteral = tsObject(["summary", "\u3053\u3093\u306b\u3061\u306f"]);
      const result = astToString(stringLiteral);
      expect(result).toStrictEqual(`{ "summary": "こんにちは" }\n`);
    });
  });

  describe("AstTsWriter", () => {
    it("should correctly write an array of AST nodes", () => {
      const astWriter = new AstTsWriter();
      astWriter.add(tsObject());
      astWriter.add(tsArray());
      expect(astWriter.toString()).toBe("{}\n[]\n");
    });
  });

  describe("generatePowerset", () => {
    it("should generate the powerset of a set", () => {
      const set = [1, 2, 3];
      const powerset = generatePowerset(set);
      expect(powerset).toEqual([[], [1], [2], [1, 2], [3], [1, 3], [2, 3], [1, 2, 3]]);
    });

    it("should generate the powerset of an empty array", () => {
      const set: number[] = [];
      const powerset = generatePowerset(set);
      expect(powerset).toEqual([[]]);
    });
  });
});
