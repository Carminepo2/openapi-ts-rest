import { type OpenAPIObject, type ReferenceObject, isReferenceObject } from "openapi3-ts";

import type { OpenAPIObjectComponent } from "../domain/types";

import { resolveRefError } from "../domain/errors";
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
    ref: string,
    depth = 0
  ): TObjectComponent {
    const { identifier, type } = parseRefComponents(ref);
    // `pathItems` is not a valid component path in the OpenAPI type spec.
    const objectOrRef = openAPIDoc.components?.[type as never]?.[identifier];

    if (!objectOrRef || depth > 100) {
      throw resolveRefError({ ref });
    }

    if (isReferenceObject(objectOrRef)) {
      return resolveRef<TObjectComponent>(objectOrRef.$ref, depth + 1);
    }

    return objectOrRef as TObjectComponent;
  }

  function resolveObject<TObjectComponent extends OpenAPIObjectComponent>(
    refOrObject: ReferenceObject | TObjectComponent
  ): TObjectComponent {
    if (!isReferenceObject(refOrObject)) return refOrObject;

    const ref = refOrObject.$ref;
    const component = resolveRef<TObjectComponent>(ref);

    if (isReferenceObject(component)) {
      return resolveObject<TObjectComponent>(component);
    }

    return component;
  }

  return { resolveObject, resolveRef };
}
