import {
  HeadersObject,
  OpenAPIObject,
  ParameterObject,
  ReferenceObject,
  RequestBodyObject,
  ResponsesObject,
  SchemaObject,
  isReferenceObject,
} from "openapi3-ts/oas30";

type OpenAPIComponents = {
  schemas: SchemaObject;
  parameters: ParameterObject;
  requestBodies: RequestBodyObject;
  headers: HeadersObject;
  responses: ResponsesObject;
};

export function resolveOpenAPIComponent<TComponent extends keyof OpenAPIComponents>(
  doc: OpenAPIObject,
  components: TComponent,
  parameter: OpenAPIComponents[TComponent] | ReferenceObject
): OpenAPIComponents[TComponent] {
  if (isReferenceObject(parameter)) {
    const ref = parameter.$ref;

    const parameterName = ref.split("/").pop()!;
    const parameterObject = doc.components?.[components]?.[parameterName];

    if (isReferenceObject(parameterObject)) {
      return resolveOpenAPIComponent(doc, components as never, parameterObject);
    }

    if (!parameterObject) {
      throw new Error(`Could not resolve ${parameterName} at ${ref}`);
    }

    return parameterObject as OpenAPIComponents[TComponent];
  }
  return parameter;
}
