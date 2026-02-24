import { parse } from "@readme/openapi-parser";
import { isErrorResult, type MergeInput, merge } from "openapi-merge";
import type { OpenAPIV3 } from "openapi-types";
import outmatch from "outmatch";
import { filterOpenApi } from "@/lib/openapi-filter";
import type { HttpMethod, MergeConfig, PathConfig } from "@/types";

// Cache for parsed items to avoid redundant network/parsing hits
const parsedItems: Record<string, OpenAPIV3.Document> = {};

/**
 * CORE MERGER LOGIC
 * Explicitly return Promise<OpenAPIV3.Document> to ensure library portability.
 */
export async function performSelectiveMerge(
  config: MergeConfig,
): Promise<OpenAPIV3.Document> {
  const inputs = await Promise.all(
    config.inputs.map(async (src) => {
      // 1. Fetch and Resolve $refs
      // We cast to OpenAPIV3.Document to ensure we are working with the correct OAS version
      const api = parsedItems[src.url]
        ? (JSON.parse(
            JSON.stringify(parsedItems[src.url]),
          ) as OpenAPIV3.Document) // Deep clone to avoid mutating cache
        : ((await parse(src.url)) as OpenAPIV3.Document);

      if (!parsedItems[src.url]) {
        parsedItems[src.url] = JSON.parse(
          JSON.stringify(api),
        ) as OpenAPIV3.Document;
      }

      // 2. Prep Path Filtering
      const pathConfigs: PathConfig[] = src.include?.paths || [{ glob: "**" }];

      const matchers = pathConfigs.map((p) => ({
        isMatch: outmatch(p.glob),
        methods: p.methods?.map((m) => m.toLowerCase() as HttpMethod),
      }));

      // Use the specific type for paths to avoid "any"
      const filteredPaths: OpenAPIV3.PathsObject = {};

      // 3. Iterate through the source API paths
      // Note: Object.entries(api.paths) can have undefined values in OAS types
      Object.entries(api.paths || {}).forEach(([pathName, pathItem]) => {
        if (!pathItem) return;

        const matchingConfig = matchers.find((m) => m.isMatch(pathName));

        if (matchingConfig) {
          if (matchingConfig.methods && matchingConfig.methods.length > 0) {
            // Only pick the specific methods (GET, POST, etc.)
            const pickedMethods: Record<string, any> = {};

            Object.entries(pathItem).forEach(([key, value]) => {
              if (
                matchingConfig.methods?.includes(
                  key.toLowerCase() as HttpMethod,
                )
              ) {
                pickedMethods[key] = value;
              }
            });

            if (Object.keys(pickedMethods).length > 0) {
              filteredPaths[pathName] =
                pickedMethods as OpenAPIV3.PathItemObject;
            }
          } else {
            // GLOB MATCHED: Include the entire path item
            filteredPaths[pathName] = pathItem;
          }
        }
      });

      // Update the API object with our filtered path set
      api.paths = filteredPaths;

      // Filter servers (security-conscious default)
      api.servers = api.servers?.filter((s) => !s.url.startsWith("http://"));

      // 4. Component Pruning (Tags & Security)
      const tagItems = new Set<string>();
      const securityKeys = new Set<string>();
      const activeSecurityItems: OpenAPIV3.SecurityRequirementObject[] = [];
      const activeSchemes: Record<string, OpenAPIV3.SecuritySchemeObject> = {};

      Object.values(filteredPaths).forEach((pathItem) => {
        if (!pathItem) return;

        // Iterate through methods (get, post, etc.)
        const operations = [
          pathItem.get,
          pathItem.post,
          pathItem.put,
          pathItem.delete,
          pathItem.patch,
          pathItem.options,
          pathItem.head,
        ];

        operations.forEach((op) => {
          if (!op) return;

          // Collect tags
          op.tags?.forEach((t) => {
            tagItems.add(t);
          });

          // Collect security
          op.security?.forEach((s) => {
            Object.keys(s).forEach((sKey) => {
              if (!securityKeys.has(sKey)) {
                securityKeys.add(sKey);
                activeSecurityItems.push(s);
                const scheme = api.components?.securitySchemes?.[sKey];
                // Resolve references if they exist, or use direct object
                if (scheme && !("$ref" in scheme)) {
                  activeSchemes[sKey] = scheme;
                }
              }
            });
          });
        });
      });

      // Apply pruning to the document
      api.tags = api.tags?.filter((t) => tagItems.has(t.name));
      api.security = activeSecurityItems;
      if (api.components) {
        api.components.securitySchemes = activeSchemes;
      }

      return {
        oas: await filterOpenApi(api),
        pathModification: {
          prepend: src.prefix || "",
        },
      };
    }),
  );

  // 5. Final Assembly
  const result = merge(inputs as MergeInput);

  if (!isErrorResult(result)) {
    return result.output as OpenAPIV3.Document;
  } else {
    throw new Error(`Merge failed: ${result.message}`);
  }
}
