import { type OpenAPIObject, type SchemaObject } from "openapi3-ts";

import type { ObjectSchemaMeta } from "../domain/types";

import { formatToIdentifierString, parseRefComponents } from "../lib/utils";

export function processObjectSchemas(
  openAPIDoc: OpenAPIObject,
  getSchemaByRef: (ref: string) => SchemaObject
): {
  exportedComponentSchemasMap: Map<string, ObjectSchemaMeta>;
} {
  const exportedComponentSchemasMap = new Map<string, ObjectSchemaMeta>();
  const componentRefs = Object.keys(openAPIDoc.components?.schemas ?? []).map(
    (c) => `#/components/schemas/${c}`
  );

  componentRefs.forEach((ref) => {
    const { identifier } = parseRefComponents(ref);
    const schema = getSchemaByRef(ref);
    const normalizedIdentifier = formatToIdentifierString(identifier);
    const componentMeta: ObjectSchemaMeta = { identifier, normalizedIdentifier, ref, schema };
    exportedComponentSchemasMap.set(ref, componentMeta);
  });

  return {
    exportedComponentSchemasMap,
  };
}
