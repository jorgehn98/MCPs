#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerAccountTools } from "./tools/accounts.js";
import { registerCampaignTools } from "./tools/campaigns.js";
import { registerAdSetTools } from "./tools/adsets.js";
import { registerAdTools } from "./tools/ads.js";
import { registerCreativeTools } from "./tools/creatives.js";
import { registerInsightTools } from "./tools/insights.js";
import { registerTargetingTools } from "./tools/targeting.js";
import { registerAudienceTools } from "./tools/audiences.js";

function validateEnv(): void {
  if (!process.env.META_ACCESS_TOKEN) {
    console.error(
      "ERROR: META_ACCESS_TOKEN environment variable is required.\n" +
      "Get your token from:\n" +
      "  1. Meta Business Manager > System Users > Generate Token\n" +
      "  2. Or https://developers.facebook.com/tools/explorer/\n" +
      "Required permissions: ads_management, ads_read, pages_read_engagement"
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  validateEnv();

  const server = new McpServer({
    name: "meta-ads-mcp",
    version: "1.0.0",
  });

  // Register all tool groups
  registerAccountTools(server);
  registerCampaignTools(server);
  registerAdSetTools(server);
  registerAdTools(server);
  registerCreativeTools(server);
  registerInsightTools(server);
  registerTargetingTools(server);
  registerAudienceTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Meta Ads MCP Server running (stdio) — 40 tools loaded");
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
