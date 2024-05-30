/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {
  type ComponentsObject,
  type HeadersObject,
  type OpenAPIObject,
  type ParameterObject,
  type ReferenceObject,
  type RequestBodyObject,
  type ResponseObject,
  type SchemaObject,
  isReferenceObject,
} from "openapi3-ts/oas30";

import { formatToIdentifierString, topologicalSort } from "./lib/utils";

const OPEN_API_COMPONENTS_PATH = [
  "schemas",
  "parameters",
  "requestBodies",
  "responses",
  "headers",
] as const;
type OpenAPIComponentPath = (typeof OPEN_API_COMPONENTS_PATH)[number];
type OpenAPIObjectComponent =
  | HeadersObject
  | ParameterObject
  | RequestBodyObject
  | ResponseObject
  | SchemaObject;

export function generateContext(openAPIDoc: OpenAPIObject) {
  const getObjectByRef = <TObjectComponent extends OpenAPIObjectComponent>(
    ref: string,
    depth = 0
  ): TObjectComponent => {
    const { componentName, componentPath } = validateAndParseRef(ref);
    const schemaObject = openAPIDoc.components?.[componentPath]?.[componentName];

    if (!componentName || !schemaObject || depth > 100) {
      throw new Error(`Could not parse component name from ref: ${ref}`);
    }

    if (isReferenceObject(schemaObject)) {
      return getObjectByRef<TObjectComponent>(schemaObject.$ref, depth + 1);
    }

    return schemaObject as TObjectComponent;
  };

  const resolveObject = <TObjectComponent extends OpenAPIObjectComponent>(
    refOrObject: ReferenceObject | TObjectComponent,
    resolvedRefs = new Set<string>()
  ): TObjectComponent => {
    if (!isReferenceObject(refOrObject)) return refOrObject;

    const ref = refOrObject.$ref;
    const component = getObjectByRef<TObjectComponent>(ref);

    if (isReferenceObject(component)) {
      return resolveObject<TObjectComponent>(component, resolvedRefs);
    }

    return component;
  };

  const getSchemaByRef = getObjectByRef<SchemaObject>;

  const graph = createSchemaComponentsDependencyGraph(
    openAPIDoc.components?.schemas,
    getSchemaByRef
  );
  const topologicallySortedSchemaRefs = topologicalSort(graph);

  const schemasToExportMap = new Map<
    string,
    {
      identifier: string;
      normalizedIdentifier: string;
      ref: string;
      schema: SchemaObject;
    }
  >();

  const topologicallySortedSchemas = topologicallySortedSchemaRefs.map((ref) => {
    const { componentName: identifier } = validateAndParseRef(ref);
    const schema = getSchemaByRef(ref);
    const normalizedIdentifier = formatToIdentifierString(identifier);

    const componentMeta = { identifier, normalizedIdentifier, ref, schema };

    // TODO: The schemas should be exported? Or only the ones that are referenced by operations?
    // The current implementation exports all schemas.
    schemasToExportMap.set(ref, componentMeta);
    return componentMeta;
  });

  return {
    getHeaderByRef: getObjectByRef<HeadersObject>,
    getParameterByRef: getObjectByRef<ParameterObject>,
    getRequestBodyByRef: getObjectByRef<RequestBodyObject>,
    getResponseByRef: getObjectByRef<ResponseObject>,
    getSchemaByRef,
    openAPIDoc,

    resolveHeaderObject: resolveObject<HeadersObject>,
    resolveParameterObject: resolveObject<ParameterObject>,
    resolveRequestBodyObject: resolveObject<RequestBodyObject>,
    resolveResponseObject: resolveObject<ResponseObject>,
    resolveSchemaObject: resolveObject<SchemaObject>,

    schemasToExportMap,
    topologicallySortedSchemas,
  };
}

export type Context = ReturnType<typeof generateContext>;

function validateAndParseRef(ref: string): {
  componentName: string;
  componentPath: OpenAPIComponentPath;
} {
  const isValid = OPEN_API_COMPONENTS_PATH.some((componentPath) =>
    ref.startsWith(`#/components/${componentPath}/`)
  );

  if (!isValid) {
    throw new Error(`Invalid reference found: ${ref}`);
  }

  const [
    _, // #/
    __, // components/
    componentPath, // "(schemas|parameters|requestBodies|responses|headers)/"
    componentName,
  ] = ref.split("/") as [string, string, OpenAPIComponentPath, string];

  return {
    componentName,
    componentPath,
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
