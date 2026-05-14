import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { metaGet, metaPost, handleMetaError, truncateIfNeeded } from "../client.js";
import { CHARACTER_LIMIT, DEFAULT_LIMIT } from "../constants.js";
import type { Ad, PaginatedResponse } from "../types.js";

const AD_FIELDS = "id,name,status,adset_id,campaign_id,creative{id,name,title,body,image_url,thumbnail_url},created_time,updated_time,effective_status,bid_amount,tracking_specs";

const AdStatusSchema = z.enum(["ACTIVE", "PAUSED", "DELETED", "ARCHIVED"]);

export function registerAdTools(server: McpServer): void {
  server.registerTool(
    "meta_get_ads",
    {
      title: "Get Ads",
      description: `List ads for a Meta ad account, campaign, or ad set.

Args:
  - ad_account_id: Ad account ID without 'act_' prefix
  - campaign_id: Filter by campaign ID (optional)
  - adset_id: Filter by ad set ID (optional)
  - status: Filter by status (optional)
  - limit: Max results (default: 25)
  - after: Pagination cursor

Returns list of ads with creative summary, status, and parent IDs.`,
      inputSchema: {
        ad_account_id: z.string().describe("Ad account ID without 'act_' prefix"),
        campaign_id: z.string().optional().describe("Filter by campaign ID"),
        adset_id: z.string().optional().describe("Filter by ad set ID"),
        status: AdStatusSchema.optional().describe("Filter by status"),
        limit: z.number().int().min(1).max(100).default(DEFAULT_LIMIT),
        after: z.string().optional().describe("Pagination cursor"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ ad_account_id, campaign_id, adset_id, status, limit, after }) => {
      try {
        const params: Record<string, unknown> = { fields: AD_FIELDS, limit };
        if (status) params.effective_status = JSON.stringify([status]);
        if (campaign_id) params.campaign_id = campaign_id;
        if (adset_id) params.adset_id = adset_id;
        if (after) params.after = after;

        const result = await metaGet<PaginatedResponse<Ad>>(`act_${ad_account_id}/ads`, params);
        const ads = result.data ?? [];
        const output = {
          count: ads.length,
          has_more: !!result.paging?.next,
          next_cursor: result.paging?.cursors?.after,
          ads,
        };
        return {
          content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(output, null, 2), CHARACTER_LIMIT) }],
          structuredContent: output,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );

  server.registerTool(
    "meta_get_ad_details",
    {
      title: "Get Ad Details",
      description: `Get full details of a specific ad including its creative.

Args:
  - ad_id: Ad ID

Returns: name, status, adset_id, campaign_id, creative details, effective_status, and tracking specs.`,
      inputSchema: {
        ad_id: z.string().describe("Ad ID"),
        fields: z.string().optional().describe("Comma-separated fields. Default: all main fields"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ ad_id, fields }) => {
      try {
        const result = await metaGet<Ad>(ad_id, { fields: fields ?? AD_FIELDS });
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
    "meta_create_ad",
    {
      title: "Create Ad",
      description: `Create a new ad within an ad set using an existing ad creative.

Args:
  - ad_account_id: Ad account ID without 'act_' prefix
  - adset_id: Parent ad set ID
  - name: Ad name
  - creative_id: ID of the ad creative to use (create with meta_create_ad_creative first)
  - status: Initial status (default: PAUSED)
  - tracking_specs: Optional conversion tracking specs

Returns: { id: ad_id }`,
      inputSchema: {
        ad_account_id: z.string().describe("Ad account ID without 'act_' prefix"),
        adset_id: z.string().describe("Parent ad set ID"),
        name: z.string().min(1).describe("Ad name"),
        creative_id: z.string().describe("Ad creative ID (from meta_create_ad_creative)"),
        status: AdStatusSchema.default("PAUSED"),
        tracking_specs: z.array(z.record(z.unknown())).optional()
          .describe("Conversion tracking specs (optional)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ ad_account_id, adset_id, name, creative_id, status, tracking_specs }) => {
      try {
        const data: Record<string, unknown> = {
          adset_id,
          name,
          creative: { creative_id },
          status,
        };
        if (tracking_specs) data.tracking_specs = tracking_specs;

        const result = await metaPost<{ id: string }>(`act_${ad_account_id}/ads`, data);
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
    "meta_update_ad",
    {
      title: "Update Ad",
      description: `Update an existing ad's settings.

Args:
  - ad_id: Ad ID to update
  - name: New name (optional)
  - status: New status (optional)
  - creative_id: New creative ID (optional — replaces current creative)

Returns: { success: true }`,
      inputSchema: {
        ad_id: z.string().describe("Ad ID to update"),
        name: z.string().optional(),
        status: AdStatusSchema.optional(),
        creative_id: z.string().optional().describe("New creative ID (replaces current)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ ad_id, name, status, creative_id }) => {
      try {
        const data: Record<string, unknown> = {};
        if (name) data.name = name;
        if (status) data.status = status;
        if (creative_id) data.creative = { creative_id };

        const result = await metaPost<{ success: boolean }>(ad_id, data);
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
    "meta_duplicate_ad",
    {
      title: "Duplicate Ad",
      description: `Duplicate an existing ad within the same or different ad set.

Args:
  - ad_id: Source ad ID
  - adset_id: Destination ad set ID
  - ad_account_id: Ad account ID without 'act_' prefix
  - status_override: Status for the copy (default: PAUSED)

Returns the new ad ID.`,
      inputSchema: {
        ad_id: z.string().describe("Source ad ID"),
        adset_id: z.string().describe("Destination ad set ID"),
        ad_account_id: z.string().describe("Ad account ID without 'act_' prefix"),
        status_override: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ ad_id, adset_id, ad_account_id, status_override }) => {
      try {
        const result = await metaPost<{ copied_ad_id: string }>(
          `act_${ad_account_id}/ads/copies`,
          { ad_id, adset_id, status_option: status_override }
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
    "meta_bulk_update_ads",
    {
      title: "Bulk Update Ads",
      description: `Update multiple ads at once with the same settings.

Args:
  - ad_ids: Array of ad IDs to update (max 50)
  - status: Status to apply to all (optional)

Returns array of per-ad results.`,
      inputSchema: {
        ad_ids: z.array(z.string()).min(1).max(50).describe("Array of ad IDs"),
        status: AdStatusSchema.optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ ad_ids, status }) => {
      try {
        const results = await Promise.allSettled(
          ad_ids.map(async (id) => {
            const data: Record<string, unknown> = {};
            if (status) data.status = status;
            return metaPost<{ success: boolean }>(id, data);
          })
        );
        const output = results.map((r, i) =>
          r.status === "fulfilled"
            ? { ad_id: ad_ids[i], success: true }
            : { ad_id: ad_ids[i], success: false, error: handleMetaError(r.reason) }
        );
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: { results: output },
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );
}
