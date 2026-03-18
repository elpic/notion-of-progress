import 'dotenv/config';

/**
 * Retrieves a required environment variable, throwing an error if it's not set.
 * @param key - The environment variable name
 * @returns The environment variable value
 * @throws Error if the environment variable is not set or empty
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

/**
 * Application configuration loaded from environment variables.
 * All required values are validated at startup.
 */
export const config = {
  /** Notion workspace configuration */
  notion: {
    apiKey: requireEnv('NOTION_API_KEY'),
    taskDbId: requireEnv('NOTION_TASK_DB_ID'),
    standupLogDbId: requireEnv('NOTION_STANDUP_LOG_DB_ID'),
    systemStatusDbId: process.env.NOTION_SYSTEM_STATUS_DB_ID ?? null, // Optional - created by setup
    taskStatusProperty: process.env.TASK_STATUS_PROPERTY ?? 'Status',
    taskDoneValue: process.env.TASK_DONE_VALUE ?? 'Done',
    taskTitleProperty: process.env.TASK_TITLE_PROPERTY ?? 'Name',
  },
  /** Anthropic AI configuration */  
  anthropic: {
    apiKey: requireEnv('ANTHROPIC_API_KEY'),
    model: 'claude-sonnet-4-6',
  },
  /** Local scheduler configuration (not used in GitHub Actions) */
  scheduler: {
    cronSchedule: process.env.CRON_SCHEDULE ?? '0 8 * * 1-5',
    digestCronSchedule: process.env.DIGEST_CRON_SCHEDULE ?? '0 17 * * 5',
    timezone: process.env.TZ ?? 'America/New_York',
  },
  /** Discord integration configuration (optional) */
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL ?? null,
  },
};
