/**
 * scripts/run-digest.ts
 *
 * Runs the weekly digest agent — reads this week's standup pages via
 * Notion MCP, synthesizes them into a digest, and writes it back.
 *
 * Usage:
 *   mise run digest
 *   mise run digest -- --verbose
 *   mise run digest -- --dry-run
 */

import 'dotenv/config';
import { runMcpDigestAgent } from '../src/adapters/mcp/McpDigestAgent';
import { logger } from '../src/utils/logger';

const verbose = process.argv.includes('--verbose') || process.argv.includes('-v') || process.env.VERBOSE === '1';
const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

const weekIdx = process.argv.indexOf('--week');
const weekOffset = weekIdx !== -1 && process.argv[weekIdx + 1] !== undefined
  ? parseInt(process.argv[weekIdx + 1], 10) || 0
  : 0;

if (verbose) {
  const mask = (val: string | undefined) => val ? `${val.slice(0, 8)}...${val.slice(-4)}` : 'NOT SET';
  logger.info('Environment:');
  logger.info(`  ANTHROPIC_API_KEY        = ${mask(process.env.ANTHROPIC_API_KEY)}`);
  logger.info(`  NOTION_API_KEY           = ${mask(process.env.NOTION_API_KEY)}`);
  logger.info(`  NOTION_STANDUP_LOG_DB_ID = ${process.env.NOTION_STANDUP_LOG_DB_ID ?? 'NOT SET'}`);
}

logger.info('Running weekly digest agent');

runMcpDigestAgent({ verbose, dryRun, weekOffset })
  .then((url) => {
    if (url) logger.info(`Digest written: ${url}`);
    logger.info('Done.');
  })
  .catch((err) => {
    logger.error(`Digest agent failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
