import { schemaObjectToZodValidationChain } from "../../src/converters/schemaObjectToZodValidationChain";
import { tsArray, tsObject } from "../../src/lib/ts";

describe("schemaObjectToZodValidationChain", () => {
  it("should correctly get zod validations methods with string schema with minLenght validation", () => {
    const result = schemaObjectToZodValidationChain({
      minLength: 2,
      type: "string",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["min", 2]);
  });

  it("should correctly get zod validations methods with string schema with maxLenght validation", () => {
    const result = schemaObjectToZodValidationChain({
      maxLength: 2,
      type: "string",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["max", 2]);
  });

  it("should not set maxLenght nor minLenght validation is the string schema is an enum", () => {
    const result = schemaObjectToZodValidationChain({
      enum: ["a", "b"],
      maxLength: 2,
      minLength: 1,
      type: "string",
    });

    expect(result).toHaveLength(0);
  });

  it("should correctly get zod validations methods with string schema with regex validation", () => {
    const result = schemaObjectToZodValidationChain({
      pattern: "a\u0001b\u0008c\u007Fd\u009Fe\uFFFEf\uFFFFg",
      type: "string",
    });

    expect(result).toHaveLength(1);
    expect(result[0][0]).toEqual("regex");
  });

  it("should correctly get zod validations methods with string schema with regex validation", () => {
    const result = schemaObjectToZodValidationChain({
      pattern: "/a\u0001b\u0008c\u007Fd\u009Fe\uFFFEf\uFFFFg/",
      type: "string",
    });

    expect(result).toHaveLength(1);
    expect(result[0][0]).toEqual("regex");
  });

  it.each([
    ["uuid", ["uuid"]],
    ["hostname", ["url"]],
    ["uri", ["url"]],
    ["email", ["email"]],
    ["date-time", ["datetime", tsObject(["offset", true])]],
    ["ipv4", ["ip", tsObject(["version", "v4"])]],
    ["ipv6", ["ip", tsObject(["version", "v6"])]],
  ])(
    "should correctly transform a schema with %s formatting validation",
    (formatOption, expectedResult) => {
      const result = schemaObjectToZodValidationChain({
        format: formatOption,
        type: "string",
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expectedResult);
    }
  );

  it("should ignore unknown format validation options", () => {
    const result = schemaObjectToZodValidationChain({
      format: "unknown",
      type: "string",
    });

    expect(result).toHaveLength(0);
  });

  it("should correctly set default value for string schema", () => {
    const result = schemaObjectToZodValidationChain({
      default: "default",
      type: "string",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["default", "default"]);
  });

  it("should correctly get zod validations methods with a integer schema", () => {
    const result = schemaObjectToZodValidationChain({
      type: "integer",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["int"]);
  });

  it("should correctly get zod validations methods with a integer schema and a minimum value validation", () => {
    const result = schemaObjectToZodValidationChain({
      minimum: 2,
      type: "integer",
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(["int"]);
    expect(result[1]).toEqual(["gte", 2]);
  });

  it("should correctly get zod validations methods with a number schema and a minimum value validation", () => {
    const result = schemaObjectToZodValidationChain({
      minimum: 2,
      type: "number",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["gte", 2]);
  });

  it("should correctly get zod validations methods with a number schema and a minimum value validation", () => {
    const result = schemaObjectToZodValidationChain({
      minimum: 2,
      type: "number",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["gte", 2]);
  });

  it("should correctly get zod validations methods with a number schema and a exclusiveMinimum with a number value validation", () => {
    const result = schemaObjectToZodValidationChain({
      exclusiveMinimum: 2,
      type: "number",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["gt", 2]);
  });

  it("should correctly get zod validations methods with a number schema and a exclusiveMinimum with a boolean value validation", () => {
    const result = schemaObjectToZodValidationChain({
      exclusiveMinimum: true,
      minimum: 2,
      type: "number",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["gt", 2]);
  });

  it("should correctly get zod validations methods with a number schema and a maximum value validation", () => {
    const result = schemaObjectToZodValidationChain({
      maximum: 2,
      type: "number",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["lte", 2]);
  });

  it("should correctly get zod validations methods with a number schema and a exclusiveMaximum with a number value validation", () => {
    const result = schemaObjectToZodValidationChain({
      exclusiveMaximum: 2,
      type: "number",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["lt", 2]);
  });

  it("should correctly get zod validations methods with a number schema and a exclusiveMaximum with a boolean value validation", () => {
    const result = schemaObjectToZodValidationChain({
      exclusiveMaximum: true,
      maximum: 2,
      type: "number",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["lt", 2]);
  });

  it("should correctly get zod validations methods with a number schema and a multipleOf validation", () => {
    const result = schemaObjectToZodValidationChain({
      multipleOf: 2,
      type: "number",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["multipleOf", 2]);
  });

  it.each(["integer", "number"])(
    "should ignore all validations if the schema of type %s has an enum",
    (type) => {
      const result = schemaObjectToZodValidationChain({
        enum: ["a", "b"],
        maximum: 2,
        minimum: 1,
        multipleOf: 2,
        // @ts-expect-error @typescript-eslint/ban-ts-comment
        type,
      });

      expect(result).toHaveLength(0);
    }
  );

  it("should correctly set default value for number schema", () => {
    const result = schemaObjectToZodValidationChain({
      default: 1,
      type: "number",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["default", 1]);
  });

  it("should correctly set default value for integer schema", () => {
    const result = schemaObjectToZodValidationChain({
      default: 1,
      type: "integer",
    });

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual(["default", 1]);
  });

  it("should correctly set default value for boolean schema", () => {
    const result = schemaObjectToZodValidationChain({
      default: true,
      type: "boolean",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["default", true]);
  });

  it("should not set any default values for null or object schemas", () => {
    const resultNull = schemaObjectToZodValidationChain({
      default: null,
      type: "null",
    });
    const resultObj = schemaObjectToZodValidationChain({
      default: {},
      type: "object",
    });

    expect(resultNull).toHaveLength(0);
    expect(resultObj).toHaveLength(0);
  });

  it("should correctly get zod validations methods with an array schema and a minItems validation", () => {
    const result = schemaObjectToZodValidationChain({
      minItems: 2,
      type: "array",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["min", 2]);
  });

  it("should correctly get zod validations methods with an array schema and a maxItems validation", () => {
    const result = schemaObjectToZodValidationChain({
      maxItems: 2,
      type: "array",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["max", 2]);
  });

  it("should correctly set default value for array schema", () => {
    const result = schemaObjectToZodValidationChain({
      default: [1, 2, 3],
      type: "array",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["default", tsArray(1, 2, 3)]);
  });

  it("should not add any validation if the schema is not a string, number or array", () => {
    const result = schemaObjectToZodValidationChain({
      type: "object",
    });

    expect(result).toHaveLength(0);
  });

  it("should correctly add nullish validation if the schema is nullable but is not required", () => {
    const result = schemaObjectToZodValidationChain({
      nullable: true,
      type: "string",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["nullish"]);
  });

  it("should correctly add nullish validation if the schema is nullable but is required", () => {
    const result = schemaObjectToZodValidationChain(
      {
        nullable: true,
        type: "string",
      },
      { isRequired: true }
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["nullable"]);
  });

  it("should correctly add the correct validation if the schema is expressely not required", () => {
    const result = schemaObjectToZodValidationChain(
      {
        type: "string",
      },
      { isRequired: false }
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(["optional"]);
  });
});
