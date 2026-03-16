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

const verbose = process.argv.includes('--verbose') || process.argv.includes('-v') || process.env.VERBOSE === '1';

logger.info(`Running MCP standup agent for ${todayISO()}`);

runMcpStandupAgent({ verbose })
  .then((url) => {
    logger.info(`Standup written: ${url}`);
    logger.info('Done.');
  })
  .catch((err) => {
    logger.error(`MCP agent failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
