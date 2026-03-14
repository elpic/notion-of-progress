// TODO (Day 3): Implement Notion task DB query
// - Query NOTION_TASK_DB_ID for completed tasks (yesterday) and active tasks (today)
// - Map raw Notion pages to TaskSummary[]
// - Use date filters: startOfYesterday → startOfToday for "done", active for "today"

import type { TaskSummary } from '../notion/types.ts';

export async function fetchTasks(): Promise<{
  completed: TaskSummary[];
  active: TaskSummary[];
}> {
  throw new Error('Not implemented yet');
}
