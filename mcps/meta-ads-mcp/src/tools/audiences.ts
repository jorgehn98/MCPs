import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { metaGet, metaPost, handleMetaError } from "../client.js";
import type { CustomAudience, PaginatedResponse } from "../types.js";

const AUDIENCE_FIELDS = "id,name,description,subtype,approximate_count_lower_bound,approximate_count_upper_bound,data_source,created_time,updated_time,rule,lookalike_spec";

export function registerAudienceTools(server: McpServer): void {
  server.registerTool(
    "meta_get_custom_audiences",
    {
      title: "Get Custom Audiences",
      description: `List custom audiences for a Meta ad account.
Includes website custom audiences, customer lists, engagement audiences, and lookalikes.

Args:
  - ad_account_id: Ad account ID without 'act_' prefix
  - limit: Max results (default: 25)
  - after: Pagination cursor

Returns list of audiences with id, name, subtype, and approximate_count_lower_bound/upper_bound.

Subtype values: CUSTOM, WEBSITE, APP, OFFLINE_CONVERSION, LOOKALIKE, ENGAGEMENT,
DATA_SET, BAG_OF_ACCOUNTS, STUDY_RULE_AUDIENCE, VIDEO, LEAD_GENERATION, DYNAMIC_RULE,
PRODUCT_AUDIENCE, COMBINATION, CLAIM, PARTNER, MANAGED, EVENTS_BASED`,
      inputSchema: {
        ad_account_id: z.string().describe("Ad account ID without 'act_' prefix"),
        limit: z.number().int().min(1).max(100).default(25),
        after: z.string().optional().describe("Pagination cursor"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ ad_account_id, limit, after }) => {
      try {
        const params: Record<string, unknown> = { fields: AUDIENCE_FIELDS, limit };
        if (after) params.after = after;

        const result = await metaGet<PaginatedResponse<CustomAudience>>(
          `act_${ad_account_id}/customaudiences`,
          params
        );
        const audiences = result.data ?? [];
        const output = {
          count: audiences.length,
          has_more: !!result.paging?.next,
          next_cursor: result.paging?.cursors?.after,
          audiences,
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
    "meta_create_custom_audience",
    {
      title: "Create Custom Audience",
      description: `Create a custom audience from pixel events or a customer list.
Meta infers the audience type from the parameters (rule for website, customer_file_source for lists).

Args:
  - ad_account_id: Ad account ID without 'act_' prefix
  - name: Audience name
  - description: Audience description (optional)
  - rule: JSON rule for pixel-based audiences (website visitors, events). Example:
    '{"inclusions":{"operator":"or","rules":[{"event_sources":[{"id":"PIXEL_ID","type":"pixel"}],"retention_seconds":2592000,"filter":{"operator":"and","filters":[{"field":"url","operator":"i_contains","value":"/landing/"}]}}]}}'
  - pixel_id: Pixel ID (for website audiences)
  - customer_file_source: For customer list audiences: USER_PROVIDED_ONLY, PARTNER_PROVIDED_ONLY, BOTH_USER_AND_PARTNER_PROVIDED

Returns: { id: audience_id, name }

Note: Requires accepting Custom Audiences ToS first: https://www.facebook.com/customaudiences/app/tos/?act=AD_ACCOUNT_ID`,
      inputSchema: {
        ad_account_id: z.string().describe("Ad account ID without 'act_' prefix"),
        name: z.string().min(1).describe("Audience name"),
        description: z.string().optional(),
        customer_file_source: z.enum([
          "USER_PROVIDED_ONLY",
          "PARTNER_PROVIDED_ONLY",
          "BOTH_USER_AND_PARTNER_PROVIDED",
        ]).optional().describe("For customer list audiences: data source declaration"),
        rule: z.string().optional()
          .describe("JSON string with pixel rule for website audiences. Meta infers the audience type from the rule structure."),
        pixel_id: z.string().optional()
          .describe("Meta Pixel ID for website audiences"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ ad_account_id, name, description, customer_file_source, rule, pixel_id }) => {
      try {
        const data: Record<string, unknown> = { name };
        if (description) data.description = description;
        if (customer_file_source) data.customer_file_source = customer_file_source;
        if (rule) data.rule = rule;
        if (pixel_id) data.pixel_id = pixel_id;

        const result = await metaPost<{ id: string; name: string }>(
          `act_${ad_account_id}/customaudiences`,
          data
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

  server.registerTool(
    "meta_create_lookalike_audience",
    {
      title: "Create Lookalike Audience",
      description: `Create a lookalike audience based on a source custom audience.
Meta finds people similar to your source audience in the target countries.

Args:
  - ad_account_id: Ad account ID without 'act_' prefix
  - name: Lookalike audience name
  - source_audience_id: Source custom audience ID (the audience to base similarities on)
  - country: Target country code (e.g., "ES", "US", "MX") — single country
  - ratio: Audience size ratio 0.01–0.20 (1%=most similar, 20%=broadest)
    - 0.01 = Top 1% most similar (smallest, highest quality)
    - 0.10 = Top 10% (medium)
    - 0.20 = Top 20% (largest, broadest)

Returns: { id: lookalike_audience_id }
Note: Lookalike creation can take several hours to populate.`,
      inputSchema: {
        ad_account_id: z.string().describe("Ad account ID without 'act_' prefix"),
        name: z.string().min(1).describe("Lookalike audience name"),
        source_audience_id: z.string().describe("Source custom audience ID"),
        country: z.string().length(2).describe("Target country code (e.g., 'ES', 'US')"),
        ratio: z.number().min(0.01).max(0.20).default(0.01)
          .describe("Similarity ratio: 0.01=top 1% (default), up to 0.20=20%"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ ad_account_id, name, source_audience_id, country, ratio }) => {
      try {
        const data = {
          name,
          lookalike_spec: JSON.stringify({
            type: "similarity",
            starting_ratio: 0,
            ratio,
            country,
            origin: [{ id: source_audience_id, type: "custom_audience" }],
          }),
        };

        const result = await metaPost<{ id: string }>(
          `act_${ad_account_id}/customaudiences`,
          data
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
