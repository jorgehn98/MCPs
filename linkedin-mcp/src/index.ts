import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config } from 'dotenv';
import { registerProfileTools } from './tools/profile.js';
import { registerPostTools } from './tools/posts.js';
import { registerCommentTools } from './tools/comments.js';
import { registerReactionTools } from './tools/reactions.js';

config();

const server = new McpServer({
  name: 'linkedin-mcp',
  version: '1.0.0',
});

registerProfileTools(server);
registerPostTools(server);
registerCommentTools(server);
registerReactionTools(server);

const transport = new StdioServerTransport();

await server.connect(transport);
