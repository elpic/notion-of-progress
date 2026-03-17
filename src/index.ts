import cron from 'node-cron';
import { runMcpStandupAgent } from './adapters/mcp/McpStandupAgent';
import { runMcpDigestAgent } from './adapters/mcp/McpDigestAgent';
import { NotionStandupRepository } from './adapters/notion/NotionStandupRepository';
import { config } from './config/index';
import { logger } from './utils/logger';

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err);
  process.exit(1);
});

logger.info('Notion of Progress scheduler starting...');
logger.info(`Schedule: ${config.scheduler.cronSchedule} (${config.scheduler.timezone})`);

cron.schedule(
  config.scheduler.cronSchedule,
  async () => {
    try {
      const url = await runMcpStandupAgent();
      logger.info(`Standup written: ${url}`);
    } catch (err) {
      logger.error('Standup run failed', err);
      const message = err instanceof Error ? err.message : String(err);
      await new NotionStandupRepository().writeFailedStandup(message).catch(() => {});
    }
  },
  { timezone: config.scheduler.timezone }
);

// Weekly digest — every Friday at 17:00 (configurable)
logger.info(`Digest schedule: ${config.scheduler.digestCronSchedule} (${config.scheduler.timezone})`);

cron.schedule(
  config.scheduler.digestCronSchedule,
  async () => {
    try {
      const url = await runMcpDigestAgent();
      logger.info(`Weekly digest written: ${url}`);
    } catch (err) {
      logger.error('Weekly digest run failed', err);
    }
  },
  { timezone: config.scheduler.timezone }
);

logger.info('Scheduler running. Waiting for next trigger...');
