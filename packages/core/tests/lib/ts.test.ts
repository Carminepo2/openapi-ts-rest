import { type Node, NodeFlags, isExpression } from "typescript";

import {
  tsArray,
  tsChainedMethodCall,
  tsFunctionCall,
  tsIdentifier,
  tsKeyword,
  tsLiteralOrExpression,
  tsNamedExport,
  tsNamedImport,
  tsNewLine,
  tsObject,
  tsRegex,
  tsVariableDeclaration,
} from "../../src/lib/ts";
import { astToString } from "../../src/lib/utils";

const prepareForSnapshot = (ts: Node): string => astToString(ts).trim();

describe("ts", () => {
  describe("tsNamedImport", () => {
    it("should create a named import statement", () => {
      const result = tsNamedImport({ from: "./module", import_: ["foo", "bar"] });
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(
        `"import { foo, bar } from "./module";"`
      );
    });

    it("should create a named import statement with a single import", () => {
      const result = tsNamedImport({ from: "./module", import_: ["foo"] });
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"import { foo } from "./module";"`);
    });

    it("should create a named import statement with no imports", () => {
      const result = tsNamedImport({ from: "./module", import_: [] });
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"import {} from "./module";"`);
    });
  });

  describe("tsNamedExport", () => {
    it("should create a named export statement", () => {
      const result = tsNamedExport({ export_: ["foo", "bar"] });
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"export { foo, bar };"`);
    });

    it("should create a named export statement with a single export", () => {
      const result = tsNamedExport({ export_: ["foo"] });
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"export { foo };"`);
    });

    it("should create a named export statement with no exports", () => {
      const result = tsNamedExport({ export_: [] });
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"export {};"`);
    });
  });

  describe("tsLiteralOrExpression", () => {
    it("should convert any primitive values to an ast literal expression", () => {
      const result = tsLiteralOrExpression("foo");
      expect(isExpression(result)).toBeTruthy();
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`""foo""`);

      const result2 = tsLiteralOrExpression(42);
      expect(isExpression(result2)).toBeTruthy();
      expect(prepareForSnapshot(result2)).toMatchInlineSnapshot(`"42"`);

      const result3 = tsLiteralOrExpression(-42);
      expect(isExpression(result3)).toBeTruthy();
      expect(prepareForSnapshot(result3)).toMatchInlineSnapshot(`"-42"`);

      const result4 = tsLiteralOrExpression(true);
      expect(isExpression(result4)).toBeTruthy();
      expect(prepareForSnapshot(result4)).toMatchInlineSnapshot(`"true"`);

      const result5 = tsLiteralOrExpression(false);
      expect(isExpression(result5)).toBeTruthy();
      expect(prepareForSnapshot(result5)).toMatchInlineSnapshot(`"false"`);

      const result6 = tsLiteralOrExpression(null);
      expect(isExpression(result6)).toBeTruthy();
      expect(prepareForSnapshot(result6)).toMatchInlineSnapshot(`"null"`);
    });

    it("should return the input if it's already an expression", () => {
      const result = tsLiteralOrExpression(tsObject());
      expect(isExpression(result)).toBeTruthy();
    });
  });

  describe("tsKeyword", () => {
    it.each([
      ["var", NodeFlags.None],
      ["const", NodeFlags.Const],
      ["let", NodeFlags.Let],
    ] as const)(`should return the correct node flag for the keyword "%s"`, (keyword, expected) => {
      const result = tsKeyword(keyword);
      expect(result).toBe(expected);
    });
  });

  describe("tsVariableDeclaration", () => {
    it("should create a variable declaration statement with the var keyword", () => {
      const result = tsVariableDeclaration("var", "foo", { eq: "bar" });
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"var foo = "bar";"`);
    });

    it("should create a variable declaration statement with the let keyword", () => {
      const result = tsVariableDeclaration("let", "foo", { eq: "bar" });
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"let foo = "bar";"`);
    });

    it("should create a variable declaration statement with the const keyword", () => {
      const result = tsVariableDeclaration("const", "foo", { eq: "bar" });
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"const foo = "bar";"`);
    });

    it("should create a variable declaration statement with an expression", () => {
      const result = tsVariableDeclaration("let", "foo", { eq: tsObject() });
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"let foo = {};"`);
    });

    it("should create a variable declaration statement with a function call and an export", () => {
      const result = tsVariableDeclaration("var", "foo", {
        eq: tsFunctionCall("fn", "arg"),
        export_: true,
      });
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"export var foo = fn("arg");"`);
    });
  });

  describe("tsFunctionCall", () => {
    it("should create a function call expression", () => {
      const result = tsFunctionCall("foo", "bar", "baz");
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"foo("bar", "baz")"`);
    });

    it("should create a function call expression with no arguments", () => {
      const result = tsFunctionCall("foo");
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"foo()"`);
    });
  });

  describe("tsObject", () => {
    it("should create an object literal expression", () => {
      const result = tsObject(["foo", "bar"], ["baz", 42]);
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"{ "foo": "bar", "baz": 42 }"`);
    });

    it("should create an object literal expression with no properties", () => {
      const result = tsObject();
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"{}"`);
    });

    it("should create a complex object with nested objects and arrays", () => {
      const result = tsObject(
        ["foo", tsObject(["bar", tsArray("baz", tsFunctionCall("fn", "arg"))])],
        [
          "qux",
          tsArray(tsObject(["quux", "quuz"], ["corge", tsFunctionCall("fn", "arg", tsObject())])),
        ]
      );
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(
        `"{ "foo": { "bar": ["baz", fn("arg")] }, "qux": [{ "quux": "quuz", "corge": fn("arg", {}) }] }"`
      );
    });
  });

  describe("tsArray", () => {
    it("should create an array literal expression", () => {
      const result = tsArray("foo", "bar", 42, tsObject());
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"["foo", "bar", 42, {}]"`);
    });

    it("should create an array literal expression with no elements", () => {
      const result = tsArray();
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"[]"`);
    });
  });

  describe("tsChainedMethodCall", () => {
    it("should create a chained method call expression", () => {
      const result = tsChainedMethodCall(
        "foo",
        ["bar", 1],
        ["baz", tsObject()],
        ["qux", tsArray("quux")]
      );
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(
        `"foo.bar(1).baz({}).qux(["quux"])"`
      );
    });
  });

  describe("tsNewLine", () => {
    it("should create a new line", () => {
      const result = tsNewLine();
      expect(astToString(result)).toMatchInlineSnapshot(`
        "
        "
      `);
    });
  });

  describe("tsIdentifier", () => {
    it("should create an identifier", () => {
      const result = tsIdentifier("foo");
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"foo"`);
    });
  });

  describe("tsRegex", () => {
    it("should create a regex literal expression", () => {
      const result = tsRegex("/.*/");
      expect(prepareForSnapshot(result)).toMatchInlineSnapshot(`"/.*/"`);
    });
  });
});
