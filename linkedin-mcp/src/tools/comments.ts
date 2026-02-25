import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getComments, createComment, deleteComment, getMyProfile } from '../client.js';

export function registerCommentTools(server: McpServer) {

  server.tool(
    'linkedin_get_comments',
    'Get all comments on a LinkedIn post or on another comment (nested).',
    {
      postUrn: z.string().describe('URN of the post or comment to get comments from'),
    },
    async ({ postUrn }) => {
      try {
        const result = await getComments(postUrn);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  server.tool(
    'linkedin_add_comment',
    'Add a comment to a LinkedIn post. Optionally reply to an existing comment.',
    {
      postUrn: z.string().describe('URN of the post to comment on'),
      text: z.string().min(1).max(1250).describe('Comment text (max 1250 chars)'),
      parentCommentUrn: z.string().optional().describe('Optional: URN of a comment to reply to (for nested comments)'),
      actorUrn: z.string().optional().describe('Override actor URN. Defaults to your person URN.'),
    },
    async ({ postUrn, text, parentCommentUrn, actorUrn }) => {
      try {
        let actor = actorUrn;
        if (!actor) {
          const profile = await getMyProfile();
          actor = `urn:li:person:${profile.id}`;
        }
        const commentId = await createComment(postUrn, actor, text, parentCommentUrn);
        return {
          content: [{ type: 'text', text: `✅ Comment added!\nComment ID: ${commentId}` }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  server.tool(
    'linkedin_delete_comment',
    'Delete a comment from a LinkedIn post.',
    {
      postUrn: z.string().describe('URN of the post the comment belongs to'),
      commentId: z.string().describe('ID of the comment to delete'),
      actorUrn: z.string().optional().describe('Required when deleting as an organization. Defaults to your person URN for personal accounts.'),
    },
    async ({ postUrn, commentId, actorUrn }) => {
      try {
        await deleteComment(postUrn, commentId, actorUrn);
        return {
          content: [{ type: 'text', text: `✅ Comment ${commentId} deleted from post ${postUrn}` }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
