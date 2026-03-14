// Manual trigger — runs the standup pipeline immediately without the scheduler.
// Use this for testing and demo recording: npm run standup

import { StandupService } from '../src/core/standup';
import { NotionTaskRepository } from '../src/adapters/notion/NotionTaskRepository';
import { NotionStandupRepository } from '../src/adapters/notion/NotionStandupRepository';
import { ClaudeSummaryGenerator } from '../src/adapters/claude/ClaudeSummaryGenerator';
import { logger } from '../src/utils/logger';

const service = new StandupService(
  new NotionTaskRepository(),
  new ClaudeSummaryGenerator(),
  new NotionStandupRepository()
);

service.run()
  .then(() => {
    logger.info('Done.');
    process.exit(0);
  })
  .catch((err) => {
    logger.error('Failed', err);
    process.exit(1);
  });
