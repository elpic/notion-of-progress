import type { TaskRepository, CreateTaskRequest } from '../../core/ports/TaskRepository';
import type { TaskSummary } from '../../core/domain/types';
import { getNotionClient } from '../../notion/client';
import { config } from '../../config/index';
import { startOfYesterday } from '../../utils/dateHelpers';
import { withRetry, isNotionRateLimit } from '../../utils/retry';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';

function extractText(page: PageObjectResponse, property: string): string {
  const prop = page.properties[property];
  if (!prop) return 'Untitled';
  if (prop.type === 'title') return prop.title.map((t) => t.plain_text).join('') || 'Untitled';
  if (prop.type === 'rich_text') return prop.rich_text.map((t) => t.plain_text).join('');
  return 'Untitled';
}

function extractSelect(page: PageObjectResponse, property: string): string | null {
  const prop = page.properties[property];
  if (!prop) return null;
  if (prop.type === 'select') return prop.select?.name ?? null;
  if (prop.type === 'status') return prop.status?.name ?? null;
  return null;
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

export class NotionTaskRepository implements TaskRepository {
  private async queryDB(filter: object): Promise<TaskSummary[]> {
    const notion = getNotionClient();
    const results: TaskSummary[] = [];
    let cursor: string | undefined;

    do {
      const response = await withRetry(
        () => notion.databases.query({
          database_id: config.notion.taskDbId,
          filter: filter as Parameters<typeof notion.databases.query>[0]['filter'],
          start_cursor: cursor,
          page_size: 100,
        }),
        { attempts: 3, delayMs: 1000, shouldRetry: isNotionRateLimit }
      );

      for (const page of response.results) {
        if (page.object === 'page' && 'properties' in page) {
          results.push(toTaskSummary(page as PageObjectResponse));
        }
      }

      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);

    return results;
  }

  async fetchTasks(): Promise<{ completed: TaskSummary[]; active: TaskSummary[] }> {
    const [completed, active] = await Promise.all([
      this.queryDB({
        and: [
          { property: config.notion.taskStatusProperty, status: { equals: config.notion.taskDoneValue } },
          { timestamp: 'last_edited_time', last_edited_time: { on_or_after: startOfYesterday() } },
        ],
      }),
      this.queryDB({
        property: config.notion.taskStatusProperty,
        status: { does_not_equal: config.notion.taskDoneValue },
      }),
    ]);

    return { completed, active };
  }

  async createTask(taskRequest: CreateTaskRequest): Promise<TaskSummary> {
    const notion = getNotionClient();
    
    const properties: any = {
      [config.notion.taskTitleProperty]: {
        title: [
          {
            text: {
              content: taskRequest.title,
            },
          },
        ],
      },
      [config.notion.taskStatusProperty]: {
        status: {
          name: taskRequest.status,
        },
      },
    };

    // Add priority if provided
    if (taskRequest.priority) {
      properties.Priority = {
        select: {
          name: taskRequest.priority,
        },
      };
    }

    // Add due date if provided
    if (taskRequest.dueDate) {
      properties['Due Date'] = {
        date: {
          start: taskRequest.dueDate,
        },
      };
    }

    // Add notes if provided
    if (taskRequest.notes) {
      properties.Notes = {
        rich_text: [
          {
            text: {
              content: taskRequest.notes,
            },
          },
        ],
      };
    }

    const response = await withRetry(
      () => notion.pages.create({
        parent: { database_id: config.notion.taskDbId },
        properties,
      }),
      { attempts: 3, delayMs: 1000, shouldRetry: isNotionRateLimit }
    );

    if (response.object === 'page' && 'properties' in response) {
      return toTaskSummary(response as PageObjectResponse);
    }

    throw new Error('Failed to create task');
  }

  async updateTaskStatus(taskId: string, newStatus: string): Promise<void> {
    const notion = getNotionClient();
    
    await withRetry(
      () => notion.pages.update({
        page_id: taskId,
        properties: {
          [config.notion.taskStatusProperty]: {
            status: {
              name: newStatus,
            },
          },
        },
      }),
      { attempts: 3, delayMs: 1000, shouldRetry: isNotionRateLimit }
    );
  }
}
