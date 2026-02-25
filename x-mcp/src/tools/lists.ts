import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { userRequest, appRequest, handleApiError, USER_FIELDS, TWEET_FIELDS } from '../client.js';
import type { XApiResponse, XList, XUser, XTweet } from '../types/x.js';

const LIST_FIELDS = 'id,name,owner_id,description,private,created_at,follower_count,member_count';

export function registerListTools(server: McpServer) {

  // ── Create List ─────────────────────────────────────────────────────────────
  server.tool(
    'x_create_list',
    'Create a new X List. Returns the new list ID.',
    {
      name: z.string().min(1).max(25).describe('List name (max 25 characters)'),
      description: z.string().max(100).optional().describe('Optional list description (max 100 characters)'),
      private: z.boolean().default(false).describe('true for private list, false for public'),
    },
    async ({ name, description, private: isPrivate }) => {
      try {
        const body: Record<string, unknown> = { name, private: isPrivate };
        if (description) body['description'] = description;

        const data = await userRequest<{ data: { id: string; name: string } }>('POST', '/lists', body);
        return {
          content: [{
            type: 'text',
            text: `✅ List created!\nID: ${data.data.id}\nName: ${data.data.name}`,
          }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get List ────────────────────────────────────────────────────────────────
  server.tool(
    'x_get_list',
    'Get details about a specific X List by its ID.',
    {
      list_id: z.string().describe('The list ID to retrieve'),
    },
    async ({ list_id }) => {
      try {
        const data = await appRequest<XApiResponse<XList>>('GET', `/lists/${list_id}`, undefined, {
          'list.fields': LIST_FIELDS,
          'expansions': 'owner_id',
          'user.fields': USER_FIELDS,
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Update List ─────────────────────────────────────────────────────────────
  server.tool(
    'x_update_list',
    'Update a list\'s name, description, or privacy setting.',
    {
      list_id: z.string().describe('The list ID to update'),
      name: z.string().min(1).max(25).optional().describe('New name for the list'),
      description: z.string().max(100).optional().describe('New description for the list'),
      private: z.boolean().optional().describe('true for private, false for public'),
    },
    async ({ list_id, name, description, private: isPrivate }) => {
      try {
        const body: Record<string, unknown> = {};
        if (name !== undefined) body['name'] = name;
        if (description !== undefined) body['description'] = description;
        if (isPrivate !== undefined) body['private'] = isPrivate;

        if (Object.keys(body).length === 0) {
          return { content: [{ type: 'text', text: 'Error: provide at least one field to update (name, description, or private).' }], isError: true };
        }

        await userRequest('PUT', `/lists/${list_id}`, body);
        return { content: [{ type: 'text', text: `✅ List ${list_id} updated.` }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Delete List ─────────────────────────────────────────────────────────────
  server.tool(
    'x_delete_list',
    'Delete a list. This action is irreversible.',
    {
      list_id: z.string().describe('The list ID to delete'),
    },
    async ({ list_id }) => {
      try {
        const data = await userRequest<{ data: { deleted: boolean } }>('DELETE', `/lists/${list_id}`);
        if (data.data.deleted) {
          return { content: [{ type: 'text', text: `✅ List ${list_id} deleted.` }] };
        }
        return { content: [{ type: 'text', text: 'List could not be deleted.' }], isError: true };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get List Tweets ─────────────────────────────────────────────────────────
  server.tool(
    'x_get_list_tweets',
    'Get tweets from a specific list\'s timeline.',
    {
      list_id: z.string().describe('The list ID to fetch tweets from'),
      max_results: z.number().int().min(1).max(100).default(20).describe('Max results per page (1-100)'),
      pagination_token: z.string().optional().describe('Pagination token'),
    },
    async ({ list_id, max_results, pagination_token }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'tweet.fields': TWEET_FIELDS,
          'expansions': 'author_id,attachments.media_keys',
          'user.fields': USER_FIELDS,
        };
        if (pagination_token) params['pagination_token'] = pagination_token;

        const data = await appRequest<XApiResponse<XTweet[]>>('GET', `/lists/${list_id}/tweets`, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get User's Lists ────────────────────────────────────────────────────────
  server.tool(
    'x_get_user_lists',
    'Get lists owned by a specific user.',
    {
      user_id: z.string().describe('The user ID whose lists to fetch'),
      max_results: z.number().int().min(1).max(100).default(10).describe('Max results per page (1-100)'),
      pagination_token: z.string().optional().describe('Pagination token'),
    },
    async ({ user_id, max_results, pagination_token }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'list.fields': LIST_FIELDS,
          'expansions': 'owner_id',
          'user.fields': USER_FIELDS,
        };
        if (pagination_token) params['pagination_token'] = pagination_token;

        const data = await appRequest<XApiResponse<XList[]>>('GET', `/users/${user_id}/owned_lists`, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get User's Followed Lists ───────────────────────────────────────────────
  server.tool(
    'x_get_followed_lists',
    'Get lists followed by a specific user.',
    {
      user_id: z.string().describe('The user ID whose followed lists to fetch'),
      max_results: z.number().int().min(1).max(100).default(10).describe('Max results per page (1-100)'),
      pagination_token: z.string().optional().describe('Pagination token'),
    },
    async ({ user_id, max_results, pagination_token }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'list.fields': LIST_FIELDS,
          'expansions': 'owner_id',
          'user.fields': USER_FIELDS,
        };
        if (pagination_token) params['pagination_token'] = pagination_token;

        const data = await appRequest<XApiResponse<XList[]>>('GET', `/users/${user_id}/followed_lists`, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get List Members ────────────────────────────────────────────────────────
  server.tool(
    'x_get_list_members',
    'Get members of a specific list.',
    {
      list_id: z.string().describe('The list ID to get members of'),
      max_results: z.number().int().min(1).max(100).default(50).describe('Max results per page (1-100)'),
      pagination_token: z.string().optional().describe('Pagination token'),
    },
    async ({ list_id, max_results, pagination_token }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'user.fields': USER_FIELDS,
        };
        if (pagination_token) params['pagination_token'] = pagination_token;

        const data = await appRequest<XApiResponse<XUser[]>>('GET', `/lists/${list_id}/members`, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Add List Member ─────────────────────────────────────────────────────────
  server.tool(
    'x_add_list_member',
    'Add a user to a list that you own.',
    {
      list_id: z.string().describe('The list ID to add the member to'),
      user_id: z.string().describe('The user ID to add to the list'),
    },
    async ({ list_id, user_id }) => {
      try {
        const data = await userRequest<{ data: { is_member: boolean } }>(
          'POST',
          `/lists/${list_id}/members`,
          { user_id }
        );
        if (data.data.is_member) {
          return { content: [{ type: 'text', text: `✅ User ${user_id} added to list ${list_id}.` }] };
        }
        return { content: [{ type: 'text', text: 'Could not add user to list.' }], isError: true };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Remove List Member ──────────────────────────────────────────────────────
  server.tool(
    'x_remove_list_member',
    'Remove a user from a list that you own.',
    {
      list_id: z.string().describe('The list ID to remove the member from'),
      user_id: z.string().describe('The user ID to remove from the list'),
    },
    async ({ list_id, user_id }) => {
      try {
        const data = await userRequest<{ data: { is_member: boolean } }>(
          'DELETE',
          `/lists/${list_id}/members/${user_id}`
        );
        if (!data.data.is_member) {
          return { content: [{ type: 'text', text: `✅ User ${user_id} removed from list ${list_id}.` }] };
        }
        return { content: [{ type: 'text', text: 'Could not remove user from list.' }], isError: true };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Follow List ─────────────────────────────────────────────────────────────
  server.tool(
    'x_follow_list',
    'Follow a list on behalf of the authenticated user.',
    {
      user_id: z.string().describe('Your user ID (get it with x_get_me)'),
      list_id: z.string().describe('The list ID to follow'),
    },
    async ({ user_id, list_id }) => {
      try {
        const data = await userRequest<{ data: { following: boolean } }>(
          'POST',
          `/users/${user_id}/followed_lists`,
          { list_id }
        );
        if (data.data.following) {
          return { content: [{ type: 'text', text: `✅ Now following list ${list_id}.` }] };
        }
        return { content: [{ type: 'text', text: 'Could not follow list.' }], isError: true };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Unfollow List ───────────────────────────────────────────────────────────
  server.tool(
    'x_unfollow_list',
    'Unfollow a list on behalf of the authenticated user.',
    {
      user_id: z.string().describe('Your user ID (get it with x_get_me)'),
      list_id: z.string().describe('The list ID to unfollow'),
    },
    async ({ user_id, list_id }) => {
      try {
        const data = await userRequest<{ data: { following: boolean } }>(
          'DELETE',
          `/users/${user_id}/followed_lists/${list_id}`
        );
        if (!data.data.following) {
          return { content: [{ type: 'text', text: `✅ Unfollowed list ${list_id}.` }] };
        }
        return { content: [{ type: 'text', text: 'Could not unfollow list.' }], isError: true };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );
}
