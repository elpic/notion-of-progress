/**
 * npm run setup
 *
 * Creates the Notion workspace for Notion of Progress:
 *   1. Creates a "Notion of Progress" parent page (workspace level)
 *   2. Creates the Task DB under it
 *   3. Creates the Standup Log DB under it
 *   4. Writes the DB IDs back into .env automatically
 *
 * If NOTION_TASK_DB_ID and NOTION_STANDUP_LOG_DB_ID are already set in .env,
 * it skips creation and just validates the existing databases.
 *
 * Only NOTION_API_KEY is required to run this script.
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@notionhq/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ENV_PATH = join(ROOT, '.env');

const NOTION_API_KEY = process.env.NOTION_API_KEY;

if (!NOTION_API_KEY) {
  console.error('ERROR: NOTION_API_KEY is not set. Add it to your .env file first.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_API_KEY });

function log(msg: string) {
  console.log(`  ${msg}`);
}

function updateEnv(key: string, value: string): void {
  let content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
  const line = `${key}=${value}`;
  const regex = new RegExp(`^${key}=.*`, 'm');

  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    content = content.trimEnd() + `\n${line}\n`;
  }

  writeFileSync(ENV_PATH, content, 'utf8');
}

async function createParentPage(): Promise<string> {
  log('Creating "Notion of Progress" workspace page...');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (notion.pages.create as any)({
    parent: { workspace: true },
    icon: { type: 'emoji', emoji: '📋' },
    properties: {
      title: { title: [{ type: 'text', text: { content: 'Notion of Progress' } }] },
    },
  });
  log(`  Created: https://www.notion.so/${response.id.replace(/-/g, '')}`);
  return response.id;
}

async function createTaskDB(parentPageId: string): Promise<string> {
  log('Creating Task DB...');
  const response = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: 'Task DB' } }],
    properties: {
      Name: { title: {} },
      Status: {
        select: {
          options: [
            { name: 'To Do', color: 'red' },
            { name: 'In Progress', color: 'yellow' },
            { name: 'Done', color: 'green' },
            { name: 'Blocked', color: 'orange' },
          ],
        },
      },
      Priority: {
        select: {
          options: [
            { name: 'High', color: 'red' },
            { name: 'Medium', color: 'yellow' },
            { name: 'Low', color: 'gray' },
          ],
        },
      },
      'Due Date': { date: {} },
      Notes: { rich_text: {} },
    },
  });
  log(`  Created: https://www.notion.so/${response.id.replace(/-/g, '')}`);
  return response.id;
}

async function createStandupLogDB(parentPageId: string): Promise<string> {
  log('Creating Standup Log DB...');
  const response = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: 'Standup Log' } }],
    properties: {
      Title: { title: {} },
      Date: { date: {} },
      Status: {
        select: {
          options: [
            { name: 'Generated', color: 'green' },
            { name: 'Draft', color: 'yellow' },
            { name: 'Failed', color: 'red' },
          ],
        },
      },
      'Tasks Reviewed': { number: { format: 'number' } },
    },
  });
  log(`  Created: https://www.notion.so/${response.id.replace(/-/g, '')}`);
  return response.id;
}

async function validateDB(dbId: string, name: string, requiredProps: string[]): Promise<void> {
  const db = await notion.databases.retrieve({ database_id: dbId });
  const props = Object.keys(db.properties);
  const missing = requiredProps.filter((p) => !props.includes(p));
  if (missing.length > 0) throw new Error(`${name} is missing properties: ${missing.join(', ')}`);
  log(`${name} ✓`);
}

async function main() {
  console.log('\n🚀 Notion of Progress — Setup\n');

  const existingTaskDbId = process.env.NOTION_TASK_DB_ID;
  const existingStandupDbId = process.env.NOTION_STANDUP_LOG_DB_ID;

  if (existingTaskDbId && existingStandupDbId) {
    console.log('Database IDs found in .env — validating existing databases...\n');
    await validateDB(existingTaskDbId, 'Task DB', ['Name', 'Status', 'Priority', 'Due Date']);
    await validateDB(existingStandupDbId, 'Standup Log', ['Title', 'Date', 'Status', 'Tasks Reviewed']);
    console.log('\n✅ All good! Run npm run standup to generate your first standup.\n');
    return;
  }

  console.log('No database IDs found — creating Notion workspace from scratch...\n');

  const parentPageId = await createParentPage();
  const taskDbId = await createTaskDB(parentPageId);
  const standupLogDbId = await createStandupLogDB(parentPageId);

  log('Writing DB IDs to .env...');
  updateEnv('NOTION_TASK_DB_ID', taskDbId);
  updateEnv('NOTION_STANDUP_LOG_DB_ID', standupLogDbId);

  console.log(`
✅ Setup complete!

  Parent page:  https://www.notion.so/${parentPageId.replace(/-/g, '')}
  Task DB:      https://www.notion.so/${taskDbId.replace(/-/g, '')}
  Standup Log:  https://www.notion.so/${standupLogDbId.replace(/-/g, '')}

  DB IDs have been saved to your .env automatically.

⚠️  Important: open the "Notion of Progress" page in Notion and
  connect your integration via ··· → Connect to → <your integration>

  Then run: npm run standup
`);
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
