import type { TaskRepository, CreateTaskRequest } from '../../core/ports/TaskRepository';
import type { TaskSummary } from '../../core/domain/types';
import { TaskStatus, TaskPriority } from '../../core/domain/types';
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

/**
 * Converts a string status value to TaskStatus enum, with fallback.
 */
function parseTaskStatus(value: string | null): TaskStatus {
  if (!value) return TaskStatus.TODO;
  
  // Map string values to enum values
  switch (value) {
    case 'To Do':
      return TaskStatus.TODO;
    case 'In Progress':
      return TaskStatus.IN_PROGRESS;
    case 'Done':
      return TaskStatus.DONE;
    case 'Blocked':
      return TaskStatus.BLOCKED;
    default:
      // Log unknown status but don't throw - graceful degradation
      console.warn(`Unknown task status '${value}', defaulting to 'To Do'`);
      return TaskStatus.TODO;
  }
}

/**
 * Converts a string priority value to TaskPriority enum, with fallback.
 */
function parseTaskPriority(value: string | null): TaskPriority | null {
  if (!value) return null;
  
  switch (value) {
    case 'High':
      return TaskPriority.HIGH;
    case 'Medium':
      return TaskPriority.MEDIUM;
    case 'Low':
      return TaskPriority.LOW;
    default:
      console.warn(`Unknown task priority '${value}', returning null`);
      return null;
  }
}

function toTaskSummary(page: PageObjectResponse): TaskSummary {
  try {
    return {
      id: page.id,
      title: extractText(page, config.notion.taskTitleProperty),
      status: parseTaskStatus(extractSelect(page, config.notion.taskStatusProperty)),
      dueDate: extractDate(page, 'Due Date'),
      priority: parseTaskPriority(extractSelect(page, 'Priority')),
      lastEdited: page.last_edited_time,
      url: page.url,
    };
  } catch (error) {
    throw new Error(`Failed to convert Notion page ${page.id} to TaskSummary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export class NotionTaskRepository implements TaskRepository {
  /**
   * Queries the Notion database with the given filter and returns parsed task summaries.
   * Handles pagination automatically and includes comprehensive error handling.
   */
  private async queryDB(filter: object): Promise<TaskSummary[]> {
    const notion = getNotionClient();
    const results: TaskSummary[] = [];
    let cursor: string | undefined;

    try {
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
            try {
              results.push(toTaskSummary(page as PageObjectResponse));
            } catch (error) {
              // Log individual page parsing errors but continue processing
              console.warn(`Failed to parse task from page ${page.id}:`, error);
            }
          }
        }

        cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
      } while (cursor);

      return results;
    } catch (error) {
      throw new Error(`Failed to query Notion database ${config.notion.taskDbId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

  /**
   * Creates a new task in the Notion database with the provided details.
   */
  async createTask(taskRequest: CreateTaskRequest): Promise<TaskSummary> {
    const notion = getNotionClient();
    
    // Build properties object with proper structure for Notion API
    // Note: Using any here is acceptable as Notion's types are complex and this is an adapter layer
    const properties: any = {
      [config.notion.taskTitleProperty]: {
        title: [{ text: { content: taskRequest.title } }],
      },
      [config.notion.taskStatusProperty]: {
        status: { name: taskRequest.status },
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

  /**
   * Updates the status of an existing task.
   */
  async updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<void> {
    const notion = getNotionClient();
    
    try {
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
    } catch (error) {
      throw new Error(`Failed to update task ${taskId} status to '${newStatus}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
