import { getNotionClient } from '../notion/client';
import { config } from '../config/index';
import { startOfYesterday, startOfToday } from '../utils/dateHelpers';
import type { TaskSummary } from '../notion/types';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';

function extractText(page: PageObjectResponse, property: string): string {
  const prop = page.properties[property];
  if (!prop) return 'Untitled';
  if (prop.type === 'title') {
    return prop.title.map((t) => t.plain_text).join('') || 'Untitled';
  }
  if (prop.type === 'rich_text') {
    return prop.rich_text.map((t) => t.plain_text).join('');
  }
  return 'Untitled';
}

function extractSelect(page: PageObjectResponse, property: string): string | null {
  const prop = page.properties[property];
  if (!prop || prop.type !== 'select') return null;
  return prop.select?.name ?? null;
}

function extractDate(page: PageObjectResponse, property: string): string | null {
  const prop = page.properties[property];
  if (!prop || prop.type !== 'date') return null;
  return prop.date?.start ?? null;
}

function toTaskSummary(page: PageObjectResponse): TaskSummary {
  return {
    id: page.id,
    title: extractText(page, config.notion.taskTitleProperty),
    status: extractSelect(page, config.notion.taskStatusProperty) ?? 'Unknown',
    dueDate: extractDate(page, 'Due Date'),
    priority: extractSelect(page, 'Priority'),
    lastEdited: page.last_edited_time,
    url: page.url,
  };
}

async function queryDB(filter: object): Promise<TaskSummary[]> {
  const notion = getNotionClient();
  const results: TaskSummary[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: config.notion.taskDbId,
      filter: filter as Parameters<typeof notion.databases.query>[0]['filter'],
      start_cursor: cursor,
      page_size: 100,
    });

    for (const page of response.results) {
      if (page.object === 'page' && 'properties' in page) {
        results.push(toTaskSummary(page as PageObjectResponse));
      }
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return results;
}

export async function fetchTasks(): Promise<{
  completed: TaskSummary[];
  active: TaskSummary[];
}> {
  const [completed, active] = await Promise.all([
    // Tasks marked Done and last edited since yesterday
    queryDB({
      and: [
        {
          property: config.notion.taskStatusProperty,
          select: { equals: config.notion.taskDoneValue },
        },
        {
          timestamp: 'last_edited_time',
          last_edited_time: { on_or_after: startOfYesterday() },
        },
      ],
    }),
    // Tasks not Done (In Progress, To Do, Blocked)
    queryDB({
      property: config.notion.taskStatusProperty,
      select: { does_not_equal: config.notion.taskDoneValue },
    }),
  ]);

  return { completed, active };
}
