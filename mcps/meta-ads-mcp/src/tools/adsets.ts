import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { metaGet, metaPost, handleMetaError, truncateIfNeeded } from "../client.js";
import { CHARACTER_LIMIT, DEFAULT_LIMIT } from "../constants.js";
import type { AdSet, PaginatedResponse } from "../types.js";

const ADSET_FIELDS = "id,name,status,campaign_id,daily_budget,lifetime_budget,billing_event,optimization_goal,bid_amount,targeting,start_time,end_time,created_time,updated_time,effective_status,destination_type,attribution_spec,bid_strategy,pacing_type";

const AdSetStatusSchema = z.enum(["ACTIVE", "PAUSED", "DELETED", "ARCHIVED"]);

const TargetingSchema = z.object({
  age_min: z.number().int().min(18).max(65).optional().describe("Minimum age (18-65)"),
  age_max: z.number().int().min(18).max(65).optional().describe("Maximum age (18-65)"),
  genders: z.array(z.enum(["1", "2"])).optional().describe("1=male, 2=female. Omit for all genders"),
  geo_locations: z.object({
    countries: z.array(z.string()).optional().describe("Country codes e.g. ['ES', 'US', 'MX']"),
    cities: z.array(z.object({ key: z.string(), radius: z.number().optional(), distance_unit: z.string().optional() })).optional(),
    regions: z.array(z.object({ key: z.string() })).optional(),
    zips: z.array(z.object({ key: z.string() })).optional(),
  }).optional(),
  interests: z.array(z.object({ id: z.string(), name: z.string() })).optional()
    .describe("Interest targeting (use meta_search_interests to find IDs)"),
  behaviors: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  custom_audiences: z.array(z.object({ id: z.string() })).optional()
    .describe("Custom audience IDs to include"),
  excluded_custom_audiences: z.array(z.object({ id: z.string() })).optional()
    .describe("Custom audience IDs to exclude"),
  publisher_platforms: z.array(z.string()).optional()
    .describe("Platforms: facebook, instagram, audience_network, messenger"),
  facebook_positions: z.array(z.string()).optional()
    .describe("Facebook placements: feed, right_hand_column, marketplace, video_feeds, story, search, instream_video"),
  instagram_positions: z.array(z.string()).optional()
    .describe("Instagram placements: stream, story, explore, reels"),
  device_platforms: z.array(z.enum(["mobile", "desktop"])).optional(),
}).optional();

