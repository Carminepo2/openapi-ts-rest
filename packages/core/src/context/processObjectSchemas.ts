import {
  type ComponentsObject,
  type OpenAPIObject,
  type ReferenceObject,
  type SchemaObject,
  isReferenceObject,
} from "openapi3-ts/oas30";

import type { ObjectSchemaMeta } from "../domain/types";

import { formatToIdentifierString, topologicalSort } from "../lib/utils";
import { parseRef } from "./parseRef";

export function processObjectSchemas(
  openAPIDoc: OpenAPIObject,
  getSchemaByRef: (ref: string) => SchemaObject
): {
  schemasToExportMap: Map<string, ObjectSchemaMeta>;
  topologicallySortedSchemas: ObjectSchemaMeta[];
} {
  const graph = createSchemaComponentsDependencyGraph(
    openAPIDoc.components?.schemas,
    getSchemaByRef
  );
  const topologicallySortedSchemaRefs = topologicalSort(graph);

  const schemasToExportMap = new Map<string, ObjectSchemaMeta>();

  const topologicallySortedSchemas: ObjectSchemaMeta[] = topologicallySortedSchemaRefs.map(
    (ref) => {
      const { componentName: identifier } = parseRef(ref);
      const schema = getSchemaByRef(ref);
      const normalizedIdentifier = formatToIdentifierString(identifier);

      const componentMeta: ObjectSchemaMeta = { identifier, normalizedIdentifier, ref, schema };

      // TODO: The schemas should be exported? Or only the ones that are referenced by operations?
      // The current implementation exports all schemas.
      schemasToExportMap.set(ref, componentMeta);
      return componentMeta;
    }
  );

  return {
    schemasToExportMap,
    topologicallySortedSchemas,
  };
}

function createSchemaComponentsDependencyGraph(
  schemaComponents: ComponentsObject["schemas"],
  getSchemaByRef: (ref: string) => SchemaObject
): Record<string, Set<string>> {
  const graph: Record<string, Set<string>> = {};
  const visitedRefs: Record<string, boolean> = {};

  function visit(component: ReferenceObject | SchemaObject, fromRef: string): void {
    if (isReferenceObject(component)) {
      if (!(fromRef in graph)) {
        graph[fromRef] = new Set();
      }

      graph[fromRef].add(component.$ref);

      if (visitedRefs[component.$ref]) return;

      visitedRefs[fromRef] = true;
      visit(getSchemaByRef(component.$ref), component.$ref);
      return;
    }

    (["allOf", "oneOf", "anyOf"] as const satisfies Array<keyof SchemaObject>).forEach((key) => {
      component[key]?.forEach((subComponent) => {
        visit(subComponent, fromRef);
      });
    });

    if (component.type === "array" && component.items) {
      visit(component.items, fromRef);
      return;
    }

    if (component.type === "object" || component.properties || component.additionalProperties) {
      if (component.properties) {
        Object.values(component.properties).forEach((component) => {
          visit(component, fromRef);
        });
      }

      if (component.additionalProperties && typeof component.additionalProperties === "object") {
        visit(component.additionalProperties, fromRef);
      }
    }
  }

  if (schemaComponents) {
    Object.entries(schemaComponents).forEach(([name, schema]) => {
      visit(schema, `#/components/schemas/${name}`);
    });
  }

  return graph;
}
