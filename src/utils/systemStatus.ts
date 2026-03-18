/**
 * System Status Management
 * 
 * Handles updating the live system status page in Notion.
 * Creates a real-time dashboard showing the agent's operational status.
 */

import type { Client } from '@notionhq/client';
import { getNotionClient } from '../notion/client';
import { config } from '../config/index';
import { withRetry, isNotionRateLimit } from './retry';
import { todayFormatted } from './dateHelpers';
import { randomIcon } from './icons';

type CreatePageParams = Parameters<Client['pages']['create']>[0];
type BlockRequest = NonNullable<CreatePageParams['children']>[number];
type RichText = Extract<BlockRequest, { type?: 'paragraph' }>['paragraph']['rich_text'][number];

function richText(content: string, opts: { bold?: boolean } = {}): RichText {
  return {
    type: 'text',
    text: { content, link: null },
    annotations: {
      bold: opts.bold || false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: 'default',
    },
  } as RichText;
}

interface SystemStatus {
  lastRun: string;           // ISO timestamp
  status: 'Operational' | 'Degraded' | 'Down';
  totalStandups: number;     // All-time count
  environment: string;       // "Local" | "GitHub Actions"
}

/**
 * Updates the system status page with current operational metrics.
 * Creates a new page if none exists for today, or updates the existing one.
 */
export async function updateSystemStatus(
  status: SystemStatus,
  error?: string
): Promise<string> {
  // Skip if System Status database is not configured
  if (!config.notion.systemStatusDbId) {
    return ''; // Silently skip - not an error
  }

  const notion = getNotionClient();
  
  // Find today's status page (or create if none exists)
  const existingPageId = await withRetry(
    () => findTodayStatusPageId(),
    { attempts: 3, delayMs: 1000, shouldRetry: isNotionRateLimit }
  );

  const statusEmoji = status.status === 'Operational' ? '🟢' : 
                     status.status === 'Degraded' ? '🟡' : '🔴';

  const title = `System Status - ${todayFormatted()}`;
  const lastRunFormatted = new Date(status.lastRun).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  if (existingPageId) {
    // Update existing page
    await withRetry(
      () => updateStatusPage(existingPageId, {
        title,
        statusEmoji,
        status: status.status,
        lastRun: lastRunFormatted,
        totalStandups: status.totalStandups,
        environment: status.environment,
        error,
      }),
      { attempts: 3, delayMs: 1000, shouldRetry: isNotionRateLimit }
    );
    return `https://www.notion.so/${existingPageId.replace(/-/g, '')}`;
  } else {
    // Create new page
    const pageId = await withRetry(
      () => createStatusPage({
        title,
        statusEmoji,
        status: status.status,
        lastRun: lastRunFormatted,
        totalStandups: status.totalStandups,
        environment: status.environment,
        error,
      }),
      { attempts: 3, delayMs: 1000, shouldRetry: isNotionRateLimit }
    );
    return `https://www.notion.so/${pageId.replace(/-/g, '')}`;
  }
}

async function findTodayStatusPageId(): Promise<string | null> {
  if (!config.notion.systemStatusDbId) return null;
  
  const notion = getNotionClient();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const response = await notion.databases.query({
    database_id: config.notion.systemStatusDbId,
    filter: {
      and: [
        {
          property: 'Last Run',
          date: {
            on_or_after: today,
          },
        },
      ],
    },
    sorts: [{ property: 'Last Run', direction: 'descending' }],
    page_size: 1,
  });

  return response.results.length > 0 ? response.results[0].id : null;
}

interface StatusPageData {
  title: string;
  statusEmoji: string;
  status: string;
  lastRun: string;
  totalStandups: number;
  environment: string;
  error?: string;
}

