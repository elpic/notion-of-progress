import 'dotenv/config';

function require_env(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  notion: {
    apiKey: require_env('NOTION_API_KEY'),
    taskDbId: require_env('NOTION_TASK_DB_ID'),
    standupLogDbId: require_env('NOTION_STANDUP_LOG_DB_ID'),
    taskStatusProperty: process.env.TASK_STATUS_PROPERTY ?? 'Status',
    taskDoneValue: process.env.TASK_DONE_VALUE ?? 'Done',
    taskTitleProperty: process.env.TASK_TITLE_PROPERTY ?? 'Name',
  },
  anthropic: {
    apiKey: require_env('ANTHROPIC_API_KEY'),
    model: 'claude-sonnet-4-6',
  },
  scheduler: {
    cronSchedule: process.env.CRON_SCHEDULE ?? '0 8 * * 1-5',
    timezone: process.env.TZ ?? 'America/New_York',
  },
};
