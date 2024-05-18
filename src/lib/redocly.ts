import { Readable } from "node:stream";
import {
  BaseResolver,
  bundle,
  makeDocumentFromString,
  Source,
  type Document,
  lintDocument,
  createConfig,
  type NormalizedProblem,
} from "@redocly/openapi-core";
import { fileURLToPath } from "node:url";
import parseJson from "parse-json";
import { match, P } from "ts-pattern";
import type { OpenAPIObject } from "openapi3-ts/oas30";

export async function validateAndBundleOpenAPISchema(
  source: string | URL | OpenAPIObject | Readable | Buffer
): Promise<OpenAPIObject> {
  let absoluteRef = fileURLToPath(new URL(`file://${process.cwd()}/`));
  if (source instanceof URL) {
    absoluteRef = source.protocol === "file:" ? fileURLToPath(source) : source.href;
  }

  const redocConfig = await createConfig(
    {
      rules: {
        "operation-operationId-unique": { severity: "error" }, // throw error on duplicate operationIDs
      },
    },
    { extends: ["minimal"] }
  );

  const resolver = new BaseResolver(redocConfig.resolve);
  const document = await parseSchema(source, {
    absoluteRef,
    resolver,
  });

  validateOpenAPIVersion(document);

  const problems = await lintDocument({
    document,
    config: redocConfig.styleguide,
    externalRefResolver: resolver,
  });
  resolveProblems(problems);

  const bundled = await bundle({
    config: redocConfig,
    dereference: false,
    doc: document,
  });
  resolveProblems(bundled.problems);
  return bundled.bundle.parsed as OpenAPIObject;
}

async function parseSchema(
  schema: unknown,
  {
    absoluteRef,
    resolver,
  }: {
    absoluteRef: string;
    resolver: BaseResolver;
  }
): Promise<Document> {
  return await match(schema)
    .with(P.instanceOf(URL), async () => {
      const result = await resolver.resolveDocument(null, absoluteRef, true);
      if ("parsed" in result) {
        return result;
      }
      throw result.originalError;
    })
    .with(P.instanceOf(Readable), async (schema) => {
      const contents = await new Promise<string>((resolve) => {
        schema.resume();
        schema.setEncoding("utf8");
        let content = "";
        schema.on("data", (chunk: string) => {
          content += chunk;
        });
        schema.on("end", () => {
          resolve(content.trim());
        });
      });
      return parseSchema(contents, { absoluteRef, resolver });
    })
    .with(P.instanceOf(Buffer), (schema) => parseSchema(schema.toString("utf8"), { absoluteRef, resolver }))
    .with(P.string, (schema) => {
      // URL
      if (schema.startsWith("http://") || schema.startsWith("https://") || schema.startsWith("file://")) {
        const url = new URL(schema);
        return parseSchema(url, {
          absoluteRef: url.protocol === "file:" ? fileURLToPath(url) : url.href,
          resolver,
        });
      }
      // JSON
      if (schema[0] === "{") {
        return {
          source: new Source(absoluteRef, schema, "application/json"),
          parsed: parseJson(schema),
        };
      }
      // YAML
      return makeDocumentFromString(schema, absoluteRef);
    })
    .when(
      () => typeof schema === "object" && !Array.isArray(schema),
      () => ({
        source: new Source(absoluteRef, JSON.stringify(schema), "application/json"),
        parsed: schema,
      })
    )
    .otherwise(() => {
      throw new Error(`Expected string, object, or Buffer. Got ${Array.isArray(schema) ? "Array" : typeof schema}`);
    });
}

function validateOpenAPIVersion(document: Document) {
  const openapiVersion = Number.parseFloat(document.parsed.openapi);
  const { swagger, openapi } = document.parsed;

  if (swagger) {
    throw new Error("Swagger version 2.x is not supported. Please use OpenAPI 3.x.");
  }

  if (!openapi || Number.isNaN(openapiVersion) || openapiVersion < 3 || openapiVersion >= 4) {
    if (openapi || openapiVersion < 3 || openapiVersion >= 4) {
      throw new Error(`OpenAPI version ${openapi} is not supported.`);
    }
    throw new Error("Invalid schema format. Expected `openapi: 3.x`.");
  }
}

function resolveProblems(problems: NormalizedProblem[]) {
  if (!problems.length) return;

  const errors = problems.filter((p) => p.severity === "error");
  const warnings = problems.filter((p) => p.severity === "warn");

  if (warnings.length) {
    for (const warning of warnings) {
      console.warn(warning.message);
    }
  }

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
}