async function createStatusPage(data: StatusPageData): Promise<string> {
  if (!config.notion.systemStatusDbId) throw new Error('System Status DB ID not configured');
  
  const notion = getNotionClient();
  
  const response = await notion.pages.create({
    parent: { type: 'database_id', database_id: config.notion.systemStatusDbId },
    icon: { type: 'emoji', emoji: randomIcon() as never },
    properties: {
      Title: {
        title: [{ type: 'text', text: { content: data.title } }],
      },
      'Last Run': {
        date: { start: new Date().toISOString() },
      },
      Status: {
        select: { name: data.status },
      },
      'Total Standups': {
        number: data.totalStandups,
      },
      Environment: {
        rich_text: [{ type: 'text', text: { content: data.environment } }],
      },
    },
    children: buildStatusBlocks(data),
  });

  return response.id;
}

async function updateStatusPage(pageId: string, data: StatusPageData): Promise<void> {
  const notion = getNotionClient();

  // Update properties
  await notion.pages.update({
    page_id: pageId,
    properties: {
      'Last Run': {
        date: { start: new Date().toISOString() },
      },
      Status: {
        select: { name: data.status },
      },
      'Total Standups': {
        number: data.totalStandups,
      },
      Environment: {
        rich_text: [{ type: 'text', text: { content: data.environment } }],
      },
    },
  });

  // Replace page content with updated blocks
  // First, get all existing blocks
  const blocks = await notion.blocks.children.list({ 
    block_id: pageId,
    page_size: 100,
  });

  // Delete all existing blocks
  if (blocks.results.length > 0) {
    await Promise.all(
      blocks.results.map(block => 
        withRetry(
          () => notion.blocks.delete({ block_id: block.id }),
          { attempts: 3, delayMs: 500, shouldRetry: isNotionRateLimit }
        )
      )
    );
  }

  // Add new content
  await notion.blocks.children.append({
    block_id: pageId,
    children: buildStatusBlocks(data),
  });
}

function buildStatusBlocks(data: StatusPageData): BlockRequest[] {
  const blocks: BlockRequest[] = [
    // Status header
    {
      type: 'callout',
      callout: {
        rich_text: [richText(`${data.statusEmoji} Status: ${data.status}`, { bold: true })],
        icon: { type: 'emoji', emoji: data.statusEmoji } as { type: 'emoji'; emoji: never },
        color: data.status === 'Operational' ? 'green_background' : 
               data.status === 'Degraded' ? 'yellow_background' : 'red_background',
      },
    } as BlockRequest,
    
    // Last run info
    {
      type: 'paragraph',
      paragraph: {
        rich_text: [
          richText('⏰ Last Run: ', { bold: true }),
          richText(data.lastRun),
        ],
      },
    } as BlockRequest,

    // Total standups
    {
      type: 'paragraph',
      paragraph: {
        rich_text: [
          richText('📊 Total Standups: ', { bold: true }),
          richText(data.totalStandups.toString()),
        ],
      },
    } as BlockRequest,

    // Environment
    {
      type: 'paragraph',
      paragraph: {
        rich_text: [
          richText('⚙️ Environment: ', { bold: true }),
          richText(data.environment),
        ],
      },
    } as BlockRequest,

    // Divider
    {
      type: 'divider',
      divider: {},
    } as BlockRequest,

    // System description
    {
      type: 'paragraph',
      paragraph: {
        rich_text: [
          richText('This page shows the live status of the Notion of Progress AI agent. The system automatically generates daily standups by reading your Notion task database and writing summaries back to Notion.'),
        ],
      },
    } as BlockRequest,
  ];

  // Add error information if present
  if (data.error) {
    blocks.push({
      type: 'callout',
      callout: {
        rich_text: [richText(`Error: ${data.error}`)],
        icon: { type: 'emoji', emoji: '❌' } as { type: 'emoji'; emoji: never },
        color: 'red_background',
      },
    } as BlockRequest);
  }

  return blocks;
}

/**
 * Gets the current total standup count from the Standup Log database
 */
export async function getTotalStandupCount(): Promise<number> {
  const notion = getNotionClient();
  
  const response = await withRetry(
    () => notion.databases.query({
      database_id: config.notion.standupLogDbId,
      filter: {
        property: 'Status',
        select: {
          equals: 'Generated',
        },
      },
    }),
    { attempts: 3, delayMs: 1000, shouldRetry: isNotionRateLimit }
  );

  return response.results.length;
}