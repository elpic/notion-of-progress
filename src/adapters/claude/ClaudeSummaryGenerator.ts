import Anthropic from '@anthropic-ai/sdk';
import type { SummaryGenerator } from '../../core/ports/SummaryGenerator';
import type { TaskSummary, StandupSummary, StandupBullet } from '../../core/domain/types';
import { config } from '../../config/index';
import { todayISO, yesterdayISO } from '../../utils/dateHelpers';
import { withRetry, isAnthropicOverloaded } from '../../utils/retry';

const SYSTEM_PROMPT = `You are a technical standup assistant. Given a list of Notion tasks, produce a concise standup summary.

Respond with ONLY a valid JSON object in this exact shape:
{
  "yesterday": [{ "text": "bullet point 1", "taskId": "abc123" }, { "text": "bullet point 2" }],
  "today": [{ "text": "bullet point 1", "taskId": "def456" }],
  "blockers": [{ "text": "blocker 1", "taskId": "ghi789" }]
}

Rules:
- Each bullet is one clear, concise sentence
- Maximum 5 bullets per section
- "yesterday" = what was completed or progressed
- "today" = what is planned or in progress
- "blockers" = explicit blockers only — use empty array [] if none
- "taskId" must match the id field from the task list exactly — omit if the bullet does not map to a single task
- Do not wrap the JSON in markdown code blocks`;

function formatTasks(tasks: TaskSummary[]): string {
  if (tasks.length === 0) return '(none)';
  return tasks
    .map((t) => `- id:${t.id} [${t.status}] ${t.title}${t.priority ? ` (${t.priority})` : ''}${t.dueDate ? ` — due ${t.dueDate}` : ''}`)
    .join('\n');
}

function toBullets(items: unknown[]): StandupBullet[] {
  return items.map((item) => {
    if (typeof item === 'string') return { text: item };
    if (typeof item === 'object' && item !== null && 'text' in item) {
      return {
        text: String((item as Record<string, unknown>).text),
        taskId: typeof (item as Record<string, unknown>).taskId === 'string'
          ? String((item as Record<string, unknown>).taskId)
          : undefined,
      };
    }
    return { text: String(item) };
  });
}

/**
 * Safely parses standup JSON from Claude's response with comprehensive validation.
 * @param raw - Raw response string that may contain JSON in markdown code blocks
 * @returns Validated StandupSummary object
 * @throws Error if parsing or validation fails
 */
function parseStandupJson(raw: string): StandupSummary {
  // Strip markdown code block if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  if (!cleaned) {
    throw new Error('Empty or whitespace-only JSON response received');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new Error(`Invalid JSON syntax: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
  }

  // Validate the parsed structure
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid JSON structure: expected object, got ' + typeof parsed);
  }

  const obj = parsed as Record<string, unknown>;

  // Validate required properties exist and are arrays
  const requiredKeys = ['yesterday', 'today', 'blockers'] as const;
  for (const key of requiredKeys) {
    if (!(key in obj)) {
      throw new Error(`Missing required property: ${key}`);
    }
  }

  try {
    return {
      yesterday: Array.isArray(obj.yesterday) ? toBullets(obj.yesterday) : [],
      today: Array.isArray(obj.today) ? toBullets(obj.today) : [],
      blockers: Array.isArray(obj.blockers) ? toBullets(obj.blockers) : [],
    };
  } catch (error) {
    throw new Error(`Failed to convert parsed data to StandupSummary: ${error instanceof Error ? error.message : 'Unknown conversion error'}`);
  }
}

export class ClaudeSummaryGenerator implements SummaryGenerator {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }

  async generateSummary(
    completed: TaskSummary[],
    active: TaskSummary[]
  ): Promise<StandupSummary> {
    const userPrompt = `Today is ${todayISO()}. Yesterday was ${yesterdayISO()}.

COMPLETED YESTERDAY:
${formatTasks(completed)}

IN PROGRESS / PLANNED TODAY:
${formatTasks(active)}

Generate the standup summary JSON.`;

    const message = await withRetry(
      () => this.client.messages.create({
        model: config.anthropic.model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: userPrompt }],
        system: SYSTEM_PROMPT,
      }),
      { attempts: 4, delayMs: 5000, shouldRetry: isAnthropicOverloaded }
    );

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error(`Unexpected response type from Claude: ${content.type}`);
    }

    return parseStandupJson(content.text);
  }
}
