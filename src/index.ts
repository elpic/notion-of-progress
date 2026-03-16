import cron from 'node-cron';
import { runMcpStandupAgent } from './adapters/mcp/McpStandupAgent';
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

logger.info('Scheduler running. Waiting for next trigger...');
