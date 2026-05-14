import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config } from 'dotenv';
import { registerTweetTools } from './tools/tweets.js';
import { registerUserTools } from './tools/users.js';
import { registerDmTools } from './tools/dms.js';
import { registerListTools } from './tools/lists.js';
import { registerMediaTools } from './tools/media.js';
import { registerSpacesTools } from './tools/spaces.js';
import { registerTrendsTools } from './tools/trends.js';

config();

const server = new McpServer({
  name: 'x-mcp',
  version: '1.0.0',
});

registerTweetTools(server);
registerUserTools(server);
registerDmTools(server);
registerListTools(server);
registerMediaTools(server);
registerSpacesTools(server);
registerTrendsTools(server);

const transport = new StdioServerTransport();

await server.connect(transport);
