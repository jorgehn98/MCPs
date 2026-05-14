import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { metaGet, metaPost, handleMetaError, truncateIfNeeded } from "../client.js";
import { CHARACTER_LIMIT, DEFAULT_LIMIT } from "../constants.js";
import type { Campaign, PaginatedResponse } from "../types.js";

const CAMPAIGN_FIELDS = "id,name,status,objective,buying_type,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time,effective_status,special_ad_categories,bid_strategy";

const CampaignStatusSchema = z.enum(["ACTIVE", "PAUSED", "DELETED", "ARCHIVED"]);
const CampaignObjectiveSchema = z.enum([
  "OUTCOME_AWARENESS",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_LEADS",
  "OUTCOME_SALES",
  "OUTCOME_TRAFFIC",
  "OUTCOME_APP_PROMOTION",
]);

export function registerCampaignTools(server: McpServer): void {
  server.registerTool(
    "meta_get_campaigns",
    {
      title: "Get Campaigns",
      description: `List campaigns for a Meta ad account.

Args:
  - ad_account_id: Ad account ID without 'act_' prefix
  - status: Filter by status (ACTIVE, PAUSED, DELETED, ARCHIVED). Omit for all.
  - limit: Max campaigns to return (default: 25, max: 100)
  - after: Cursor for pagination (from previous response's next_cursor)

Returns list of campaigns with id, name, status, objective, budgets, and dates.`,
      inputSchema: {
        ad_account_id: z.string().describe("Ad account ID without 'act_' prefix"),
        status: z.enum(["ACTIVE", "PAUSED", "DELETED", "ARCHIVED"]).optional()
          .describe("Filter by campaign status"),
        limit: z.number().int().min(1).max(100).default(DEFAULT_LIMIT).describe("Max results (default: 25)"),
        after: z.string().optional().describe("Pagination cursor from previous response"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ ad_account_id, status, limit, after }) => {
      try {
        const params: Record<string, unknown> = { fields: CAMPAIGN_FIELDS, limit };
        if (status) params.effective_status = JSON.stringify([status]);
        if (after) params.after = after;

        const result = await metaGet<PaginatedResponse<Campaign>>(`act_${ad_account_id}/campaigns`, params);
        const campaigns = result.data ?? [];
        const output = {
          count: campaigns.length,
          has_more: !!result.paging?.next,
          next_cursor: result.paging?.cursors?.after,
          campaigns,
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
    "meta_get_campaign_details",
    {
      title: "Get Campaign Details",
      description: `Get full details of a specific campaign by ID.

Args:
  - campaign_id: Campaign ID (e.g., "120210000000000000")

Returns all campaign fields: name, status, objective, budget, bid strategy, dates, and special ad categories.`,
      inputSchema: {
        campaign_id: z.string().describe("Campaign ID"),
        fields: z.string().optional().describe("Comma-separated fields to return. Default: all main fields"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ campaign_id, fields }) => {
      try {
        const result = await metaGet<Campaign>(campaign_id, { fields: fields ?? CAMPAIGN_FIELDS });
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
    "meta_create_campaign",
    {
      title: "Create Campaign",
      description: `Create a new ad campaign in a Meta ad account.

Args:
  - ad_account_id: Ad account ID without 'act_' prefix
  - name: Campaign name
  - objective: Campaign objective (OUTCOME_AWARENESS, OUTCOME_ENGAGEMENT, OUTCOME_LEADS, OUTCOME_SALES, OUTCOME_TRAFFIC, OUTCOME_APP_PROMOTION)
  - status: Initial status (default: PAUSED — recommended to start paused)
  - daily_budget: Daily budget in account currency cents (e.g., 1000 = $10.00)
  - lifetime_budget: Total budget in cents (use either daily_budget OR lifetime_budget, not both)
  - bid_strategy: LOWEST_COST_WITHOUT_CAP (default), LOWEST_COST_WITH_BID_CAP, COST_CAP, MINIMUM_ROAS
  - special_ad_categories: Array of special categories if applicable (CREDIT, EMPLOYMENT, HOUSING, ISSUES_ELECTIONS_POLITICS, NONE)

Returns: { id: campaign_id, success: true }`,
      inputSchema: {
        ad_account_id: z.string().describe("Ad account ID without 'act_' prefix"),
        name: z.string().min(1).describe("Campaign name"),
        objective: CampaignObjectiveSchema.describe("Campaign objective"),
        status: CampaignStatusSchema.default("PAUSED").describe("Initial status (default: PAUSED)"),
        daily_budget: z.number().int().positive().optional()
          .describe("Daily budget in account currency cents (e.g., 1000 = $10.00)"),
        lifetime_budget: z.number().int().positive().optional()
          .describe("Lifetime budget in cents (mutually exclusive with daily_budget)"),
        bid_strategy: z.enum(["LOWEST_COST_WITHOUT_CAP", "LOWEST_COST_WITH_BID_CAP", "COST_CAP", "MINIMUM_ROAS"])
          .default("LOWEST_COST_WITHOUT_CAP").describe("Bid strategy"),
        special_ad_categories: z.array(
          z.enum(["CREDIT", "EMPLOYMENT", "HOUSING", "ISSUES_ELECTIONS_POLITICS", "NONE"])
        ).default(["NONE"]).describe("Special ad categories (required by Meta)"),
        is_adset_budget_sharing_enabled: z.boolean().optional()
          .describe("Required in v22.0+ when NOT using campaign budget (CBO). Set to true to allow ad sets to share 20% of budget for optimization. Default: auto (false when no campaign budget)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ ad_account_id, name, objective, status, daily_budget, lifetime_budget, bid_strategy, special_ad_categories, is_adset_budget_sharing_enabled }) => {
      try {
        const hasCampaignBudget = !!(daily_budget || lifetime_budget);
        const data: Record<string, unknown> = {
          name,
          objective,
          status,
          special_ad_categories,
        };
        // bid_strategy solo es válido a nivel de campaña con CBO (cuando hay budget en campaña)
        if (hasCampaignBudget) {
          if (daily_budget) data.daily_budget = daily_budget;
          if (lifetime_budget) data.lifetime_budget = lifetime_budget;
          data.bid_strategy = bid_strategy;
        } else {
          // v22.0+ requiere is_adset_budget_sharing_enabled cuando NO hay budget de campaña
          data.is_adset_budget_sharing_enabled = is_adset_budget_sharing_enabled ?? false;
        }

        const result = await metaPost<{ id: string; success?: boolean }>(
          `act_${ad_account_id}/campaigns`,
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
    "meta_update_campaign",
    {
      title: "Update Campaign",
      description: `Update an existing campaign's settings.

Args:
  - campaign_id: Campaign ID to update
  - name: New campaign name (optional)
  - status: New status — ACTIVE, PAUSED, DELETED, ARCHIVED (optional)
  - daily_budget: New daily budget in cents (optional)
  - lifetime_budget: New lifetime budget in cents (optional)
  - bid_strategy: New bid strategy (optional)

Returns: { success: true } on success.`,
      inputSchema: {
        campaign_id: z.string().describe("Campaign ID to update"),
        name: z.string().optional().describe("New campaign name"),
        status: CampaignStatusSchema.optional().describe("New status"),
        daily_budget: z.number().int().positive().optional().describe("New daily budget in cents"),
        lifetime_budget: z.number().int().positive().optional().describe("New lifetime budget in cents"),
        bid_strategy: z.enum(["LOWEST_COST_WITHOUT_CAP", "LOWEST_COST_WITH_BID_CAP", "COST_CAP", "MINIMUM_ROAS"])
          .optional().describe("New bid strategy"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ campaign_id, ...updates }) => {
      try {
        const data: Record<string, unknown> = {};
        if (updates.name) data.name = updates.name;
        if (updates.status) data.status = updates.status;
        if (updates.daily_budget) data.daily_budget = updates.daily_budget;
        if (updates.lifetime_budget) data.lifetime_budget = updates.lifetime_budget;
        if (updates.bid_strategy) data.bid_strategy = updates.bid_strategy;

        const result = await metaPost<{ success: boolean }>(campaign_id, data);
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
    "meta_duplicate_campaign",
    {
      title: "Duplicate Campaign",
      description: `Duplicate an existing campaign, including its ad sets and ads.

Args:
  - campaign_id: Source campaign ID to copy
  - ad_account_id: Destination ad account ID without 'act_' prefix
  - new_name: Name for the duplicated campaign (optional, defaults to "Copy of [original name]")
  - status_override: Status for all copied objects (ACTIVE or PAUSED, default: PAUSED)

Returns the new campaign ID.`,
      inputSchema: {
        campaign_id: z.string().describe("Campaign ID to duplicate"),
        ad_account_id: z.string().describe("Destination ad account ID without 'act_' prefix"),
        new_name: z.string().optional().describe("Name for the copy (optional)"),
        status_override: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED")
          .describe("Status for copied objects (default: PAUSED)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ campaign_id, ad_account_id, new_name, status_override }) => {
      try {
        const data: Record<string, unknown> = {
          campaign_id,
          deep_copy: true,
          status_option: status_override,
          ad_account_id: `act_${ad_account_id}`,
        };
        if (new_name) data.rename_options = JSON.stringify({ rename_suffix: "", rename_prefix: "", overwrite_name: new_name });

        const result = await metaPost<{ copied_campaign_id: string; ad_object_ids: unknown[] }>(
          `act_${ad_account_id}/campaigns/copies`,
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
    "meta_bulk_update_campaigns",
    {
      title: "Bulk Update Campaigns",
      description: `Update multiple campaigns at once with the same settings.

Args:
  - campaign_ids: Array of campaign IDs to update
  - status: New status to apply to all (optional)
  - daily_budget: New daily budget in cents to apply to all (optional)

Returns array of results for each campaign.`,
      inputSchema: {
        campaign_ids: z.array(z.string()).min(1).max(50).describe("Array of campaign IDs to update"),
        status: CampaignStatusSchema.optional().describe("Status to apply to all campaigns"),
        daily_budget: z.number().int().positive().optional().describe("Daily budget in cents to apply to all"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ campaign_ids, status, daily_budget }) => {
      try {
        const results = await Promise.allSettled(
          campaign_ids.map(async (id) => {
            const data: Record<string, unknown> = {};
            if (status) data.status = status;
            if (daily_budget) data.daily_budget = daily_budget;
            const result = await metaPost<{ success: boolean }>(id, data);
            return { campaign_id: id, ...result };
          })
        );

        const output = results.map((r, i) =>
          r.status === "fulfilled"
            ? { campaign_id: campaign_ids[i], success: true, result: r.value }
            : { campaign_id: campaign_ids[i], success: false, error: handleMetaError(r.reason) }
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
