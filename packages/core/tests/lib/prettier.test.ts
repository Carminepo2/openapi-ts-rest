import { prettify } from "../../src/lib/prettier";

describe("prettify", () => {
  it("should prettify the input", async () => {
    const input = `const foo = 1;`;
    const expected = `const foo = 1;\n`;

    const result = await prettify(input);

    expect(result).toBe(expected);
  });

  it("should return the input if an error occurs", async () => {
    const result = await prettify(1 as unknown as string);

    expect(result).toBe(1);
  });
});
