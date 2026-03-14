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

    const { completed, active } = await this.tasks.fetchTasks();
    logger.info(`Fetched ${completed.length} completed, ${active.length} active tasks`);

    const summary = await this.summarizer.generateSummary(completed, active);
    logger.info('Summary generated');

    const pageUrl = await this.standup.writeStandup(summary, completed.length + active.length);
    logger.info(`Standup written: ${pageUrl}`);
  }
}
