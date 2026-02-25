import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { userRequest, appRequest, handleApiError, USER_FIELDS, TWEET_FIELDS } from '../client.js';
import type { XApiResponse, XUser } from '../types/x.js';

export function registerUserTools(server: McpServer) {

  // ── Get Me ──────────────────────────────────────────────────────────────────
  server.tool(
    'x_get_me',
    'Get the authenticated user\'s profile information including ID, username, bio, and metrics. Use this to get your user_id for other tools.',
    {},
    async () => {
      try {
        const data = await userRequest<XApiResponse<XUser>>('GET', '/users/me', undefined, {
          'user.fields': USER_FIELDS,
          'expansions': 'pinned_tweet_id',
          'tweet.fields': TWEET_FIELDS,
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get User By ID ──────────────────────────────────────────────────────────
  server.tool(
    'x_get_user_by_id',
    'Get a user\'s profile by their X user ID.',
    {
      user_id: z.string().describe('The X user ID to look up'),
    },
    async ({ user_id }) => {
      try {
        const data = await appRequest<XApiResponse<XUser>>('GET', `/users/${user_id}`, undefined, {
          'user.fields': USER_FIELDS,
          'expansions': 'pinned_tweet_id',
          'tweet.fields': TWEET_FIELDS,
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get User By Username ────────────────────────────────────────────────────
  server.tool(
    'x_get_user_by_username',
    'Get a user\'s profile by their X username (handle). Do not include the @ symbol.',
    {
      username: z.string().describe('The X username to look up (without @). Example: "elonmusk"'),
    },
    async ({ username }) => {
      try {
        const data = await appRequest<XApiResponse<XUser>>('GET', `/users/by/username/${username}`, undefined, {
          'user.fields': USER_FIELDS,
          'expansions': 'pinned_tweet_id',
          'tweet.fields': TWEET_FIELDS,
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get Multiple Users By Usernames ─────────────────────────────────────────
  server.tool(
    'x_get_users_by_usernames',
    'Get multiple users\' profiles by their usernames in one request (up to 100).',
    {
      usernames: z.string().describe('Comma-separated usernames (without @). Example: "elonmusk,jack,twitter"'),
    },
    async ({ usernames }) => {
      try {
        const data = await appRequest<XApiResponse<XUser[]>>('GET', '/users/by', undefined, {
          usernames,
          'user.fields': USER_FIELDS,
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Follow User ─────────────────────────────────────────────────────────────
  server.tool(
    'x_follow_user',
    'Follow a user on behalf of the authenticated user.',
    {
      user_id: z.string().describe('Your user ID (get it with x_get_me)'),
      target_user_id: z.string().describe('The user ID to follow'),
    },
    async ({ user_id, target_user_id }) => {
      try {
        const data = await userRequest<{ data: { following: boolean; pending_follow: boolean } }>(
          'POST',
          `/users/${user_id}/following`,
          { target_user_id }
        );
        const { following, pending_follow } = data.data;
        if (following) {
          return { content: [{ type: 'text', text: `✅ Now following user ${target_user_id}.` }] };
        }
        if (pending_follow) {
          return { content: [{ type: 'text', text: `⏳ Follow request sent to user ${target_user_id} (protected account).` }] };
        }
        return { content: [{ type: 'text', text: 'Follow action completed but status unclear.' }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Unfollow User ───────────────────────────────────────────────────────────
  server.tool(
    'x_unfollow_user',
    'Unfollow a user on behalf of the authenticated user.',
    {
      user_id: z.string().describe('Your user ID (get it with x_get_me)'),
      target_user_id: z.string().describe('The user ID to unfollow'),
    },
    async ({ user_id, target_user_id }) => {
      try {
        const data = await userRequest<{ data: { following: boolean } }>(
          'DELETE',
          `/users/${user_id}/following/${target_user_id}`
        );
        if (!data.data.following) {
          return { content: [{ type: 'text', text: `✅ Unfollowed user ${target_user_id}.` }] };
        }
        return { content: [{ type: 'text', text: 'Could not unfollow user.' }], isError: true };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get Followers ───────────────────────────────────────────────────────────
  server.tool(
    'x_get_followers',
    'Get a user\'s followers list (paginated, up to 1000 per page).',
    {
      user_id: z.string().describe('The user ID whose followers to fetch'),
      max_results: z.number().int().min(1).max(1000).default(100).describe('Max results per page (1-1000)'),
      pagination_token: z.string().optional().describe('Pagination token from previous response'),
    },
    async ({ user_id, max_results, pagination_token }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'user.fields': USER_FIELDS,
          'expansions': 'pinned_tweet_id',
          'tweet.fields': TWEET_FIELDS,
        };
        if (pagination_token) params['pagination_token'] = pagination_token;

        const data = await appRequest<XApiResponse<XUser[]>>('GET', `/users/${user_id}/followers`, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get Following ───────────────────────────────────────────────────────────
  server.tool(
    'x_get_following',
    'Get users that a specific user is following (paginated, up to 1000 per page).',
    {
      user_id: z.string().describe('The user ID whose following list to fetch'),
      max_results: z.number().int().min(1).max(1000).default(100).describe('Max results per page (1-1000)'),
      pagination_token: z.string().optional().describe('Pagination token from previous response'),
    },
    async ({ user_id, max_results, pagination_token }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'user.fields': USER_FIELDS,
          'expansions': 'pinned_tweet_id',
          'tweet.fields': TWEET_FIELDS,
        };
        if (pagination_token) params['pagination_token'] = pagination_token;

        const data = await appRequest<XApiResponse<XUser[]>>('GET', `/users/${user_id}/following`, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Block User ──────────────────────────────────────────────────────────────
  server.tool(
    'x_block_user',
    'Block a user on behalf of the authenticated user.',
    {
      user_id: z.string().describe('Your user ID (get it with x_get_me)'),
      target_user_id: z.string().describe('The user ID to block'),
    },
    async ({ user_id, target_user_id }) => {
      try {
        const data = await userRequest<{ data: { blocking: boolean } }>(
          'POST',
          `/users/${user_id}/blocking`,
          { target_user_id }
        );
        if (data.data.blocking) {
          return { content: [{ type: 'text', text: `✅ User ${target_user_id} blocked.` }] };
        }
        return { content: [{ type: 'text', text: 'Could not block user.' }], isError: true };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Unblock User ────────────────────────────────────────────────────────────
  server.tool(
    'x_unblock_user',
    'Unblock a user on behalf of the authenticated user.',
    {
      user_id: z.string().describe('Your user ID (get it with x_get_me)'),
      target_user_id: z.string().describe('The user ID to unblock'),
    },
    async ({ user_id, target_user_id }) => {
      try {
        const data = await userRequest<{ data: { blocking: boolean } }>(
          'DELETE',
          `/users/${user_id}/blocking/${target_user_id}`
        );
        if (!data.data.blocking) {
          return { content: [{ type: 'text', text: `✅ User ${target_user_id} unblocked.` }] };
        }
        return { content: [{ type: 'text', text: 'Could not unblock user.' }], isError: true };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get Blocked Users ───────────────────────────────────────────────────────
  server.tool(
    'x_get_blocked_users',
    'Get the list of users blocked by the authenticated user.',
    {
      user_id: z.string().describe('Your user ID (get it with x_get_me)'),
      max_results: z.number().int().min(1).max(1000).default(100).describe('Max results per page'),
      pagination_token: z.string().optional().describe('Pagination token'),
    },
    async ({ user_id, max_results, pagination_token }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'user.fields': USER_FIELDS,
        };
        if (pagination_token) params['pagination_token'] = pagination_token;

        const data = await userRequest<XApiResponse<XUser[]>>('GET', `/users/${user_id}/blocking`, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Mute User ───────────────────────────────────────────────────────────────
  server.tool(
    'x_mute_user',
    'Mute a user on behalf of the authenticated user.',
    {
      user_id: z.string().describe('Your user ID (get it with x_get_me)'),
      target_user_id: z.string().describe('The user ID to mute'),
    },
    async ({ user_id, target_user_id }) => {
      try {
        const data = await userRequest<{ data: { muting: boolean } }>(
          'POST',
          `/users/${user_id}/muting`,
          { target_user_id }
        );
        if (data.data.muting) {
          return { content: [{ type: 'text', text: `✅ User ${target_user_id} muted.` }] };
        }
        return { content: [{ type: 'text', text: 'Could not mute user.' }], isError: true };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Unmute User ─────────────────────────────────────────────────────────────
  server.tool(
    'x_unmute_user',
    'Unmute a user on behalf of the authenticated user.',
    {
      user_id: z.string().describe('Your user ID (get it with x_get_me)'),
      target_user_id: z.string().describe('The user ID to unmute'),
    },
    async ({ user_id, target_user_id }) => {
      try {
        const data = await userRequest<{ data: { muting: boolean } }>(
          'DELETE',
          `/users/${user_id}/muting/${target_user_id}`
        );
        if (!data.data.muting) {
          return { content: [{ type: 'text', text: `✅ User ${target_user_id} unmuted.` }] };
        }
        return { content: [{ type: 'text', text: 'Could not unmute user.' }], isError: true };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get Muted Users ─────────────────────────────────────────────────────────
  server.tool(
    'x_get_muted_users',
    'Get the list of users muted by the authenticated user.',
    {
      user_id: z.string().describe('Your user ID (get it with x_get_me)'),
      max_results: z.number().int().min(1).max(1000).default(100).describe('Max results per page'),
      pagination_token: z.string().optional().describe('Pagination token'),
    },
    async ({ user_id, max_results, pagination_token }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'user.fields': USER_FIELDS,
        };
        if (pagination_token) params['pagination_token'] = pagination_token;

        const data = await userRequest<XApiResponse<XUser[]>>('GET', `/users/${user_id}/muting`, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );
}
