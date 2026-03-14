import 'dotenv/config';
import { getNotionClient } from '../src/notion/client.js';
import { config } from '../src/config/index.js';
import { logger } from '../src/utils/logger.js';

async function validateDB(dbId: string, name: string, requiredProps: string[]): Promise<void> {
  const notion = getNotionClient();
  const db = await notion.databases.retrieve({ database_id: dbId });

  const props = Object.keys(db.properties);
  const missing = requiredProps.filter((p) => !props.includes(p));

  if (missing.length > 0) {
    throw new Error(`${name} is missing properties: ${missing.join(', ')}`);
  }

  logger.info(`${name} OK — found properties: ${props.join(', ')}`);
}

async function main() {
  logger.info('Validating Notion workspace setup...');

  await validateDB(config.notion.taskDbId, 'Task DB', [
    config.notion.taskTitleProperty,
    config.notion.taskStatusProperty,
    'Due Date',
    'Priority',
  ]);

  await validateDB(config.notion.standupLogDbId, 'Standup Log', [
    'Title',
    'Date',
    'Status',
    'Tasks Reviewed',
  ]);

  logger.info('All databases validated. Your .env is correctly configured.');
  logger.info(`Task DB:      https://www.notion.so/${config.notion.taskDbId.replace(/-/g, '')}`);
  logger.info(`Standup Log:  https://www.notion.so/${config.notion.standupLogDbId.replace(/-/g, '')}`);
}

main().catch((err) => {
  logger.error('Setup failed:', err.message);
  process.exit(1);
});
