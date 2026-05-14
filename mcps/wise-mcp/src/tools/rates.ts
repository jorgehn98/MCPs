import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getExchangeRates } from '../client.js';

export function registerRateTools(server: McpServer) {
  server.registerTool(
    'wise_get_exchange_rates',
    {
      description:
        'Get current Wise exchange rates. Specify a source currency and optionally a target. If no target is given, returns all rates from that source.',
      inputSchema: {
        source: z
          .string()
          .length(3)
          .toUpperCase()
          .describe('Source currency code (e.g. EUR, USD, GBP).'),
        target: z
          .string()
          .length(3)
          .toUpperCase()
          .optional()
          .describe('Target currency code. Omit to get all rates from source.'),
      },
      annotations: { readOnlyHint: true, idempotentHint: false },
    },
    async ({ source, target }) => {
      const rates = await getExchangeRates(source, target);
      return {
        content: [{ type: 'text', text: JSON.stringify(rates, null, 2) }],
      };
    }
  );
}
