/**
 * McpStandupAgent
 *
 * Uses the Claude Agent SDK with the Notion MCP server to fetch tasks,
 * then delegates to the existing pipeline (ClaudeSummaryGenerator +
 * NotionStandupRepository) so the standup page always has consistent formatting.
 *
 * Split of responsibilities:
 *   - MCP agent   → reads Task DB and returns structured task data
 *   - ClaudeSummaryGenerator → generates the standup summary JSON
 *   - NotionStandupRepository → writes the page with the established style
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { config } from '../../config/index';
import { todayISO, todayFormatted, yesterdayISO } from '../../utils/dateHelpers';
import { logger } from '../../utils/logger';
import type { TaskSummary, StandupSummary } from '../../core/domain/types';
import { ClaudeSummaryGenerator } from '../claude/ClaudeSummaryGenerator';
import { NotionStandupRepository } from '../notion/NotionStandupRepository';

// ─── Phase 1: fetch tasks via MCP ────────────────────────────────────────────

const FETCH_SYSTEM_PROMPT = `You are a Notion task reader. Your only job is to query the Notion Task DB and return structured JSON — nothing else.

The Task DB ID is: ${config.notion.taskDbId}

Use the notion-query-database (or API-query-a-database) tool with these exact filter bodies:

Query 1 — completed tasks (Status = "Done"):
{
  "filter": {
    "and": [
      { "property": "Status", "status": { "equals": "Done" } },
      { "timestamp": "last_edited_time", "last_edited_time": { "on_or_after": "${yesterdayISO()}" } }
    ]
  }
}

Query 2 — active tasks (Status != "Done"):
{
  "filter": {
    "property": "Status",
    "status": { "does_not_equal": "Done" }
  }
}

After running both queries, return ONLY a valid JSON object in this exact shape (no markdown, no explanation, no extra text):
{
  "completed": [
    { "id": "page-id", "title": "Task title", "status": "Done", "url": "https://notion.so/...", "lastEdited": "2026-03-15T10:00:00.000Z", "dueDate": null, "priority": null }
  ],
  "active": [
    { "id": "page-id", "title": "Task title", "status": "In Progress", "url": "https://notion.so/...", "lastEdited": "2026-03-15T10:00:00.000Z", "dueDate": null, "priority": null }
  ]
}

Extract each task's id, title (from the Name/title property), status, url, last_edited_time (as lastEdited), and any Due Date or Priority properties. Use null if a property is missing.`;

async function fetchTasksViaMcp(): Promise<{ completed: TaskSummary[]; active: TaskSummary[] }> {
  logger.info('Fetching tasks via Notion MCP');

  let jsonOutput = '';

  for await (const message of query({
    prompt: `Fetch all tasks from the Notion Task DB for ${todayISO()}.`,
    options: {
      model: 'claude-opus-4-6',
      systemPrompt: FETCH_SYSTEM_PROMPT,
      mcpServers: {
        notion: {
          command: 'npx',
          args: ['-y', '@notionhq/notion-mcp-server'],
          env: {
            OPENAPI_MCP_HEADERS: JSON.stringify({
              Authorization: `Bearer ${config.notion.apiKey}`,
              'Notion-Version': '2022-06-28',
            }),
          },
        },
      },
      allowedTools: ['mcp__notion__*'],
      permissionMode: 'acceptEdits',
      maxTurns: 10,
    },
  })) {
    if (message.type === 'assistant' && Array.isArray(message.message?.content)) {
      for (const block of message.message.content) {
        if (block.type === 'text' && block.text) {
          logger.info(`[Claude] ${block.text.slice(0, 200)}`);
        } else if (block.type === 'tool_use') {
          logger.info(`[Tool call] ${block.name}`);
        }
      }
    } else if ('result' in message) {
      jsonOutput = message.result ?? '';
      logger.info(`[MCP fetch result] ${jsonOutput.slice(0, 300)}`);
    }
  }

  // Extract JSON from Claude's output (strip any surrounding text/markdown)
  const jsonMatch = jsonOutput.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('MCP agent did not return valid JSON task data');

  const parsed = JSON.parse(jsonMatch[0]) as { completed: TaskSummary[]; active: TaskSummary[] };
  logger.info(`Tasks fetched — completed: ${parsed.completed.length}, active: ${parsed.active.length}`);
  return parsed;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function runMcpStandupAgent(): Promise<string> {
  logger.info('Starting Notion MCP standup agent');

  // Phase 1: fetch tasks via MCP
  const { completed, active } = await fetchTasksViaMcp();

  // Phase 2: generate summary with Claude (same as the standard pipeline)
  logger.info('Generating standup summary');
  const summarizer = new ClaudeSummaryGenerator();
  const summary: StandupSummary = await summarizer.generateSummary(completed, active);

  // Phase 3: write the page with the established style
  logger.info('Writing standup page');
  const standupRepo = new NotionStandupRepository();
  const existingPageId = await standupRepo.findTodayPageId();
  if (existingPageId) logger.warn(`Updating existing standup page: ${existingPageId}`);

  const url = await standupRepo.writeStandup(summary, completed, active, existingPageId ?? undefined);
  return url;
}
