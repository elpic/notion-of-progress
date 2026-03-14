import cron from 'node-cron';
import { StandupService } from './core/standup';
import { NotionTaskRepository } from './adapters/notion/NotionTaskRepository';
import { NotionStandupRepository } from './adapters/notion/NotionStandupRepository';
import { ClaudeSummaryGenerator } from './adapters/claude/ClaudeSummaryGenerator';
import { config } from './config/index';
import { logger } from './utils/logger';

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err);
  process.exit(1);
});

const service = new StandupService(
  new NotionTaskRepository(),
  new ClaudeSummaryGenerator(),
  new NotionStandupRepository()
);

logger.info('Notion of Progress scheduler starting...');
logger.info(`Schedule: ${config.scheduler.cronSchedule} (${config.scheduler.timezone})`);

cron.schedule(
  config.scheduler.cronSchedule,
  async () => {
    try {
      await service.run();
    } catch (err) {
      logger.error('Standup run failed', err);
    }
  },
  { timezone: config.scheduler.timezone }
);

logger.info('Scheduler running. Waiting for next trigger...');
