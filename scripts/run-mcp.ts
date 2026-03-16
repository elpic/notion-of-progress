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
const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

if (verbose) {
  const mask = (val: string | undefined) => val ? `${val.slice(0, 8)}...${val.slice(-4)}` : 'NOT SET';
  logger.info('Environment:');
  logger.info(`  ANTHROPIC_API_KEY  = ${mask(process.env.ANTHROPIC_API_KEY)}`);
  logger.info(`  NOTION_API_KEY     = ${mask(process.env.NOTION_API_KEY)}`);
  logger.info(`  NOTION_TASK_DB_ID  = ${process.env.NOTION_TASK_DB_ID ?? 'NOT SET'}`);
  logger.info(`  NOTION_STANDUP_LOG_DB_ID = ${process.env.NOTION_STANDUP_LOG_DB_ID ?? 'NOT SET'}`);
}

logger.info(`Running MCP standup agent for ${todayISO()}`);

runMcpStandupAgent({ verbose, dryRun })
  .then((url) => {
    if (url) logger.info(`Standup written: ${url}`);
    logger.info('Done.');
  })
  .catch((err) => {
    logger.error(`MCP agent failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
