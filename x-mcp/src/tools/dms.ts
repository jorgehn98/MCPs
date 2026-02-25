import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { userRequest, handleApiError, USER_FIELDS, TWEET_FIELDS } from '../client.js';
import type { XApiResponse } from '../types/x.js';

const DM_EVENT_FIELDS = 'id,text,created_at,sender_id,attachments,referenced_tweets,dm_conversation_id,event_type';

export function registerDmTools(server: McpServer) {

  // ── Send DM ─────────────────────────────────────────────────────────────────
  server.tool(
    'x_send_dm',
    'Send a direct message to a user. Creates a new 1:1 conversation if one doesn\'t exist. Requires dm.write scope.',
    {
      participant_id: z.string().describe('The user ID to send the message to'),
      text: z.string().min(1).max(10000).describe('The message text to send'),
      media_id: z.string().optional().describe('Optional media ID to attach (upload with x_upload_media first)'),
    },
    async ({ participant_id, text, media_id }) => {
      try {
        const body: Record<string, unknown> = { text };
        if (media_id) {
          body['attachments'] = [{ media_id }];
        }

        const data = await userRequest<{ data: { dm_conversation_id: string; dm_event_id: string } }>(
          'POST',
          `/dm_conversations/with/${participant_id}/messages`,
          body
        );

        return {
          content: [{
            type: 'text',
            text: `✅ DM sent!\nConversation ID: ${data.data.dm_conversation_id}\nEvent ID: ${data.data.dm_event_id}`,
          }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Send DM to Existing Conversation ───────────────────────────────────────
  server.tool(
    'x_send_dm_to_conversation',
    'Send a message to an existing DM conversation (1:1 or group) by conversation ID.',
    {
      conversation_id: z.string().describe('The DM conversation ID to send to'),
      text: z.string().min(1).max(10000).describe('The message text to send'),
      media_id: z.string().optional().describe('Optional media ID to attach'),
    },
    async ({ conversation_id, text, media_id }) => {
      try {
        const body: Record<string, unknown> = { text };
        if (media_id) {
          body['attachments'] = [{ media_id }];
        }

        const data = await userRequest<{ data: { dm_conversation_id: string; dm_event_id: string } }>(
          'POST',
          `/dm_conversations/${conversation_id}/messages`,
          body
        );

        return {
          content: [{
            type: 'text',
            text: `✅ Message sent to conversation ${conversation_id}!\nEvent ID: ${data.data.dm_event_id}`,
          }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Create Group DM ─────────────────────────────────────────────────────────
  server.tool(
    'x_create_group_dm',
    'Create a new group DM conversation with multiple participants and send an initial message.',
    {
      participant_ids: z.string().describe('Comma-separated user IDs to include in the group (at least 2)'),
      text: z.string().min(1).max(10000).describe('The initial message text'),
    },
    async ({ participant_ids, text }) => {
      try {
        const ids = participant_ids.split(',').map(id => id.trim());
        if (ids.length < 2) {
          return { content: [{ type: 'text', text: 'Error: Group DM requires at least 2 participant IDs.' }], isError: true };
        }

        const data = await userRequest<{ data: { dm_conversation_id: string; dm_event_id: string } }>(
          'POST',
          '/dm_conversations',
          {
            conversation_type: 'Group',
            participant_ids: ids,
            message: { text },
          }
        );

        return {
          content: [{
            type: 'text',
            text: `✅ Group DM created!\nConversation ID: ${data.data.dm_conversation_id}\nEvent ID: ${data.data.dm_event_id}`,
          }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get DM Events ───────────────────────────────────────────────────────────
  server.tool(
    'x_get_dm_events',
    'Get DM events across all conversations for the authenticated user (last 30 days). Returns messages, join events, and leave events.',
    {
      max_results: z.number().int().min(1).max(100).default(25).describe('Max events to return (1-100)'),
      pagination_token: z.string().optional().describe('Pagination token for next page'),
      event_types: z.string().optional().describe('Filter by event types: "MessageCreate", "ParticipantsJoin", "ParticipantsLeave" (comma-separated)'),
    },
    async ({ max_results, pagination_token, event_types }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'dm_event.fields': DM_EVENT_FIELDS,
          'expansions': 'sender_id,attachments.media_keys,referenced_tweets.id,participant_ids',
          'user.fields': USER_FIELDS,
          'tweet.fields': TWEET_FIELDS,
        };
        if (pagination_token) params['pagination_token'] = pagination_token;
        if (event_types) params['event_types'] = event_types;

        const data = await userRequest<XApiResponse<unknown[]>>('GET', '/dm_events', undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get DM Conversation Events ──────────────────────────────────────────────
  server.tool(
    'x_get_dm_conversation',
    'Get events/messages for a specific DM conversation by conversation ID.',
    {
      conversation_id: z.string().describe('The DM conversation ID to fetch events for'),
      max_results: z.number().int().min(1).max(100).default(25).describe('Max events to return (1-100)'),
      pagination_token: z.string().optional().describe('Pagination token'),
    },
    async ({ conversation_id, max_results, pagination_token }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'dm_event.fields': DM_EVENT_FIELDS,
          'expansions': 'sender_id,attachments.media_keys,referenced_tweets.id',
          'user.fields': USER_FIELDS,
          'tweet.fields': TWEET_FIELDS,
        };
        if (pagination_token) params['pagination_token'] = pagination_token;

        const data = await userRequest<XApiResponse<unknown[]>>(
          'GET',
          `/dm_conversations/${conversation_id}/dm_events`,
          undefined,
          params
        );
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get DM Conversation With User ───────────────────────────────────────────
  server.tool(
    'x_get_dm_conversation_with_user',
    'Get messages from the 1:1 DM conversation with a specific user, identified by their user ID.',
    {
      participant_id: z.string().describe('The other user\'s ID whose conversation to fetch'),
      max_results: z.number().int().min(1).max(100).default(25).describe('Max events to return (1-100)'),
      pagination_token: z.string().optional().describe('Pagination token'),
    },
    async ({ participant_id, max_results, pagination_token }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'dm_event.fields': DM_EVENT_FIELDS,
          'expansions': 'sender_id,attachments.media_keys',
          'user.fields': USER_FIELDS,
        };
        if (pagination_token) params['pagination_token'] = pagination_token;

        const data = await userRequest<XApiResponse<unknown[]>>(
          'GET',
          `/dm_conversations/with/${participant_id}/dm_events`,
          undefined,
          params
        );
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );
}
