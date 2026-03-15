import type { TaskRepository } from './ports/TaskRepository';
import type { SummaryGenerator } from './ports/SummaryGenerator';
import type { StandupRepository } from './ports/StandupRepository';
import { logger } from '../utils/logger';
import { todayISO } from '../utils/dateHelpers';

export class StandupService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly summarizer: SummaryGenerator,
    private readonly standup: StandupRepository
  ) {}

  async run(): Promise<void> {
    logger.info(`Running standup for ${todayISO()}`);

    try {
      const existingPageId = await this.standup.findTodayPageId();
      if (existingPageId) {
        logger.warn('Standup for today already exists — updating');
      }

      const { completed, active } = await this.tasks.fetchTasks();
      logger.info(`Fetched ${completed.length} completed, ${active.length} active tasks`);

      if (completed.length === 0 && active.length === 0) {
        logger.warn('No tasks found — writing empty standup');
      }

      const summary = await this.summarizer.generateSummary(completed, active);
      logger.info('Summary generated');

      const pageUrl = await this.standup.writeStandup(summary, completed, active, existingPageId ?? undefined);
      logger.info(`Standup written: ${pageUrl}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Standup failed: ${message}`);
      await this.standup.writeFailedStandup(message);
      throw err;
    }
  }
}
