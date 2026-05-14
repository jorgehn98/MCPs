import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { appRequest, handleApiError, USER_FIELDS, TWEET_FIELDS } from '../client.js';
import type { XApiResponse, XSpace, XTweet } from '../types/x.js';

const SPACE_FIELDS = 'id,title,state,created_at,started_at,ended_at,scheduled_start,host_ids,creator_id,participant_count,is_ticketed,lang,speaker_ids,invited_user_ids,subscriber_count';

export function registerSpacesTools(server: McpServer) {

  // ── Search Spaces ───────────────────────────────────────────────────────────
  server.tool(
    'x_search_spaces',
    'Search for live or scheduled X Spaces by keyword.',
    {
      query: z.string().min(1).describe('Search keyword to find Spaces'),
      state: z.enum(['live', 'scheduled', 'all']).default('live').describe('Filter by state: live, scheduled, or all'),
      max_results: z.number().int().min(1).max(100).default(10).describe('Max results to return (1-100)'),
    },
    async ({ query, state, max_results }) => {
      try {
        const params: Record<string, unknown> = {
          query,
          max_results,
          'space.fields': SPACE_FIELDS,
          'expansions': 'creator_id,host_ids,speaker_ids',
          'user.fields': USER_FIELDS,
        };
        if (state !== 'all') params['state'] = state;

        const data = await appRequest<XApiResponse<XSpace[]>>('GET', '/spaces/search', undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get Space ───────────────────────────────────────────────────────────────
  server.tool(
    'x_get_space',
    'Get details about a specific X Space by its ID.',
    {
      space_id: z.string().describe('The Space ID to retrieve'),
    },
    async ({ space_id }) => {
      try {
        const data = await appRequest<XApiResponse<XSpace>>('GET', `/spaces/${space_id}`, undefined, {
          'space.fields': SPACE_FIELDS,
          'expansions': 'creator_id,host_ids,speaker_ids,invited_user_ids',
          'user.fields': USER_FIELDS,
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get Multiple Spaces ─────────────────────────────────────────────────────
  server.tool(
    'x_get_spaces',
    'Get details about multiple X Spaces by their IDs (up to 100).',
    {
      space_ids: z.string().describe('Comma-separated Space IDs (up to 100)'),
    },
    async ({ space_ids }) => {
      try {
        const data = await appRequest<XApiResponse<XSpace[]>>('GET', '/spaces', undefined, {
          ids: space_ids,
          'space.fields': SPACE_FIELDS,
          'expansions': 'creator_id,host_ids',
          'user.fields': USER_FIELDS,
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get Space Tweets ────────────────────────────────────────────────────────
  server.tool(
    'x_get_space_tweets',
    'Get tweets shared in a specific X Space.',
    {
      space_id: z.string().describe('The Space ID to get tweets from'),
      max_results: z.number().int().min(1).max(100).default(10).describe('Max results to return (1-100)'),
    },
    async ({ space_id, max_results }) => {
      try {
        const data = await appRequest<XApiResponse<XTweet[]>>('GET', `/spaces/${space_id}/tweets`, undefined, {
          max_results,
          'tweet.fields': TWEET_FIELDS,
          'expansions': 'author_id',
          'user.fields': USER_FIELDS,
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get User Spaces ─────────────────────────────────────────────────────────
  server.tool(
    'x_get_user_spaces',
    'Get Spaces created or hosted by a specific user.',
    {
      user_id: z.string().describe('The user ID whose Spaces to fetch'),
    },
    async ({ user_id }) => {
      try {
        const data = await appRequest<XApiResponse<XSpace[]>>('GET', `/users/${user_id}/spaces`, undefined, {
          'space.fields': SPACE_FIELDS,
          'expansions': 'creator_id,host_ids',
          'user.fields': USER_FIELDS,
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );
}
