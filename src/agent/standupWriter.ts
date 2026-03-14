// TODO (Day 4): Implement Notion standup page writer
// - Use notion-create-pages (Notion MCP) to write to NOTION_STANDUP_LOG_DB_ID
// - Format: Title "Standup — YYYY-MM-DD", sections Yesterday/Today/Blockers
// - Set properties: Date, Status=Generated, Tasks Reviewed count

import type { StandupSummary } from '../notion/types.ts';

export async function writeStandup(
  summary: StandupSummary,
  taskCount: number
): Promise<string> {
  throw new Error('Not implemented yet');
}
