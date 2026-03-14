import cron from 'node-cron';
import { runStandup } from './agent/standup.ts';
import { config } from './config/index.ts';
import { logger } from './utils/logger.ts';

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err);
  process.exit(1);
});

logger.info(`Notion of Progress scheduler starting...`);
logger.info(`Schedule: ${config.scheduler.cronSchedule} (${config.scheduler.timezone})`);

cron.schedule(
  config.scheduler.cronSchedule,
  async () => {
    try {
      await runStandup();
    } catch (err) {
      logger.error('Standup run failed', err);
    }
  },
  { timezone: config.scheduler.timezone }
);

logger.info('Scheduler running. Waiting for next trigger...');
