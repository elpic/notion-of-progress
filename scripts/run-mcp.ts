/**
 * npm run standup:mcp
 *
 * Runs the standup using the Claude Agent SDK with Notion MCP.
 * Claude autonomously reads tasks, generates summaries, and writes
 * the standup page — all via Notion MCP tool calls.
 */

import 'dotenv/config';
import { runMcpStandupAgent } from '../src/adapters/mcp/McpStandupAgent';
import { logger } from '../src/utils/logger';
import { todayISO } from '../src/utils/dateHelpers';

logger.info(`Running MCP standup agent for ${todayISO()}`);

runMcpStandupAgent()
  .then((url) => {
    logger.info(`Standup written: ${url}`);
    logger.info('Done.');
  })
  .catch((err) => {
    logger.error(`MCP agent failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
