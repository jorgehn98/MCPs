import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { metaGet, handleMetaError, truncateIfNeeded } from "../client.js";
import { CHARACTER_LIMIT, DEFAULT_LIMIT } from "../constants.js";
import type { AdAccount, PaginatedResponse } from "../types.js";

export function registerAccountTools(server: McpServer): void {
  server.registerTool(
    "meta_get_ad_accounts",
    {
      title: "Get Ad Accounts",
      description: `List all Meta ad accounts accessible with the current token.

Returns account IDs, names, status, currency, timezone, and spend info.
The account ID returned (prefixed with 'act_') is required for most other tools.

Returns JSON with:
  - accounts: array of { id, name, account_id, account_status, currency, timezone_name, amount_spent }
  - count: number of accounts returned

account_status values: 1=ACTIVE, 2=DISABLED, 3=UNSETTLED, 7=PENDING_REVIEW, 9=IN_GRACE_PERIOD`,
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(DEFAULT_LIMIT)
          .describe("Max accounts to return (default: 25)"),
        fields: z.string().optional()
          .describe("Comma-separated fields to return. Default: id,name,account_id,account_status,currency,timezone_name,amount_spent,balance"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ limit, fields }) => {
      try {
        const defaultFields = "id,name,account_id,account_status,currency,timezone_name,amount_spent,balance,spend_cap";
        const result = await metaGet<PaginatedResponse<AdAccount>>("me/adaccounts", {
          fields: fields ?? defaultFields,
          limit,
        });
        const accounts = result.data ?? [];
        const output = { count: accounts.length, accounts };
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
    "meta_get_account_info",
    {
      title: "Get Ad Account Info",
      description: `Get detailed information about a specific Meta ad account.

Args:
  - ad_account_id: Ad account ID WITHOUT 'act_' prefix (e.g., "123456789")
  - fields: Optional comma-separated fields to fetch

Returns account details including name, status, currency, timezone, budgets, and billing info.`,
      inputSchema: {
        ad_account_id: z.string().describe("Ad account ID without 'act_' prefix (e.g., '123456789')"),
        fields: z.string().optional()
          .describe("Comma-separated fields. Default: id,name,account_id,account_status,currency,timezone_name,amount_spent,balance,spend_cap,business,owner"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ ad_account_id, fields }) => {
      try {
        const defaultFields = "id,name,account_id,account_status,currency,timezone_name,amount_spent,balance,spend_cap,business,owner,funding_source_details,capabilities,min_daily_budget";
        const result = await metaGet<AdAccount>(`act_${ad_account_id}`, {
          fields: fields ?? defaultFields,
        });
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
    "meta_search_pages",
    {
      title: "Search Facebook Pages",
      description: `Search for Facebook Pages by name. Used to find page_id needed for ad creatives.

Args:
  - query: Page name to search for
  - limit: Max results to return

Returns list of matching pages with id, name, category, and fan_count.
Use the page 'id' when creating ad creatives that require a Facebook Page.`,
      inputSchema: {
        query: z.string().min(2).describe("Page name to search (min 2 characters)"),
        limit: z.number().int().min(1).max(50).default(10).describe("Max results (default: 10)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ query, limit }) => {
      try {
        const result = await metaGet<PaginatedResponse<{ id: string; name: string; category?: string; fan_count?: number }>>(
          "pages/search",
          { q: query, fields: "id,name,category,fan_count", limit }
        );
        const pages = result.data ?? [];
        const output = { count: pages.length, pages };
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
    "meta_get_account_pages",
    {
      title: "Get Account Pages",
      description: `List Facebook Pages associated with the current user/business.
These are pages you manage and can use in ad creatives.

Args:
  - ad_account_id: Ad account ID without 'act_' prefix

Returns list of pages with id, name, access_token, and category.`,
      inputSchema: {
        ad_account_id: z.string().optional()
          .describe("Optional ad account ID to filter pages. If omitted, returns all user pages."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ ad_account_id }) => {
      try {
        const result = await metaGet<PaginatedResponse<{ id: string; name: string; category?: string; tasks?: string[] }>>(
          "me/accounts",
          { fields: "id,name,category,tasks,access_token", limit: 50 }
        );
        const pages = result.data ?? [];
        const output = { count: pages.length, pages };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );
}
