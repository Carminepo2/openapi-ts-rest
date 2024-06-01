import { type ReferenceObject, type SchemaObject, isReferenceObject } from "openapi3-ts/oas30";

import type { Context } from "./context";
import type { ObjectSchemaMeta } from "./domain/types";

export function processSchemasForExport(ctx: Context): ObjectSchemaMeta[] {
  const graph = createSchemaComponentsDependencyGraph(ctx);
  const topologicallySortedRefs = topologicalSort(graph);

  return topologicallySortedRefs
    .map((ref) => ctx.exportedComponentSchemasMap.get(ref))
    .filter((schema): schema is NonNullable<ObjectSchemaMeta> => schema !== undefined);
}

function createSchemaComponentsDependencyGraph(ctx: Context): Record<string, Set<string>> {
  const graph: Record<string, Set<string>> = {};
  const visitedRefs: Record<string, boolean> = {};

  const getSchemaByRef = ctx.resolveRef<SchemaObject>;
  const schemaComponents = ctx.openAPIDoc.components?.schemas;

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

/**
 * Performs a topological sort on a directed graph.
 *
 * A topological sort is used here to sort the components in an OpenAPI schema in the correct order.
 * Meaning that if a component depends on another component, the dependent component will be sorted after the dependency.
 * So, the components can be generated in the correct order.
 *
 * @param graph - The graph to sort, represented as an adjacency list.
 *
 * @returns An array of vertices in topologically sorted order.
 *
 * @example
 * const graph = {
 *   a: ['b', 'c'],
 *   b: ['d'],
 *   c: [],
 *   d: []
 * };
 * const sorted = topologicalSort(graph);
 * console.log(sorted); // Output: ['a', 'c', 'b', 'd']
 */
export function topologicalSort(graph: Record<string, Set<string>>): string[] {
  const sorted = new Set<string>();
  const visited: Record<string, boolean> = {};

  function visit(name: string, ancestors: Set<string>): void {
    ancestors.add(name);
    visited[name] = true;

    const node = graph[name] as Set<string> | undefined;

    if (node) {
      node.forEach((dep) => {
        if (ancestors.has(dep)) {
          // Handle circular dependencies
          return;
        }
        if (visited[dep]) return;
        visit(dep, ancestors);
      });
    }

    sorted.add(name);
  }

  Object.keys(graph).forEach((name) => {
    if (!visited[name]) {
      visit(name, new Set());
    }
  });

  return Array.from(sorted);
}
