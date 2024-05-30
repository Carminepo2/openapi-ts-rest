import { Command } from "@commander-js/extra-typings";
import { generateTsRestContractFromOpenAPI } from "@openapi-to-ts-rest/core";
import { writeFileSync } from "fs";
import prettier from "prettier";

const program = new Command();

program
  .description("Generates a ts-rest contract from an OpenAPI schema.")
  .requiredOption("-i, --input <input>", "The input OpenAPI schema file.")
  .requiredOption("-o, --output <output>", "The output file.")
  .action(async ({ input, output }) => {
    const prettierConfig = await prettier.resolveConfig("./");

    const result = await generateTsRestContractFromOpenAPI({
      input,
      prettierConfig,
    });

    writeFileSync(output, result);
  })
  .parse(process.argv);
