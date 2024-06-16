import { type OpenAPIObject, type SchemaObject } from "openapi3-ts";

import type { ObjectSchemaMeta } from "../domain/types";

import { formatToIdentifierString, parseRefComponents } from "../lib/utils";

export function processObjectSchemas(
  openAPIDoc: OpenAPIObject,
  getSchemaByRef: (ref: string) => SchemaObject
): {
  componentSchemasMap: Map<string, ObjectSchemaMeta>;
} {
  return {
    componentSchemasMap: new Map(
      Object.keys(openAPIDoc.components?.schemas ?? [])
        .map((c) => `#/components/schemas/${c}`)
        .map((ref) => {
          const schema = getSchemaByRef(ref);
          const { identifier } = parseRefComponents(ref);
          const normalizedIdentifier = formatToIdentifierString(identifier);
          return [
            ref,
            {
              identifier,
              normalizedIdentifier,
              ref,
              schema,
            },
          ];
        })
    ),
  };
}