export function registerAdSetTools(server: McpServer): void {
  server.registerTool(
    "meta_get_adsets",
    {
      title: "Get Ad Sets",
      description: `List ad sets for a Meta ad account or campaign.

Args:
  - ad_account_id: Ad account ID without 'act_' prefix
  - campaign_id: Filter by specific campaign ID (optional)
  - status: Filter by status (optional)
  - limit: Max results (default: 25)
  - after: Pagination cursor

Returns list of ad sets with budgets, targeting summary, optimization goal, and status.`,
      inputSchema: {
        ad_account_id: z.string().describe("Ad account ID without 'act_' prefix"),
        campaign_id: z.string().optional().describe("Filter ad sets by campaign ID"),
        status: AdSetStatusSchema.optional().describe("Filter by status"),
        limit: z.number().int().min(1).max(100).default(DEFAULT_LIMIT),
        after: z.string().optional().describe("Pagination cursor"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ ad_account_id, campaign_id, status, limit, after }) => {
      try {
        const params: Record<string, unknown> = { fields: ADSET_FIELDS, limit };
        if (status) params.effective_status = JSON.stringify([status]);
        if (campaign_id) params.campaign_id = campaign_id;
        if (after) params.after = after;

        const result = await metaGet<PaginatedResponse<AdSet>>(`act_${ad_account_id}/adsets`, params);
        const adsets = result.data ?? [];
        const output = {
          count: adsets.length,
          has_more: !!result.paging?.next,
          next_cursor: result.paging?.cursors?.after,
          adsets,
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
    "meta_get_adset_details",
    {
      title: "Get Ad Set Details",
      description: `Get full details of a specific ad set including complete targeting spec.

Args:
  - adset_id: Ad set ID

Returns all fields: targeting, budget, optimization goal, billing event, bid strategy, and placements.`,
      inputSchema: {
        adset_id: z.string().describe("Ad set ID"),
        fields: z.string().optional().describe("Comma-separated fields. Default: all main fields"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ adset_id, fields }) => {
      try {
        const result = await metaGet<AdSet>(adset_id, { fields: fields ?? ADSET_FIELDS });
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
    "meta_create_adset",
    {
      title: "Create Ad Set",
      description: `Create a new ad set within a campaign.

Args:
  - ad_account_id: Ad account ID without 'act_' prefix
  - campaign_id: Parent campaign ID
  - name: Ad set name
  - optimization_goal: What to optimize for (LINK_CLICKS, IMPRESSIONS, REACH, LEAD_GENERATION, CONVERSIONS, OFFSITE_CONVERSIONS, etc.)
  - billing_event: When to charge (IMPRESSIONS, LINK_CLICKS, APP_INSTALLS, etc.)
  - daily_budget OR lifetime_budget: Budget in account currency cents
  - targeting: Targeting spec with geo, demographics, interests, placements
  - start_time: ISO 8601 datetime (e.g., "2024-01-15T00:00:00+0000")
  - end_time: ISO 8601 datetime (required if using lifetime_budget)
  - bid_amount: Bid in cents (optional, for manual bidding)
  - status: Initial status (default: PAUSED)

Returns: { id: adset_id }`,
      inputSchema: {
        ad_account_id: z.string().describe("Ad account ID without 'act_' prefix"),
        campaign_id: z.string().describe("Parent campaign ID"),
        name: z.string().min(1).describe("Ad set name"),
        optimization_goal: z.string().describe(
          "Optimization goal: LINK_CLICKS, IMPRESSIONS, REACH, LEAD_GENERATION, CONVERSIONS, " +
          "OFFSITE_CONVERSIONS, APP_INSTALLS, VIDEO_VIEWS, ENGAGED_USERS, PAGE_LIKES, POST_ENGAGEMENT"
        ),
        billing_event: z.string().describe("Billing event: IMPRESSIONS, LINK_CLICKS, APP_INSTALLS, PAGE_LIKES, VIDEO_VIEWS"),
        daily_budget: z.number().int().positive().optional().describe("Daily budget in cents"),
        lifetime_budget: z.number().int().positive().optional().describe("Lifetime budget in cents"),
        targeting: z.record(z.unknown()).describe(
          "Targeting spec object. Minimum required: { geo_locations: { countries: ['ES'] } }. " +
          "Use meta_search_interests/meta_search_geo_locations to find valid values."
        ),
        start_time: z.string().optional().describe("Start time ISO 8601 (e.g., '2024-01-15T00:00:00+0000')"),
        end_time: z.string().optional().describe("End time ISO 8601 (required with lifetime_budget)"),
        bid_amount: z.number().int().positive().optional().describe("Manual bid in cents"),
        bid_strategy: z.enum(["LOWEST_COST_WITHOUT_CAP", "LOWEST_COST_WITH_BID_CAP", "COST_CAP"])
          .optional().describe("Bid strategy"),
        promoted_object: z.object({
          pixel_id: z.string().optional().describe("Meta Pixel ID"),
          custom_event_type: z.string().optional()
            .describe("Conversion event: COMPLETE_REGISTRATION, LEAD, PURCHASE, ADD_TO_CART, INITIATED_CHECKOUT, SUBSCRIBE, CONTACT, etc."),
          application_id: z.string().optional(),
          object_store_url: z.string().optional(),
          page_id: z.string().optional(),
        }).optional().describe("Required for OFFSITE_CONVERSIONS — defines which pixel event to optimize for"),
        attribution_spec: z.array(z.object({
          event_type: z.enum(["CLICK_THROUGH", "VIEW_THROUGH", "ENGAGED_VIDEO_VIEW"]),
          window_days: z.number().int().min(1).max(28),
        })).optional().describe("Attribution window. Default: 7d click. Example: [{event_type:'CLICK_THROUGH',window_days:7},{event_type:'VIEW_THROUGH',window_days:1}]"),
        status: AdSetStatusSchema.default("PAUSED"),
        destination_type: z.string().optional().describe("WEBSITE, APP, MESSENGER, INSTAGRAM_DIRECT, etc."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ ad_account_id, ...params }) => {
      try {
        const data: Record<string, unknown> = {
          campaign_id: params.campaign_id,
          name: params.name,
          optimization_goal: params.optimization_goal,
          billing_event: params.billing_event,
          targeting: params.targeting,
          status: params.status,
          is_adset_budget_sharing_enabled: false,
        };
        if (params.daily_budget) data.daily_budget = params.daily_budget;
        if (params.lifetime_budget) data.lifetime_budget = params.lifetime_budget;
        if (params.start_time) data.start_time = params.start_time;
        if (params.end_time) data.end_time = params.end_time;
        if (params.bid_amount) data.bid_amount = params.bid_amount;
        if (params.bid_strategy) data.bid_strategy = params.bid_strategy;
        if (params.promoted_object) data.promoted_object = params.promoted_object;
        if (params.attribution_spec) data.attribution_spec = params.attribution_spec;
        if (params.destination_type) data.destination_type = params.destination_type;

        const result = await metaPost<{ id: string }>(`act_${ad_account_id}/adsets`, data);
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
    "meta_update_adset",
    {
      title: "Update Ad Set",
      description: `Update an existing ad set's settings.

Args:
  - adset_id: Ad set ID to update
  - name: New name (optional)
  - status: New status (optional)
  - daily_budget: New daily budget in cents (optional)
  - lifetime_budget: New lifetime budget in cents (optional)
  - bid_amount: New bid in cents (optional)
  - targeting: New targeting spec (optional — replaces entire targeting)
  - end_time: New end time ISO 8601 (optional)

Returns: { success: true }`,
      inputSchema: {
        adset_id: z.string().describe("Ad set ID to update"),
        name: z.string().optional(),
        status: AdSetStatusSchema.optional(),
        daily_budget: z.number().int().positive().optional().describe("New daily budget in cents"),
        lifetime_budget: z.number().int().positive().optional(),
        bid_amount: z.number().int().positive().optional(),
        targeting: z.record(z.unknown()).optional().describe("New targeting spec (replaces existing)"),
        end_time: z.string().optional().describe("New end time ISO 8601"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ adset_id, ...updates }) => {
      try {
        const data: Record<string, unknown> = {};
        if (updates.name) data.name = updates.name;
        if (updates.status) data.status = updates.status;
        if (updates.daily_budget) data.daily_budget = updates.daily_budget;
        if (updates.lifetime_budget) data.lifetime_budget = updates.lifetime_budget;
        if (updates.bid_amount) data.bid_amount = updates.bid_amount;
        if (updates.targeting) data.targeting = updates.targeting;
        if (updates.end_time) data.end_time = updates.end_time;

        const result = await metaPost<{ success: boolean }>(adset_id, data);
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
    "meta_duplicate_adset",
    {
      title: "Duplicate Ad Set",
      description: `Duplicate an existing ad set within the same or different campaign.

Args:
  - adset_id: Source ad set ID
  - campaign_id: Destination campaign ID
  - ad_account_id: Ad account ID without 'act_' prefix
  - new_name: Name for the copy (optional)
  - status_override: Status for copied objects (default: PAUSED)

Returns the new ad set ID.`,
      inputSchema: {
        adset_id: z.string().describe("Source ad set ID"),
        campaign_id: z.string().describe("Destination campaign ID"),
        ad_account_id: z.string().describe("Ad account ID without 'act_' prefix"),
        new_name: z.string().optional(),
        status_override: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ adset_id, campaign_id, ad_account_id, status_override }) => {
      try {
        const result = await metaPost<{ copied_adset_id: string }>(
          `act_${ad_account_id}/adsets/copies`,
          { adset_id, campaign_id, status_option: status_override, deep_copy: true }
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
    "meta_bulk_update_adsets",
    {
      title: "Bulk Update Ad Sets",
      description: `Update multiple ad sets at once with the same settings.

Args:
  - adset_ids: Array of ad set IDs to update (max 50)
  - status: Status to apply to all (optional)
  - daily_budget: Daily budget in cents to apply to all (optional)

Returns array of per-adset results.`,
      inputSchema: {
        adset_ids: z.array(z.string()).min(1).max(50).describe("Array of ad set IDs"),
        status: AdSetStatusSchema.optional(),
        daily_budget: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ adset_ids, status, daily_budget }) => {
      try {
        const results = await Promise.allSettled(
          adset_ids.map(async (id) => {
            const data: Record<string, unknown> = {};
            if (status) data.status = status;
            if (daily_budget) data.daily_budget = daily_budget;
            return metaPost<{ success: boolean }>(id, data);
          })
        );
        const output = results.map((r, i) =>
          r.status === "fulfilled"
            ? { adset_id: adset_ids[i], success: true }
            : { adset_id: adset_ids[i], success: false, error: handleMetaError(r.reason) }
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
