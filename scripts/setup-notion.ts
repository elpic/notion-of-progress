/**
 * npm run setup
 *
 * Creates the Notion workspace for Notion of Progress:
 *   1. Asks for a Notion page URL to use as the parent
 *   2. Creates the Task DB under it
 *   3. Creates the Standup Log DB under it
 *   4. Writes the DB IDs back into .env automatically
 *
 * If NOTION_TASK_DB_ID and NOTION_STANDUP_LOG_DB_ID are already set in .env,
 * it skips creation and just validates the existing databases.
 *
 * Only NOTION_API_KEY is required to run this script.
 *
 * Before running:
 *   1. Create an integration at https://www.notion.com/my-integrations
 *   2. Create an empty page in Notion (e.g. "Notion of Progress")
 *   3. Open that page → click ··· → Connections → connect your integration
 *   4. Copy the page URL and paste it when prompted
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { Client } from '@notionhq/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ENV_PATH = join(ROOT, '.env');

const NOTION_API_KEY = process.env.NOTION_API_KEY;

if (!NOTION_API_KEY) {
  console.error('\nERROR: NOTION_API_KEY is not set. Add it to your .env file first.\n');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_API_KEY });

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function extractPageId(input: string): string {
  // Handle full Notion URLs: https://www.notion.so/Page-Title-abc123def456
  // or bare UUIDs: abc123de-f456-...
  const urlMatch = input.match(/([a-f0-9]{32})(?:\?|$)/i) || input.match(/([a-f0-9-]{36})(?:\?|$)/i);
  if (urlMatch) return urlMatch[1].replace(/-/g, '');
  // Try stripping dashes from bare UUID
  const bare = input.replace(/-/g, '');
  if (/^[a-f0-9]{32}$/i.test(bare)) return bare;
  throw new Error(`Could not extract a page ID from: "${input}"`);
}

function updateEnv(key: string, value: string): void {
  let content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
  const line = `${key}=${value}`;
  const regex = new RegExp(`^#?\\s*${key}=.*`, 'm');

  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    content = content.trimEnd() + `\n${line}\n`;
  }

  writeFileSync(ENV_PATH, content, 'utf8');
}

async function createTaskDB(parentPageId: string): Promise<string> {
  console.log('  Creating Task DB...');
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
      Assignee: { people: {} },
    },
  });
  console.log(`  Task DB created ✓`);
  return response.id;
}

async function createStandupLogDB(parentPageId: string): Promise<string> {
  console.log('  Creating Standup Log DB...');
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
  console.log(`  Standup Log created ✓`);
  return response.id;
}

async function createSystemStatusDB(parentPageId: string): Promise<string> {
  console.log('  Creating System Status DB...');
  const response = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: 'System Status' } }],
    properties: {
      Title: { title: {} },
      'Last Run': { date: {} },
      Status: {
        select: {
          options: [
            { name: 'Operational', color: 'green' },
            { name: 'Degraded', color: 'yellow' },
            { name: 'Down', color: 'red' },
          ],
        },
      },
      'Total Standups': { number: { format: 'number' } },
      Environment: { rich_text: {} },
    },
  });
  console.log(`  System Status created ✓`);
  return response.id;
}

async function validateDB(dbId: string, name: string, requiredProps: string[]): Promise<void> {
  const db = await notion.databases.retrieve({ database_id: dbId });
  const props = Object.keys(db.properties);
  const missing = requiredProps.filter((p) => !props.includes(p));
  if (missing.length > 0) throw new Error(`${name} is missing properties: ${missing.join(', ')}`);
  console.log(`  ${name} ✓`);
}

async function main() {
  console.log('\n🚀 Notion of Progress — Setup\n');

  const existingTaskDbId = process.env.NOTION_TASK_DB_ID;
  const existingStandupDbId = process.env.NOTION_STANDUP_LOG_DB_ID;
  const existingSystemStatusDbId = process.env.NOTION_SYSTEM_STATUS_DB_ID;

  if (existingTaskDbId && existingStandupDbId) {
    console.log('Database IDs found in .env — validating existing databases...\n');
    await validateDB(existingTaskDbId, 'Task DB', ['Name', 'Status', 'Priority', 'Due Date']);
    await validateDB(existingStandupDbId, 'Standup Log', ['Title', 'Date', 'Status', 'Tasks Reviewed']);
    
    if (existingSystemStatusDbId) {
      await validateDB(existingSystemStatusDbId, 'System Status', ['Title', 'Last Run', 'Status', 'Total Standups']);
    } else {
      console.log('\n📊 System Status dashboard not found. Run this setup again to add the live monitoring dashboard!\n');
    }
    
    console.log('\n✅ All good! Run npm run standup to generate your first standup.\n');
    return;
  }

  console.log('Missing database IDs — creating new databases.\n');
  console.log('🚀 This will create 3 Notion databases:');
  console.log('  • Task DB — Your daily tasks and projects');
  console.log('  • Standup Log — Generated standup summaries');
  console.log('  • System Status — Live monitoring dashboard (NEW!)\n');
  console.log('Before continuing, make sure you have:');
  console.log('  1. Created an empty page in Notion (e.g. "Notion of Progress")');
  console.log('  2. Connected your integration to it: ··· → Connections → <your integration>\n');

  const pageUrl = await prompt('Paste the URL of that Notion page: ');
  let parentPageId: string;

  try {
    parentPageId = extractPageId(pageUrl);
  } catch (e) {
    console.error(`\n❌ ${(e as Error).message}`);
    process.exit(1);
  }

  // Verify we can access the page
  try {
    await notion.pages.retrieve({ page_id: parentPageId });
    console.log('\n  Page found ✓\n');
  } catch {
    console.error('\n❌ Could not access that page. Make sure you connected your integration to it.\n');
    process.exit(1);
  }

  const taskDbId = await createTaskDB(parentPageId);
  const standupLogDbId = await createStandupLogDB(parentPageId);
  const systemStatusDbId = await createSystemStatusDB(parentPageId);

  console.log('\n  Writing DB IDs to .env...');
  updateEnv('NOTION_TASK_DB_ID', taskDbId);
  updateEnv('NOTION_STANDUP_LOG_DB_ID', standupLogDbId);
  updateEnv('NOTION_SYSTEM_STATUS_DB_ID', systemStatusDbId);

  console.log(`
✅ Setup complete!

  Task DB:        https://www.notion.so/${taskDbId.replace(/-/g, '')}
  Standup Log:    https://www.notion.so/${standupLogDbId.replace(/-/g, '')}
  System Status:  https://www.notion.so/${systemStatusDbId.replace(/-/g, '')}

  📊 The System Status page will show your system's live operational status!

  DB IDs have been saved to your .env automatically.

  Run: npm run standup
`);
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
