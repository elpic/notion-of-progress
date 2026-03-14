// Manual trigger — runs the standup pipeline immediately without the scheduler.
// Use this for testing and demo recording: npm run standup

import { runStandup } from '../src/agent/standup.ts';
import { logger } from '../src/utils/logger.ts';

runStandup()
  .then(() => {
    logger.info('Done.');
    process.exit(0);
  })
  .catch((err) => {
    logger.error('Failed', err);
    process.exit(1);
  });
