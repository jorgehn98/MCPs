import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { metaGet, metaPost, handleMetaError, truncateIfNeeded } from "../client.js";
import { CHARACTER_LIMIT } from "../constants.js";
import type { InsightData, PaginatedResponse } from "../types.js";

const DEFAULT_INSIGHT_FIELDS = [
  "impressions",
  "clicks",
  "spend",
  "reach",
  "frequency",
  "cpc",
  "cpm",
  "ctr",
  "cpp",
  "actions",
  "cost_per_action_type",
  "conversions",
  "cost_per_conversion",
  "roas",
  "video_p25_watched_actions",
  "video_p50_watched_actions",
  "video_p75_watched_actions",
  "video_p100_watched_actions",
].join(",");

export function registerInsightTools(server: McpServer): void {
  server.registerTool(
    "meta_get_insights",
    {
      title: "Get Insights",
      description: `Get performance metrics for a Meta ad account, campaign, ad set, or ad.

Args:
  - object_id: The ID to get insights for. Can be:
    - Ad account: act_XXXXXXXXX (or just the number — will add act_ prefix)
    - Campaign ID, Ad Set ID, or Ad ID
  - level: Aggregation level (account, campaign, adset, ad) — default: matches object type
  - date_preset: Predefined date range:
    today, yesterday, last_3d, last_7d, last_14d, last_28d, last_30d, last_90d,
    this_month, last_month, this_quarter, last_quarter, this_year, last_year
  - time_range: Custom date range { since: "YYYY-MM-DD", until: "YYYY-MM-DD" } (alternative to date_preset)
  - fields: Comma-separated metrics. Default: impressions,clicks,spend,reach,frequency,cpc,cpm,ctr,actions,cost_per_action_type,roas
  - breakdowns: Split results by: age, gender, country, region, placement, device_platform, publisher_platform, impression_device, product_id
  - time_increment: Group by time: 1 (daily), 7 (weekly), monthly, all_days
  - action_attribution_windows: Attribution window e.g. ["1d_view","7d_click"] (default: 7d_click)
  - limit: Max rows (default: 25)
  - after: Pagination cursor

Returns metrics array with requested fields.

Common action_types in results:
  - link_click, landing_page_view, purchase, lead, complete_registration,
    add_to_cart, initiate_checkout, subscribe, contact, view_content`,
      inputSchema: {
        object_id: z.string().describe("Object ID: ad account (act_XXX or number), campaign, adset, or ad ID"),
        level: z.enum(["account", "campaign", "adset", "ad"]).optional()
          .describe("Aggregation level (default: inferred from object type)"),
        date_preset: z.enum([
          "today", "yesterday", "last_3d", "last_7d", "last_14d", "last_28d",
          "last_30d", "last_90d", "this_month", "last_month", "this_quarter",
          "last_quarter", "this_year", "last_year", "maximum",
        ]).optional().describe("Predefined date range (default: last_30d)"),
        time_range: z.object({
          since: z.string().describe("Start date YYYY-MM-DD"),
          until: z.string().describe("End date YYYY-MM-DD"),
        }).optional().describe("Custom date range (alternative to date_preset)"),
        fields: z.string().optional()
          .describe("Comma-separated metrics. Default: impressions,clicks,spend,reach,frequency,cpc,cpm,ctr,actions,roas"),
        breakdowns: z.string().optional()
          .describe("Comma-separated breakdowns: age, gender, country, placement, device_platform, publisher_platform"),
        time_increment: z.union([z.number().int().positive(), z.enum(["monthly", "all_days"])])
          .optional().describe("Group by: 1 (daily), 7 (weekly), monthly, all_days"),
        action_attribution_windows: z.array(z.string()).optional()
          .describe("Attribution windows e.g. ['1d_view','7d_click']. Default: ['7d_click']"),
        limit: z.number().int().min(1).max(500).default(25),
        after: z.string().optional().describe("Pagination cursor"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ object_id, level, date_preset, time_range, fields, breakdowns, time_increment, action_attribution_windows, limit, after }) => {
      try {
        // Only add act_ prefix for short numeric account IDs (≤16 digits).
        // Campaign/adset/ad IDs are longer (17-18 digits) and must NOT get act_ prefix.
        const id = /^\d+$/.test(object_id) && object_id.length <= 16
          ? `act_${object_id}`
          : object_id;

        const params: Record<string, unknown> = {
          fields: fields ?? DEFAULT_INSIGHT_FIELDS,
          limit,
        };

        if (level) params.level = level;
        if (date_preset) params.date_preset = date_preset;
        else if (time_range) params.time_range = JSON.stringify(time_range);
        else params.date_preset = "last_30d";

        if (breakdowns) params.breakdowns = breakdowns;
        if (time_increment !== undefined) params.time_increment = time_increment;
        if (action_attribution_windows) params.action_attribution_windows = JSON.stringify(action_attribution_windows);
        if (after) params.after = after;

        const result = await metaGet<PaginatedResponse<InsightData>>(`${id}/insights`, params);
        const data = result.data ?? [];
        const output = {
          count: data.length,
          has_more: !!result.paging?.next,
          next_cursor: result.paging?.cursors?.after,
          date_preset: date_preset ?? (time_range ? `${time_range.since} to ${time_range.until}` : "last_30d"),
          data,
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
    "meta_bulk_get_insights",
    {
      title: "Bulk Get Insights",
      description: `Get performance metrics for multiple objects (campaigns, ad sets, or ads) at once.

Args:
  - object_ids: Array of IDs (campaign, adset, or ad IDs)
  - date_preset: Date range preset (default: last_30d)
  - fields: Comma-separated metrics (default: spend,impressions,clicks,ctr,cpc,actions)

Returns array of insights per object.`,
      inputSchema: {
        object_ids: z.array(z.string()).min(1).max(20).describe("Array of campaign/adset/ad IDs"),
        date_preset: z.enum([
          "today", "yesterday", "last_7d", "last_14d", "last_28d", "last_30d",
          "last_90d", "this_month", "last_month",
        ]).default("last_30d"),
        fields: z.string().optional()
          .describe("Comma-separated metrics (default: spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ object_ids, date_preset, fields }) => {
      try {
        const defaultFields = "spend,impressions,clicks,reach,ctr,cpc,cpm,actions,cost_per_action_type";
        const results = await Promise.allSettled(
          object_ids.map(async (id) => {
            const result = await metaGet<PaginatedResponse<InsightData>>(`${id}/insights`, {
              fields: fields ?? defaultFields,
              date_preset,
              limit: 1,
            });
            return { object_id: id, data: result.data?.[0] ?? null };
          })
        );

        const output = results.map((r, i) =>
          r.status === "fulfilled"
            ? r.value
            : { object_id: object_ids[i], error: handleMetaError(r.reason) }
        );
        return {
          content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(output, null, 2), CHARACTER_LIMIT) }],
          structuredContent: { results: output },
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );
}
