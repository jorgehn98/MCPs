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
        // /v2/userinfo (OpenID Connect) uses 'sub' as the member identifier
        const personUrn = `urn:li:person:${profile.sub}`;
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: profile.sub,
              urn: personUrn,
              firstName: profile.given_name,
              lastName: profile.family_name,
              name: profile.name,
              picture: profile.picture,
              email: profile.email,
              locale: profile.locale,
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
