#!/usr/bin/env node

import { Command } from "@commander-js/extra-typings";
import { generateContract } from "@openapi-ts-rest/core";
import { writeFileSync } from "fs";
import prettier from "prettier";

import packageJson from "../package.json";

const program = new Command();

program
  .version(packageJson.version)
  .description("Generates a ts-rest contract from an OpenAPI schema.")
  .argument("<openApi>", "The OpenAPI schema file.")
  .requiredOption("-o, --output <output>", "The output file.")
  .action(async (openApi, { output }) => {
    const prettierConfig = await prettier.resolveConfig("./");

    const result = await generateContract({
      openApi,
      prettierConfig,
    });

    writeFileSync(output, result);
  })
  .parse(process.argv);
