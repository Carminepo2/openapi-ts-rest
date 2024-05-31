import type { OpenAPIComponentPath } from "../domain/types";

import { invalidRefError } from "../domain/errors";

/**
 * Validate and parse an OpenAPI ref string.
 *
 * @param ref - The OpenAPI ref string.
 * @returns The component name and component path.
 */
export function parseRef(ref: string): {
  componentName: string;
  componentPath: OpenAPIComponentPath;
} {
  const componentPaths: OpenAPIComponentPath[] = [
    "schemas",
    "parameters",
    "requestBodies",
    "responses",
    "headers",
  ];
  const isValid = componentPaths.some((componentPath) =>
    ref.startsWith(`#/components/${componentPath}/`)
  );

  if (!isValid) {
    throw invalidRefError({ ref });
  }

  const [
    _, // #/
    __, // components/
    componentPath, // "(schemas|parameters|requestBodies|responses|headers)/"
    componentName,
  ] = ref.split("/") as [string, string, OpenAPIComponentPath, string | undefined];

  if (!componentName) {
    throw invalidRefError({ ref });
  }

  return {
    componentName,
    componentPath,
  };
}
