import { isReferenceObject, type OpenAPIObject, type ReferenceObject, type SchemaObject } from "openapi3-ts/oas30";

export function createDependencyGraph(
  openApiDoc: OpenAPIObject,
  getSchemaByRef: (ref: string) => SchemaObject
): Record<string, Set<string>> {
  const graph: Record<string, Set<string>> = {};
  const visitedRefs: Record<string, boolean> = {};

  function visit(component: SchemaObject | ReferenceObject, fromRef: string): void {
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

    (["allOf", "oneOf", "anyOf"] as const satisfies (keyof SchemaObject)[]).forEach((key) => {
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

  if (openApiDoc.components?.schemas) {
    Object.entries(openApiDoc.components.schemas).forEach(([name, schema]) => {
      visit(schema, `#/components/schemas/${name}`);
    });
  }

  return graph;
}
