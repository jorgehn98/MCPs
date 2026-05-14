import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getReactions, createReaction, deleteReaction, getMyProfile } from '../client.js';

const REACTION_TYPES = ['LIKE', 'PRAISE', 'EMPATHY', 'INTEREST', 'APPRECIATION', 'ENTERTAINMENT'] as const;

export function registerReactionTools(server: McpServer) {

  server.tool(
    'linkedin_get_reactions',
    'Get all reactions on a LinkedIn post or comment.',
    {
      entityUrn: z.string().describe('URN of the post or comment to get reactions for'),
    },
    async ({ entityUrn }) => {
      try {
        const result = await getReactions(entityUrn);
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
    'linkedin_add_reaction',
    'React to a LinkedIn post or comment. Reaction types: LIKE, PRAISE (Celebrate), EMPATHY (Love), INTEREST (Insightful), APPRECIATION (Support), ENTERTAINMENT (Funny).',
    {
      entityUrn: z.string().describe('URN of the post or comment to react to (can be share, ugcPost, activity, or comment URN)'),
      reactionType: z.enum(REACTION_TYPES).default('LIKE').describe('Type of reaction'),
      actorUrn: z.string().optional().describe('Override actor URN. Defaults to your person URN.'),
    },
    async ({ entityUrn, reactionType, actorUrn }) => {
      try {
        let actor = actorUrn;
        if (!actor) {
          const profile = await getMyProfile();
          actor = `urn:li:person:${profile.id}`;
        }
        await createReaction(actor, entityUrn, reactionType);
        return {
          content: [{ type: 'text', text: `✅ ${reactionType} reaction added to ${entityUrn}` }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  server.tool(
    'linkedin_delete_reaction',
    'Remove a reaction from a LinkedIn post or comment.',
    {
      entityUrn: z.string().describe('URN of the post or comment to remove the reaction from'),
      actorUrn: z.string().optional().describe('Override actor URN. Defaults to your person URN.'),
    },
    async ({ entityUrn, actorUrn }) => {
      try {
        let actor = actorUrn;
        if (!actor) {
          const profile = await getMyProfile();
          actor = `urn:li:person:${profile.id}`;
        }
        await deleteReaction(actor, entityUrn);
        return {
          content: [{ type: 'text', text: `✅ Reaction removed from ${entityUrn}` }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
