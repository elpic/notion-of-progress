import Anthropic from '@anthropic-ai/sdk';
import type { SummaryGenerator } from '../../core/ports/SummaryGenerator';
import type { TaskSummary, StandupSummary } from '../../core/domain/types';
import { config } from '../../config/index';
import { todayISO, yesterdayISO } from '../../utils/dateHelpers';
import { withRetry } from '../../utils/retry';

const SYSTEM_PROMPT = `You are a technical standup assistant. Given a list of Notion tasks, produce a concise standup summary.

Respond with ONLY a valid JSON object in this exact shape:
{
  "yesterday": ["bullet point 1", "bullet point 2"],
  "today": ["bullet point 1", "bullet point 2"],
  "blockers": ["blocker 1"]
}

Rules:
- Each bullet is one clear, concise sentence
- Maximum 5 bullets per section
- "yesterday" = what was completed or progressed
- "today" = what is planned or in progress
- "blockers" = explicit blockers only — use empty array [] if none
- Do not wrap the JSON in markdown code blocks`;

function formatTasks(tasks: TaskSummary[]): string {
  if (tasks.length === 0) return '(none)';
  return tasks
    .map((t) => `- [${t.status}] ${t.title}${t.priority ? ` (${t.priority})` : ''}${t.dueDate ? ` — due ${t.dueDate}` : ''}`)
    .join('\n');
}

function parseStandupJson(raw: string): StandupSummary {
  // Strip markdown code block if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  const parsed = JSON.parse(cleaned);

  return {
    yesterday: Array.isArray(parsed.yesterday) ? parsed.yesterday : [],
    today: Array.isArray(parsed.today) ? parsed.today : [],
    blockers: Array.isArray(parsed.blockers) ? parsed.blockers : [],
  };
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
        max_tokens: 512,
        messages: [{ role: 'user', content: userPrompt }],
        system: SYSTEM_PROMPT,
      }),
      { attempts: 2, delayMs: 2000 }
    );

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error(`Unexpected response type from Claude: ${content.type}`);
    }

    return parseStandupJson(content.text);
  }
}
