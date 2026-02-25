import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getMyProfile } from '../client.js';

export function registerProfileTools(server: McpServer) {
  server.tool(
    'linkedin_get_my_profile',
    'Get the authenticated LinkedIn member\'s profile (name, headline, URN, vanity URL)',
    {},
    async () => {
      try {
        const profile = await getMyProfile();
        const personUrn = `urn:li:person:${profile.id}`;
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: profile.id,
              urn: personUrn,
              firstName: profile.localizedFirstName,
              lastName: profile.localizedLastName,
              headline: profile.localizedHeadline,
              vanityName: profile.vanityName,
              profileUrl: profile.vanityName
                ? `https://www.linkedin.com/in/${profile.vanityName}`
                : null,
            }, null, 2),
          }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
