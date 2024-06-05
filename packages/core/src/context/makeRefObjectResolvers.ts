import { type OpenAPIObject, type ReferenceObject, isReferenceObject } from "openapi3-ts";

import type { OpenAPIObjectComponent } from "../domain/types";

import { refResolutionDepthExceededError, resolveRefError } from "../domain/errors";
import { parseRefComponents } from "../lib/utils";

/**
 * Create a function that resolves OpenAPI refs.
 *
 * @param openAPIDoc - The OpenAPI document.
 * @returns A function that resolves OpenAPI refs.
 */
export function makeRefObjectResolvers(openAPIDoc: OpenAPIObject): {
  /**
   * Resolves the OpenAPI object making sure that it is not a reference.
   *
   * @param refOrObject - The OpenAPI ref or object.
   * @returns The resolved OpenAPI object.
   */
  resolveObject: <TObjectComponent extends OpenAPIObjectComponent>(
    refOrObject: ReferenceObject | TObjectComponent
  ) => TObjectComponent;
  /**
   * Resolve an OpenAPI ref retrieving the openAPI object that it references.
   *
   * @param ref - The OpenAPI ref.
   * @param depth - The current depth of the ref resolution. Used internally to prevent infinite loops.
   * @returns The resolved OpenAPI object.
   */
  resolveRef: <TObjectComponent extends OpenAPIObjectComponent>(ref: string) => TObjectComponent;
} {
  function resolveRef<TObjectComponent extends OpenAPIObjectComponent>(
    ref: string
  ): TObjectComponent {
    // First we take the type of the ref component we are trying to resolve
    const { type } = parseRefComponents(ref);

    // Then we recursively resolve the ref with that type.
    function recursevelyResolveRef(internalRef: string, depth = 0): TObjectComponent {
      const { identifier, type: internalType } = parseRefComponents(internalRef);

      const objectOrRef = openAPIDoc.components?.[type as never]?.[identifier];

      if (depth > 100) {
        throw refResolutionDepthExceededError({ ref });
      }

      if (!objectOrRef || internalType !== type) {
        throw resolveRefError({ ref });
      }

      if (isReferenceObject(objectOrRef)) {
        return recursevelyResolveRef(objectOrRef.$ref, depth + 1);
      }

      return objectOrRef as TObjectComponent;
    }

    return recursevelyResolveRef(ref);
  }

  function resolveObject<TObjectComponent extends OpenAPIObjectComponent>(
    refOrObject: ReferenceObject | TObjectComponent
  ): TObjectComponent {
    if (!isReferenceObject(refOrObject)) return refOrObject;

    const component = resolveRef<TObjectComponent>(refOrObject.$ref);
    return resolveObject<TObjectComponent>(component);
  }

  return { resolveObject, resolveRef };
}
