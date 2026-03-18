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

  // Validate existing databases
  if (existingTaskDbId) {
    console.log('Validating Task DB...');
    await validateDB(existingTaskDbId, 'Task DB', ['Name', 'Status', 'Priority', 'Due Date']);
  }
  
  if (existingStandupDbId) {
    console.log('Validating Standup Log...');
    await validateDB(existingStandupDbId, 'Standup Log', ['Title', 'Date', 'Status', 'Tasks Reviewed']);
  }
  
  if (existingSystemStatusDbId) {
    console.log('Validating System Status...');
    await validateDB(existingSystemStatusDbId, 'System Status', ['Title', 'Last Run', 'Status', 'Total Standups']);
  }
  
  // Check what needs to be created
  const needsTask = !existingTaskDbId;
  const needsStandup = !existingStandupDbId;
  const needsStatus = !existingSystemStatusDbId;
  
  if (!needsTask && !needsStandup && !needsStatus) {
    console.log('\n✅ All databases exist and are valid! Run npm run standup to generate your first standup.\n');
    return;
  }

  // Show what needs to be created
  console.log('\n🚀 Creating missing databases:');
  if (needsTask) console.log('  • Task DB — Your daily tasks and projects');
  if (needsStandup) console.log('  • Standup Log — Generated standup summaries');
  if (needsStatus) console.log('  • System Status — Live monitoring dashboard');
  console.log('');

  // Get parent page (either from existing setup or user input)
  let parentPageId: string;
  
  if (existingTaskDbId) {
    // If we have an existing Task DB, get its parent page
    try {
      const taskDb = await notion.databases.retrieve({ database_id: existingTaskDbId }) as any;
      parentPageId = taskDb.parent?.type === 'page_id' ? taskDb.parent.page_id : '';
      if (!parentPageId) throw new Error('Could not find parent page from existing Task DB');
      console.log('Using parent page from existing Task DB ✓\n');
    } catch {
      console.error('❌ Could not find parent page from existing databases. Please provide the page URL.');
      const pageUrl = await prompt('Paste the URL of your Notion parent page: ');
      parentPageId = extractPageId(pageUrl);
    }
  } else {
    // New setup - ask for parent page
    console.log('Before continuing, make sure you have:');
    console.log('  1. Created an empty page in Notion (e.g. "Notion of Progress")');
    console.log('  2. Connected your integration to it: ··· → Connections → <your integration>\n');

    const pageUrl = await prompt('Paste the URL of that Notion page: ');
    try {
      parentPageId = extractPageId(pageUrl);
    } catch (e) {
      console.error(`\n❌ ${(e as Error).message}`);
      process.exit(1);
    }
  }

  // Verify we can access the page
  try {
    await notion.pages.retrieve({ page_id: parentPageId });
    console.log('  Page found ✓\n');
  } catch {
    console.error('\n❌ Could not access that page. Make sure you connected your integration to it.\n');
    process.exit(1);
  }

  // Create only missing databases
  let taskDbId: string = existingTaskDbId || '';
  let standupLogDbId: string = existingStandupDbId || '';
  let systemStatusDbId: string = existingSystemStatusDbId || '';

  if (needsTask) {
    taskDbId = await createTaskDB(parentPageId);
  }
  
  if (needsStandup) {
    standupLogDbId = await createStandupLogDB(parentPageId);
  }
  
  if (needsStatus) {
    systemStatusDbId = await createSystemStatusDB(parentPageId);
  }

  // Update .env with any new IDs
  console.log('\n  Writing DB IDs to .env...');
  if (needsTask) updateEnv('NOTION_TASK_DB_ID', taskDbId);
  if (needsStandup) updateEnv('NOTION_STANDUP_LOG_DB_ID', standupLogDbId);
  if (needsStatus) updateEnv('NOTION_SYSTEM_STATUS_DB_ID', systemStatusDbId);

  console.log('\n✅ Setup complete!');
  console.log('\n  Database URLs:');
  
  if (taskDbId) {
    console.log(`  Task DB:        https://www.notion.so/${taskDbId.replace(/-/g, '')}`);
  }
  if (standupLogDbId) {
    console.log(`  Standup Log:    https://www.notion.so/${standupLogDbId.replace(/-/g, '')}`);
  }
  if (systemStatusDbId) {
    console.log(`  System Status:  https://www.notion.so/${systemStatusDbId.replace(/-/g, '')}`);
  }

  if (needsStatus) {
    console.log('\n  📊 The System Status page will show your system\'s live operational status!');
  }

  console.log('\n  DB IDs have been saved to your .env automatically.');
  console.log('\n  Run: npm run standup');
  console.log('');
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
