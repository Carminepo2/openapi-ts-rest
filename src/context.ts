import {
  type HeadersObject,
  type ParameterObject,
  type OpenAPIObject,
  type ReferenceObject,
  type RequestBodyObject,
  type ResponsesObject,
  type SchemaObject,
  isReferenceObject,
} from "openapi3-ts/oas30";
import { formatToIdentifierString } from "./lib/utils";

const OPEN_API_COMPONENTS_PATH = ["schemas", "parameters", "requestBodies", "responses", "headers"] as const;
type OpenAPIComponentPath = (typeof OPEN_API_COMPONENTS_PATH)[number];
type OpenAPIObjectComponent = SchemaObject | ParameterObject | RequestBodyObject | ResponsesObject | HeadersObject;

type SchemaObjectMeta =
  | {
      schemaObject: SchemaObject;
      normalizedIdentifier: string;
      shouldExport: true;
    }
  | {
      schemaObject: SchemaObject;
      shouldExport: false;
    };

export interface Context {
  openAPIDoc: OpenAPIObject;
  resolveRefOrObject: <TObjectComponent extends OpenAPIObjectComponent>(
    refOrObject: TObjectComponent | ReferenceObject,
    resolvedRefs?: Set<string>
  ) => TObjectComponent;
  resolveSchemaObject: (refOrSchemaObject: SchemaObject | ReferenceObject) => SchemaObjectMeta;
}

export function generateContext(openAPIDoc: OpenAPIObject): Context {
  const schemaMap = new Map<string, SchemaObjectMeta>();

  const resolveRefOrObject = <TObjectComponent extends OpenAPIObjectComponent>(
    refOrObject: TObjectComponent | ReferenceObject,
    resolvedRefs = new Set<string>()
  ): TObjectComponent => {
    if (!isReferenceObject(refOrObject)) return refOrObject;

    const ref = refOrObject.$ref;

    // If this reference has already been resolved, throw an error to avoid infinite recursion
    if (resolvedRefs.has(ref)) {
      throw new Error(`Circular reference detected: ${ref}`);
    }
    resolvedRefs.add(ref);

    const { componentPath, componentName } = validateAndParseRef(ref);

    const component = openAPIDoc.components?.[componentPath]?.[componentName];

    if (!component) {
      throw new Error(`Could not resolve ref: ${ref}`);
    }

    if (isReferenceObject(component)) {
      return resolveRefOrObject<TObjectComponent>(component, resolvedRefs);
    }

    return component as TObjectComponent;
  };

  const resolveSchemaObject: Context["resolveSchemaObject"] = (refOrSchemaObject) => {
    if (!isReferenceObject(refOrSchemaObject))
      return {
        schemaObject: refOrSchemaObject,
        shouldExport: false,
      };

    const ref = refOrSchemaObject.$ref;

    const cachedSchema = schemaMap.get(ref);
    if (cachedSchema) return cachedSchema;

    const schemaObjectMeta = {
      schemaObject: resolveRefOrObject<SchemaObject>(refOrSchemaObject),
      normalizedIdentifier: formatToIdentifierString(validateAndParseRef(ref).componentName),
      shouldExport: true,
    };

    schemaMap.set(ref, schemaObjectMeta);
    return schemaObjectMeta;
  };

  return {
    openAPIDoc,
    resolveRefOrObject,
    resolveSchemaObject,
  };
}

function validateAndParseRef(ref: string): {
  componentPath: OpenAPIComponentPath;
  componentName: string;
} {
  const isValid = OPEN_API_COMPONENTS_PATH.some((componentPath) => {
    return ref.startsWith(`#/components/${componentPath}/`);
  });

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
    componentPath,
    componentName,
  };
}
