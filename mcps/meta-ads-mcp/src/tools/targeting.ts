import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { metaGet, handleMetaError } from "../client.js";
import type { PaginatedResponse } from "../types.js";

interface TargetingItem {
  id: string;
  name: string;
  description?: string;
  type?: string;
  audience_size?: number;
  path?: string[];
  topic?: string;
  disambiguation_category?: string;
}

interface GeoLocation {
  key: string;
  name: string;
  type: string;
  country_code?: string;
  country_name?: string;
  region?: string;
  region_id?: string;
  supports_city?: boolean;
  supports_region?: boolean;
}

export function registerTargetingTools(server: McpServer): void {
  server.registerTool(
    "meta_search_interests",
    {
      title: "Search Interests",
      description: `Search for interest targeting options by keyword.

Args:
  - query: Keyword to search interests (e.g., "photography", "fitness", "travel")
  - limit: Max results (default: 20)

Returns list of matching interests with id, name, audience_size, and path.
Use the id and name when building targeting spec for meta_create_adset.

Example: Search "photography" → returns interests like "Photography" (id: 6003249025895)`,
      inputSchema: {
        query: z.string().min(2).describe("Interest keyword to search"),
        limit: z.number().int().min(1).max(50).default(20),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ query, limit }) => {
      try {
        const result = await metaGet<{ data: TargetingItem[] }>("search", {
          type: "adinterest",
          q: query,
          limit,
        });
        const interests = result.data ?? [];
        const output = {
          count: interests.length,
          interests: interests.map((i) => ({
            id: i.id,
            name: i.name,
            audience_size: i.audience_size,
            path: i.path,
            topic: i.topic,
          })),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );

  server.registerTool(
    "meta_get_interest_suggestions",
    {
      title: "Get Interest Suggestions",
      description: `Get interest suggestions based on seed interests you already have.
Useful for discovering related interests to expand targeting.

Args:
  - interest_ids: Array of interest IDs to base suggestions on (use meta_search_interests to get IDs)
  - limit: Max suggestions (default: 20)

Returns list of suggested interests with id, name, and audience_size.`,
      inputSchema: {
        interest_ids: z.array(z.string()).min(1).max(10).describe("Seed interest IDs"),
        limit: z.number().int().min(1).max(50).default(20),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ interest_ids, limit }) => {
      try {
        const result = await metaGet<{ data: TargetingItem[] }>("search", {
          type: "adinterestsuggestion",
          interest_list: JSON.stringify(interest_ids),
          limit,
        });
        const suggestions = result.data ?? [];
        const output = {
          count: suggestions.length,
          suggestions: suggestions.map((i) => ({
            id: i.id,
            name: i.name,
            audience_size: i.audience_size,
            path: i.path,
          })),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );

  server.registerTool(
    "meta_validate_interests",
    {
      title: "Validate Interests",
      description: `Validate that interest IDs exist and are usable for targeting.

Args:
  - interest_ids: Array of interest IDs to validate

Returns for each ID: { id, name, valid, audience_size }`,
      inputSchema: {
        interest_ids: z.array(z.string()).min(1).max(50).describe("Interest IDs to validate"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ interest_ids }) => {
      try {
        const result = await metaGet<{ data: TargetingItem[] }>("search", {
          type: "adinterestvalid",
          interest_list: JSON.stringify(interest_ids),
        });
        const items = result.data ?? [];
        const validIds = new Set(items.map((i) => i.id));
        const output = interest_ids.map((id) => {
          const match = items.find((i) => i.id === id);
          return match
            ? { id, name: match.name, valid: true, audience_size: match.audience_size }
            : { id, valid: false };
        });
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: { results: output },
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );

  server.registerTool(
    "meta_search_behaviors",
    {
      title: "Search Behaviors",
      description: `Search for behavior targeting options (digital activities, travel, purchase behavior, etc.).

Args:
  - query: Keyword to search behaviors (e.g., "frequent traveler", "small business owner")
  - limit: Max results (default: 20)

Returns behaviors with id, name, audience_size, and description.`,
      inputSchema: {
        query: z.string().min(2).describe("Behavior keyword to search"),
        limit: z.number().int().min(1).max(50).default(20),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ query, limit }) => {
      try {
        const result = await metaGet<{ data: TargetingItem[] }>("search", {
          type: "behavior",
          q: query,
          limit,
        });
        const behaviors = result.data ?? [];
        const output = {
          count: behaviors.length,
          behaviors: behaviors.map((b) => ({
            id: b.id,
            name: b.name,
            audience_size: b.audience_size,
            description: b.description,
          })),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );

  server.registerTool(
    "meta_search_demographics",
    {
      title: "Search Demographics",
      description: `Search for demographic targeting options (education, relationship status, job titles, life events, etc.).

Args:
  - query: Keyword to search demographics (e.g., "college", "engaged", "new parent")
  - limit: Max results (default: 20)

Returns demographics with id, name, and description.`,
      inputSchema: {
        query: z.string().min(2).describe("Demographic keyword to search"),
        limit: z.number().int().min(1).max(50).default(20),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ query, limit }) => {
      try {
        const result = await metaGet<{ data: TargetingItem[] }>("search", {
          type: "adTargetingCategory",
          class: "demographics",
          q: query,
          limit,
        });
        const items = result.data ?? [];
        const output = {
          count: items.length,
          demographics: items.map((d) => ({
            id: d.id,
            name: d.name,
            description: d.description,
            type: d.type,
          })),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );

  server.registerTool(
    "meta_search_geo_locations",
    {
      title: "Search Geo Locations",
      description: `Search for geographic targeting locations: countries, cities, regions, zip codes.

Args:
  - query: Location name to search (e.g., "Madrid", "Spain", "28001")
  - location_types: Filter by type: country, region, city, zip, geo_market, electoral_district (default: all)
  - limit: Max results (default: 20)

Returns location key, name, type, and country info.
Use the 'key' field when building targeting spec geo_locations.

Example targeting spec usage:
  { geo_locations: { countries: ["ES"] } }
  { geo_locations: { cities: [{ key: "518543", radius: 25, distance_unit: "kilometer" }] } }`,
      inputSchema: {
        query: z.string().min(1).describe("Location name to search"),
        location_types: z.array(
          z.enum(["country", "region", "city", "zip", "geo_market", "electoral_district"])
        ).optional().describe("Filter by location type"),
        limit: z.number().int().min(1).max(50).default(20),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ query, location_types, limit }) => {
      try {
        const params: Record<string, unknown> = {
          type: "adgeolocation",
          q: query,
          limit,
        };
        if (location_types?.length) params.location_types = JSON.stringify(location_types);

        const result = await metaGet<{ data: GeoLocation[] }>("search", params);
        const locations = result.data ?? [];
        const output = {
          count: locations.length,
          locations: locations.map((l) => ({
            key: l.key,
            name: l.name,
            type: l.type,
            country_code: l.country_code,
            country_name: l.country_name,
            region: l.region,
          })),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );

  server.registerTool(
    "meta_estimate_audience_size",
    {
      title: "Estimate Audience Size",
      description: `Estimate the reach/audience size for a given targeting spec.
Use before creating an ad set to validate targeting isn't too broad or too narrow.

Args:
  - ad_account_id: Ad account ID without 'act_' prefix
  - targeting_spec: Complete targeting spec object (same format as meta_create_adset targeting param)
  - optimization_goal: Optimization goal (affects estimate)

Returns: { users_lower_bound, users_upper_bound, estimate_ready }
Recommended audience size: 100K–10M for most objectives.`,
      inputSchema: {
        ad_account_id: z.string().describe("Ad account ID without 'act_' prefix"),
        targeting_spec: z.record(z.unknown()).describe(
          "Targeting spec. Example: { geo_locations: { countries: ['ES'] }, age_min: 25, age_max: 45 }"
        ),
        optimization_goal: z.string().optional()
          .describe("e.g., LINK_CLICKS, CONVERSIONS, REACH (optional)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ ad_account_id, targeting_spec, optimization_goal }) => {
      try {
        const params: Record<string, unknown> = {
          targeting_spec: JSON.stringify(targeting_spec),
        };
        if (optimization_goal) params.optimization_goal = optimization_goal;

        const result = await metaGet<{ users_lower_bound: number; users_upper_bound: number; estimate_ready: boolean }>(
          `act_${ad_account_id}/reachestimate`,
          params
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );
}
