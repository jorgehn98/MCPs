import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { userRequest, appRequest, handleApiError } from '../client.js';
import type { XApiResponse } from '../types/x.js';

export function registerTrendsTools(server: McpServer) {

  // ── Get Personalized Trends ─────────────────────────────────────────────────
  server.tool(
    'x_get_personalized_trends',
    'Get trending topics personalized for the authenticated user based on their location and interests. Requires OAuth 2.0 PKCE.',
    {},
    async () => {
      try {
        const data = await userRequest<XApiResponse<unknown[]>>('GET', '/users/personalized_trends');
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get Trends By Location ──────────────────────────────────────────────────
  server.tool(
    'x_get_trends_by_location',
    'Get trending topics for a specific location using a Where On Earth ID (WOEID). Use WOEID 1 for worldwide trends. Common WOEIDs: 1 (Worldwide), 23424977 (United States), 44418 (London), 615702 (Paris), 2911298 (Berlin), 1105779 (Madrid), 20070458 (Barcelona).',
    {
      woeid: z.number().int().min(1).describe('Where On Earth ID for the location. Use 1 for worldwide.'),
    },
    async ({ woeid }) => {
      try {
        const data = await appRequest<unknown[]>('GET', `/trends/by/woeid/${woeid}`);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get Tweet Counts ────────────────────────────────────────────────────────
  server.tool(
    'x_get_tweet_counts',
    'Get the count of tweets matching a search query over the past 7 days (recent) or all time (full archive requires higher tier). Useful for understanding tweet volume trends.',
    {
      query: z.string().min(1).max(4096).describe('Search query with X operators. Example: "#AI lang:en"'),
      granularity: z.enum(['minute', 'hour', 'day']).default('day').describe('Time granularity for counts: minute, hour, or day'),
      start_time: z.string().optional().describe('ISO 8601 start time (max 7 days ago for recent)'),
      end_time: z.string().optional().describe('ISO 8601 end time'),
      archive: z.boolean().default(false).describe('Set true to query full archive (requires higher API tier, not available on free/basic)'),
    },
    async ({ query, granularity, start_time, end_time, archive }) => {
      try {
        const endpoint = archive ? '/tweets/counts/all' : '/tweets/counts/recent';
        const params: Record<string, unknown> = { query, granularity };
        if (start_time) params['start_time'] = start_time;
        if (end_time) params['end_time'] = end_time;

        const data = await appRequest<unknown>('GET', endpoint, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );
}
