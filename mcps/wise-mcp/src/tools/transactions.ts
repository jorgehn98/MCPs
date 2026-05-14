import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listActivities, listTransfers } from '../client.js';

export function registerTransactionTools(server: McpServer) {
  server.registerTool(
    'wise_list_transactions',
    {
      description:
        'List transactions (activities) for a Wise profile. Filter by date range and/or type.',
      inputSchema: {
        profileId: z.number().int().describe('The Wise profile ID (from wise_get_profiles).'),
        intervalStart: z
          .string()
          .optional()
          .describe('Start date in ISO 8601 format (e.g. 2026-01-01T00:00:00Z).'),
        intervalEnd: z
          .string()
          .optional()
          .describe('End date in ISO 8601 format (e.g. 2026-04-30T23:59:59Z).'),
        type: z
          .string()
          .optional()
          .describe('Activity type filter: TRANSFER, CARD, CONVERSION, DEPOSIT, WITHDRAWAL.'),
        size: z.number().int().optional().default(20).describe('Number of results (default: 20).'),
      },
      annotations: { readOnlyHint: true, idempotentHint: false },
    },
    async ({ profileId, intervalStart, intervalEnd, type, size }) => {
      const activities = await listActivities(profileId, {
        intervalStart,
        intervalEnd,
        type,
        size,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(activities, null, 2) }],
      };
    }
  );

  server.registerTool(
    'wise_list_transfers',
    {
      description: 'List recent transfers for a Wise profile.',
      inputSchema: {
        profileId: z.number().int().describe('The Wise profile ID (from wise_get_profiles).'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(20)
          .describe('Number of transfers to return (default: 20, max: 100).'),
      },
      annotations: { readOnlyHint: true, idempotentHint: false },
    },
    async ({ profileId, limit }) => {
      const transfers = await listTransfers(profileId, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(transfers, null, 2) }],
      };
    }
  );
}
