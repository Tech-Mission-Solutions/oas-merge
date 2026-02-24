import { openapiFilter } from "openapi-format";
import type { OpenAPIV3 } from "openapi-types";

const filterOpenApi = async (schema: OpenAPIV3.Document) => {
  const filteredSchema = await openapiFilter(schema, {
    filterSet: {
      unusedComponents: [
        "schemas",
        "parameters",
        "examples",
        "headers",
        "requestBodies",
        "responses",
      ],
    },
    defaultFilter: {
      methods: [],
      tags: [],
      operationIds: [],
      operations: [],
      flags: [],
      flagValues: [],
      inverseMethods: [],
      inverseTags: [],
      inverseOperationIds: [],
      responseContent: [],
      inverseResponseContent: [],
      unusedComponents: [],
      stripFlags: [],
      preserveEmptyObjects: true,
    },
  });

  return filteredSchema.data as OpenAPIV3.Document;
};

export {
  filterOpenApi
};
