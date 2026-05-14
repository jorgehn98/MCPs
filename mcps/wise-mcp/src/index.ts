import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config } from 'dotenv';
import { registerAccountTools } from './tools/accounts.js';
import { registerTransactionTools } from './tools/transactions.js';
import { registerRateTools } from './tools/rates.js';

config();

const server = new McpServer({
  name: 'wise-mcp',
  version: '1.0.0',
});

registerAccountTools(server);
registerTransactionTools(server);
registerRateTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
