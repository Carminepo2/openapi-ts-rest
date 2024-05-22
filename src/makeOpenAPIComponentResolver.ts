import {
  type HeadersObject,
  type OpenAPIObject,
  type ParameterObject,
  type ReferenceObject,
  type RequestBodyObject,
  type ResponsesObject,
  type SchemaObject,
  isReferenceObject,
} from "openapi3-ts/oas30";

const OPEN_API_COMPONENTS_PATH = ["schemas", "parameters", "requestBodies", "responses", "headers"] as const;

type OpenAPIComponentPath = (typeof OPEN_API_COMPONENTS_PATH)[number];
type OpenAPIComponents = SchemaObject | ParameterObject | RequestBodyObject | ResponsesObject | HeadersObject;

export function makeOpenAPIComponentResolver(
  doc: OpenAPIObject
): <TComponent extends OpenAPIComponents>(
  parameter: TComponent | ReferenceObject,
  resolvedRefs?: Set<string>
) => TComponent {
  return function resolveOpenAPIComponent<TComponent extends OpenAPIComponents>(
    parameter: TComponent | ReferenceObject,
    resolvedRefs = new Set<string>()
  ) {
    if (isReferenceObject(parameter)) {
      const ref = parameter.$ref;

      assertRefIsValid(ref);

      // If this reference has already been resolved, throw an error to avoid infinite recursion
      if (resolvedRefs.has(ref)) {
        throw new Error(`Circular reference detected: ${ref}`);
      }

      resolvedRefs.add(ref);

      const [
        _, // "#/"
        __, // "components/"
        componentPath, // "(schemas|parameters|requestBodies|responses|headers)/"
        componentName,
      ] = ref.split("/") as [string, string, OpenAPIComponentPath, string];

      const parameterObject = doc.components?.[componentPath]?.[componentName] as TComponent | undefined;

      if (isReferenceObject(parameterObject)) {
        return resolveOpenAPIComponent(parameterObject, resolvedRefs);
      }

      if (!parameterObject) {
        throw new Error(`Could not resolve ${componentName} at ${ref}`);
      }

      return parameterObject;
    }
    return parameter;
  };
}

export function assertRefIsValid(ref: string): asserts ref is `#/components/${OpenAPIComponentPath}/${string}` {
  const isValid = OPEN_API_COMPONENTS_PATH.some((componentPath) => {
    return ref.startsWith(`#/components/${componentPath}/`);
  });
  if (!isValid) {
    throw new Error(`Invalid reference ${ref}`);
  }
}
