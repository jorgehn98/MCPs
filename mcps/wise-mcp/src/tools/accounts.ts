import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getProfiles, getBalances } from '../client.js';

export function registerAccountTools(server: McpServer) {
  server.registerTool(
    'wise_get_profiles',
    {
      description: 'Get all Wise profiles (personal and business) for the authenticated user.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const profiles = await getProfiles();
      return {
        content: [{ type: 'text', text: JSON.stringify(profiles, null, 2) }],
      };
    }
  );

  server.registerTool(
    'wise_get_balances',
    {
      description:
        'Get multi-currency balances for a Wise profile. Use wise_get_profiles first to obtain the profileId.',
      inputSchema: {
        profileId: z.number().int().describe('The Wise profile ID (from wise_get_profiles).'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ profileId }) => {
      const balances = await getBalances(profileId);
      return {
        content: [{ type: 'text', text: JSON.stringify(balances, null, 2) }],
      };
    }
  );
}
